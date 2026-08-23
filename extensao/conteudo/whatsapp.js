/**
 * Detector do WhatsApp Web.
 *
 * **O que este arquivo lê:** o identificador da conversa aberta e o
 * nome no cabeçalho. Só isso. Não lê mensagem, não lê histórico, não
 * envia nada para lugar nenhum além da consulta ao próprio CW
 * Reputação — que recebe um telefone, não uma conversa.
 *
 * **Por que ler o `data-id` e não só o cabeçalho:** com o contato
 * salvo na agenda, o cabeçalho mostra o apelido ("Pizzaria do João") e
 * o número não aparece em lugar nenhum da tela. O atributo `data-id`
 * das mensagens carrega o identificador real — `...5527999996862@c.us`
 * —, que é o que serve para cruzar com a base.
 *
 * **Por que pesquisa em intervalo em vez de observar o DOM:** o
 * WhatsApp Web reescreve a árvore continuamente, e um `MutationObserver`
 * na página inteira dispararia milhares de vezes por minuto. Uma
 * leitura barata a cada 1,2 s custa menos e erra menos.
 */
(() => {
  const CW = window.CWReputacao;

  if (!CW?.painel) return;

  CW.painel.montar();

  /**
   * Só aqui o painel pode abrir sozinho.
   *
   * Trocar de conversa no WhatsApp é um evento nítido e voluntário — é
   * a única superfície das três em que abrir a gaveta sem clique
   * acompanha o que a pessoa acabou de fazer.
   */
  CW.painel.permitirAutoAbrir();

  const INTERVALO = 1200;

  function lerConversa() {

    const principal = document.querySelector("#main");

    if (!principal) return null;

    let telefone = "";
    let grupo = false;

    const comId = principal.querySelector("[data-id]");

    if (comId) {

      const bruto = comId.getAttribute("data-id") ?? "";

      if (bruto.includes("@g.us")) grupo = true;

      const achado = bruto.match(/(\d{8,20})@c\.us/);

      if (achado) telefone = achado[1];
    }

    const cabecalho = principal.querySelector("header");

    let nome = "";

    if (cabecalho) {

      const comTitulo =
        cabecalho.querySelector("span[title]");

      nome =
        comTitulo?.getAttribute("title")?.trim() ??
        CW.texto(cabecalho.querySelector("span"), 80);
    }

    /**
     * Contato fora da agenda: o cabeçalho já é o próprio número. Serve
     * de rede quando a conversa ainda não tem mensagem e o `data-id`
     * não existe.
     */
    if (!telefone && nome) {

      const digitos = CW.digitos(nome);

      if (
        digitos.length >= 10 &&
        /^[+\d\s()\-]+$/.test(nome)
      ) {
        telefone = digitos;
      }
    }

    if (!telefone && !nome) return null;

    return { telefone, nome, grupo };
  }

  /**
   * As mensagens visíveis da conversa aberta.
   *
   * **Só é chamada quando você clica em "Resumir".** É a diferença
   * entre uma ferramenta que lê quando pedem e uma que escuta o tempo
   * todo, e ela é deliberada: o resto do detector continua lendo apenas
   * telefone e nome, a cada ciclo.
   *
   * A direção sai do próprio data-id: o prefixo true_ marca o que
   * saiu daqui, false_ o que veio do cliente. É mais confiável do que
   * inferir por posição ou por cor da bolha, que mudam a cada
   * reestilização do WhatsApp.
   */
  /**
   * Onde as mensagens moram.
   *
   * `#main` é o de sempre, e é o primeiro a ser tentado. Os outros
   * existem porque **a marcação do WhatsApp Web muda sem aviso**, e
   * quando muda o sintoma é o pior possível: a extensão diz "não achei
   * mensagem nenhuma" numa conversa cheia, e ninguém sabe se o defeito
   * é a leitura ou a conversa.
   *
   * Do mais específico para o mais genérico: um `id` que eles mantêm há
   * anos, um `data-testid` que eles usam nos testes deles, e por fim a
   * função ARIA — que é a que mais sobrevive a reestilização, porque é
   * o que faz o site funcionar com leitor de tela.
   */
  const ONDE_FICAM = [
    "#main",
    '[data-testid="conversation-panel-messages"]',
    '[role="application"]',
    '[role="log"]',
  ];

  /**
   * Como reconhecer uma mensagem dentro dele.
   *
   * Mesma lógica em camadas. O `data-id` é o melhor porque traz a
   * direção junto (`true_` é nosso); os demais são redes.
   */
  const COMO_SAO = [
    "div[data-id]",
    "[data-id]",
    '[role="row"]',
    ".message-in, .message-out",
  ];

  function primeiroQueAcha(raiz, seletores, minimo = 1) {

    for (const seletor of seletores) {

      const achados = raiz.querySelectorAll(seletor);

      if (achados.length >= minimo) {
        return { seletor, achados };
      }
    }

    return null;
  }

  /**
   * De quem é a mensagem.
   *
   * Três leituras, em ordem de confiança. O `data-id` é o que não
   * depende de estilo — o prefixo `true_` marca o que saiu daqui. A
   * classe `message-out` é o marcador clássico, e sobrevive à maioria
   * das mudanças. A posição na tela é o último recurso, e é chute
   * informado: o WhatsApp alinha o que é nosso à direita.
   */
  function deQuemE(linha) {

    const id = linha.getAttribute?.("data-id") ?? "";

    if (id.startsWith("true_")) return "nos";
    if (id.startsWith("false_")) return "cliente";

    if (linha.querySelector?.(".message-out")) return "nos";
    if (linha.classList?.contains("message-out")) {
      return "nos";
    }

    if (linha.querySelector?.(".message-in")) {
      return "cliente";
    }
    if (linha.classList?.contains("message-in")) {
      return "cliente";
    }

    return "cliente";
  }

  function lerMensagens() {

    const container = ONDE_FICAM.map((seletor) =>
      document.querySelector(seletor)
    ).find(Boolean);

    if (!container) {
      return {
        mensagens: [],
        motivo:
          "não achei o painel da conversa nesta página",
      };
    }

    const encontro = primeiroQueAcha(container, COMO_SAO);

    if (!encontro) {
      return {
        mensagens: [],
        motivo:
          "achei a conversa, mas nenhuma linha de mensagem — a marcação do WhatsApp mudou",
      };
    }

    const mensagens = [];

    for (const linha of encontro.achados) {

      /**
       * Linha sem `@` no id não é mensagem.
       *
       * O `data-id` das mensagens carrega o telefone
       * (`true_5511...@c.us_ABC`). Os outros elementos com `data-id`
       * são divisores de data e avisos do sistema. A checagem só vale
       * quando o id existe — nas camadas de baixo ele não existe, e
       * exigi-lo lá jogaria fora tudo.
       */
      const id = linha.getAttribute?.("data-id") ?? "";

      if (id && !id.includes("@")) continue;

      const balao = linha.querySelector(
        ".selectable-text, [data-pre-plain-text], .copyable-text"
      );

      const texto = (
        balao?.innerText ??
        linha.innerText ??
        ""
      )
        .replace(/\s+/g, " ")
        .trim();

      if (!texto) continue;

      /**
       * O WhatsApp guarda o carimbo num atributo, no formato
       * "[HH:MM, DD/MM/AAAA] Nome: ". A hora é o que vem logo depois do
       * colchete e antes da vírgula.
       */
      const carimbo =
        linha
          .querySelector("[data-pre-plain-text]")
          ?.getAttribute("data-pre-plain-text") ?? "";

      const hora =
        carimbo.match(/\[([^\],]+)/)?.[1] ?? "";

      mensagens.push({
        de: deQuemE(linha),
        texto: texto.slice(0, 1200),
        hora: hora.trim(),
      });
    }

    return {
      mensagens,

      /**
       * Por qual camada a leitura passou.
       *
       * Vai para a tela quando dá ruim. Sem isso, "0 mensagens" não
       * distingue conversa vazia de leitor quebrado — e foi essa
       * confusão que fez a mesma falha ser reportada três vezes.
       */
      via: encontro.seletor,

      motivo:
        mensagens.length === 0
          ? `achei ${encontro.achados.length} linha(s) por "${encontro.seletor}", mas nenhuma com texto`
          : undefined,
    };
  }

  CW.painel.definirLeitorDeConversa?.(lerMensagens);

  let ultimaChave = "";

  function verificar() {

    CW.painel.garantir();

    const conversa = lerConversa();

    if (!conversa) {
      ultimaChave = "";
      return;
    }

    const chave = `${conversa.telefone}|${conversa.nome}`;

    if (chave === ultimaChave) return;

    ultimaChave = chave;

    /**
     * Grupo não é cliente: um grupo de suporte com dez pessoas casaria
     * com qualquer coisa e não representa ninguém.
     */
    if (conversa.grupo) {
      CW.painel.definirCaptura(null);
      CW.painel.definirContexto({
        canalDaPagina: "WhatsApp",
        rotulo: "conversa em grupo",
      });
      return;
    }

    /**
     * O contato já vira rascunho de caso.
     *
     * Guardado, não enviado: serve para o painel poder oferecer
     * "cadastrar caso" no mesmo instante em que descobre que aquele
     * telefone não tem nada do nosso lado — sem uma segunda leitura da
     * tela e sem pedir para redigitar o que já está ali.
     */
    CW.painel.definirCaptura({
      origem: "WhatsApp",
      cliente: conversa.nome || conversa.telefone,
      telefone: conversa.telefone,
      titulo: "",
      texto: "",
      prioridade: "Média",
    });

    CW.painel.definirContexto({
      canalDaPagina: "WhatsApp",
      telefone: conversa.telefone,
      nome: conversa.nome,
      rotulo: conversa.nome || conversa.telefone,
    });
  }

  /**
   * O laço nunca deixa a página quebrar a ferramenta.
   *
   * Detector lê DOM alheio, e DOM alheio muda. Uma exceção aqui, sem a
   * proteção, derrubava a primeira execução e com ela o próprio
   * `setInterval` — o painel ficava montado e mudo, sem nada no
   * console da nossa origem.
   */
  function verificarComRede() {
    try {
      verificar();
    } catch (erro) {
      console.warn("[CW] detector falhou nesta volta", erro);
    }
  }

  setInterval(verificarComRede, INTERVALO);

  verificarComRede();
})();
