/**
 * Detector do Hugme e do Reclame Aqui.
 *
 * A pergunta que o painel responde aqui é outra: não "quem é este
 * cliente", e sim "**esta reclamação já existe do nosso lado?**" — quem
 * é o dono, em que etapa está, e qual prazo `sla.service.ts` calcularia
 * para ela.
 *
 * **A identificação acontece dentro da reclamação aberta**, não no
 * endereço. A página traz tudo rotulado — COD, ID, cidade, data,
 * telefone, nome do consumidor, e-mail e o formulário do RA Forms — e é
 * disso que os leitores vivem. Cada leitor é uma função pura em
 * `ra-campos.js`, provada por `npm run check:ra` contra o texto de uma
 * reclamação real; aqui ficam só o DOM e o laço.
 *
 * Quando um leitor falha, o campo vem vazio e a prévia pergunta — nunca
 * um chute. E a busca manual continua ali, que é a única coisa que não
 * depende de layout nenhum.
 */
(() => {
  const CW = window.CWReputacao;

  if (!CW?.painel) return;

  /**
   * Monta **antes** de qualquer dependência.
   *
   * Isto custou um defeito com sintoma péssimo: "a extensão não abre
   * mais, só reinstalando". A guarda aqui era
   * `if (!CW?.painel || !CW.ra) return;`, e `ra-campos.js` é arquivo
   * novo no manifesto — recarregar uma extensão descompactada nem
   * sempre relê a lista de scripts de conteúdo, então `CW.ra` vinha
   * indefinido, o detector desistia **antes de montar**, e o painel
   * simplesmente não existia na página. Reinstalar relia o manifesto e
   * "consertava", o que escondia a causa.
   *
   * A regra que fica: falta de dependência vira aviso na tela, nunca o
   * desaparecimento da ferramenta.
   */
  CW.painel.montar();

  if (!CW.ra) {

    CW.painel.definirContexto({
      canalDaPagina: "Reclame Aqui",
      rotulo:
        "recarregue a extensão — falta um arquivo novo (ra-campos.js)",
    });

    return;
  }

  const INTERVALO = 1500;

  /**
   * O texto da página, inteiro.
   *
   * Sem fatiar em 4.000 caracteres como antes: o relato e o RA Forms
   * ficam depois disso numa reclamação longa, e o corte silencioso era
   * o motivo de os campos do fim virem vazios. `innerText` custa um
   * cálculo de layout, e por isso é lido **uma vez** por leitura, não
   * uma vez por campo.
   */
  function texto() {
    return document.body?.innerText ?? "";
  }

  /**
   * Título: o `h1` da página, com o `document.title` de reserva.
   *
   * `CW.ra.titulo` tira o "Cardápio Web: " da frente — o prefixo é do
   * portal, e as reclamações que vieram da planilha do Hugme não o têm.
   */
  function tituloNaTela(conteudo) {

    /**
     * A posição no texto vem **antes** do `h1`.
     *
     * Em "Responder reclamação" o `h1` é o cabeçalho da tela, e era ele
     * que estava indo para a prévia como título da reclamação. O título
     * de verdade é a linha acima da fileira de etiquetas.
     */
    const daPagina = CW.ra.tituloNaPagina(conteudo);

    if (daPagina) return daPagina;

    const h1 = CW.texto(document.querySelector("h1"), 260);

    if (h1 && h1.length > 8) return CW.ra.titulo(h1);

    return CW.ra.titulo(
      document.title.replace(
        /\s*[|\-–]\s*(Reclame Aqui|Reclame AQUI|Hugme).*$/i,
        ""
      )
    );
  }

  /**
   * Texto que é código, e não relato.
   *
   * O Reclame Aqui injeta o Google Tag Manager em `<div>` soltos, e o
   * conteúdo deles é **maior** que a reclamação — a busca pelo maior
   * bloco de texto voltava com JavaScript. Este teste é o que separa os
   * dois sem depender de classe CSS.
   */
  function pareceCodigo(valor) {
    return /google_tag_manager|function\s*\(|=>|var\s+[A-Za-z_$]+\s*=|\}\)\(/.test(
      valor.slice(0, 200)
    );
  }

  /**
   * O relato, quando a âncora "A reclamação" não existe.
   *
   * Reserva para o Hugme e para o dia em que o bloco mudar de nome: o
   * `<p>` dentro do `<article>`, que é semântico o bastante para
   * sobreviver a uma troca de classes.
   */
  function relatoPeloDom() {

    const doArtigo = [
      ...document.querySelectorAll(
        "article p, article [data-testid]"
      ),
    ]
      .map((elemento) => (elemento.innerText ?? "").trim())
      .filter(
        (valor) =>
          valor.length >= 100 &&
          valor.length <= 20000 &&
          !pareceCodigo(valor)
      )
      .sort((a, b) => b.length - a.length)[0];

    return doArtigo ?? "";
  }

  /**
   * Lê a reclamação aberta.
   *
   * Tudo junto, numa passada só pelo texto da página. O resultado fica
   * **guardado no painel** e só vira requisição depois de alguém
   * conferir a prévia — ler não é gravar.
   */
  function lerReclamacao(bruto) {

    const conteudo = bruto ?? texto();

    const id = CW.ra.id(conteudo);

    const quando = CW.ra.data(conteudo);
    const local = CW.ra.cidade(conteudo);
    const telefone = CW.ra.telefone(conteudo);

    const relato =
      CW.ra.relato(conteudo) || relatoPeloDom();

    return {
      id,
      cod: CW.ra.cod(conteudo),

      cliente: CW.ra.nome(conteudo),
      telefone,
      email: CW.ra.email(conteudo),

      titulo: tituloNaTela(conteudo),
      texto: relato,

      criadoEm: quando.iso,
      hora: quando.hora,

      cidade: local.cidade,

      /**
       * A UF sai daqui **como a página a mostra** — quase sempre vazia.
       *
       * Deduzir fica com a prévia, e não com o leitor, porque lá o
       * valor vem com a etiqueta de onde veio: da base ou do DDD. Um
       * campo preenchido sem dizer a origem ninguém confere.
       */
      estado: local.estado,

      /**
       * Categoria não é lida da página de propósito: o portal não
       * classifica a reclamação, e o que parecia rótulo de categoria
       * ("Está com problema com Cardápio Web?") era pergunta de
       * formulário. Quem tem a lista certa é a própria ferramenta — a
       * prévia oferece as categorias cadastradas.
       */
      categoria: "",
      subcategoria: "",

      prioridade: "Alta",
      statusPortal: CW.ra.status(conteudo),

      /**
       * O RA Forms vai junto: a prévia mostra tudo, e **um** campo é
       * gravado.
       *
       * O campo é o documento — CPF ou CNPJ. Ele é o único do formulário
       * que casa com algo daqui: o cadastro de estabelecimentos guarda o
       * mesmo número, e a reclamação passa a guardar também, o que faz o
       * vínculo se montar sozinho. O e-mail de acesso e o nome do
       * proprietário continuam só na prévia: não há campo para eles sem
       * inventar cadastro novo.
       */
      documento: CW.ra.documento(conteudo),
      formulario: CW.ra.formulario(conteudo),
      formularioRecolhido:
        CW.ra.formularioRecolhido(conteudo),

      origem: "Reclame Aqui",
      url: location.href,
    };
  }

  let ultimaChave = "";

  function verificar() {

    CW.painel.garantir();

    /**
     * A chave é o endereço **mais o número da reclamação**.
     *
     * Só o endereço não serve, e isso custou um defeito: a Área da
     * Empresa do Reclame Aqui é um SPA — o endereço não muda entre a
     * lista e a reclamação aberta, e o conteúdo chega **depois** do
     * primeiro ciclo do detector. Com a chave presa ao endereço, o
     * painel lia a página ainda vazia, guardava "nenhuma reclamação
     * aberta nesta aba" e nunca mais tentava.
     *
     * O id também não pode entrar sozinho no lugar do texto lido, que
     * foi a primeira tentativa: nome e relato o portal reescreve
     * enquanto renderiza, e a chave mudava a cada ciclo — o painel
     * tratava isso como reclamação nova e a gaveta pulava na frente de
     * quem estava lendo. O número é estável assim que existe.
     *
     * Custo: um `innerText` por ciclo. Os leitores só rodam quando o
     * número muda, que é o trabalho caro.
     */
    const conteudo = texto();

    const chave = `${location.href}#${CW.ra.id(conteudo)}`;

    if (chave === ultimaChave) return;

    ultimaChave = chave;

    fecharCompletar();

    const lida = lerReclamacao(conteudo);

    if (!lida.id && !lida.cliente) {
      CW.painel.definirCaptura(null);
      CW.painel.definirContexto({
        canalDaPagina: "Reclame Aqui",
        rotulo: "nenhuma reclamação aberta nesta aba",
      });
      return;
    }

    CW.painel.definirCaptura(lida);

    CW.painel.definirContexto({
      canalDaPagina: "Reclame Aqui",
      protocolo: lida.id,
      nome: lida.cliente,
      telefone: lida.telefone,
      email: lida.email,

      /*
        O documento do RA Forms entra na busca.

        Ele já era lido para gravar o vínculo com o estabelecimento, e
        parava por aí. Como chave de busca é a mais forte que existe:
        casa por igualdade, e sobrevive a alguém trocar de telefone.
      */
      documento: lida.documento,
      rotulo: lida.id
        ? `protocolo ${lida.id}`
        : lida.cliente,
    });

    oferecerCompletar(lida).catch((erro) => {
      console.warn("[CW] não deu para conferir o que falta no quadro", erro);
    });
  }

  /* ============================================================
     COMPLETAR NO QUADRO
  ============================================================ */

  /**
   * Completa no quadro o que esta página mostra e lá está faltando.
   *
   * **O pedido.** "Os casos que foram adicionados não estarão com as
   * informações completas. Quero um botão no Kanban e na lista para
   * completar abrindo uma aba rápida." O botão da plataforma abre esta
   * reclamação na área da empresa; aqui a extensão mostra o que leu e
   * oferece gravar.
   *
   * **Só depois do clique, e com o que vai ser gravado à vista.** O
   * leitor da página é aproximado por natureza; mostrar nome, telefone
   * e documento antes de gravar é a mesma prévia da captura, em
   * miniatura. E o servidor só preenche o que está vazio.
   */
  const perguntadas = new Set();
  let hospedeiroCompletar = null;

  /** A página tem o que falta? */
  function temNaPagina(lida, falta) {
    if (falta === "nome") return Boolean(lida.cliente);
    if (falta === "contato") return Boolean(lida.telefone || lida.email);
    if (falta === "documento") return Boolean(lida.documento);
    return false;
  }

  function fecharCompletar() {
    hospedeiroCompletar?.remove();
    hospedeiroCompletar = null;
  }

  /** "nome, telefone e documento". */
  function juntar(lista) {
    return lista.length <= 1
      ? lista.join("")
      : `${lista.slice(0, -1).join(", ")} e ${lista[lista.length - 1]}`;
  }

  async function oferecerCompletar(lida) {

    const chave = lida.cod || lida.id;

    if (!chave || perguntadas.has(chave)) return;

    perguntadas.add(chave);

    const resposta = await CW.enviar({
      tipo: "completarPergunta",
      cod: lida.cod,
      id: lida.id,
    });

    const dados = resposta?.ok ? resposta.dados : null;

    if (!dados?.existe || !dados.podeGravar) return;

    const supriveis = (dados.faltam ?? []).filter((falta) =>
      temNaPagina(lida, falta)
    );

    /* A reclamação mudou enquanto a pergunta ia e voltava. */
    if (supriveis.length === 0 || ultimaChave.split("#").pop() !== String(lida.id ?? "")) {
      return;
    }

    desenharCompletar(lida, dados);
  }

  /** Montado com DOM, e o texto com `textContent`: é dado de consumidor. */
  function desenharCompletar(lida, dados) {

    fecharCompletar();

    hospedeiroCompletar = document.createElement("div");
    hospedeiroCompletar.id = "cw-reputacao-completar";
    document.documentElement.appendChild(hospedeiroCompletar);

    const sombra = hospedeiroCompletar.attachShadow({ mode: "open" });

    const estilo = document.createElement("style");

    /* Acima do aviso de reclamações novas, que mora no mesmo canto. */
    estilo.textContent = `
      :host { all: initial; }
      .caixa {
        position: fixed; left: 18px; bottom: 82px; z-index: 2147483646;
        width: 340px; max-width: calc(100vw - 36px);
        font: 13px/1.45 "CW Geist", system-ui, sans-serif;
        background: #fff; color: #1f1f24; border-radius: 14px; padding: 13px 14px;
        border: 1px solid #eadcf8;
        box-shadow: 0 14px 34px -14px rgba(40, 10, 70, .45);
      }
      .titulo { font-weight: 600; margin: 0 0 2px; }
      .sub { color: #6b6b76; font-size: 12px; margin: 0 0 8px; }
      dl { margin: 0 0 10px; display: grid; grid-template-columns: auto 1fr; gap: 3px 10px; font-size: 12px; }
      dt { color: #6b6b76; }
      dd { margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .acoes { display: flex; gap: 8px; }
      button { font: inherit; font-weight: 600; border-radius: 9px; padding: 7px 12px; cursor: pointer; }
      .sim { background: #5B2A86; color: #fff; border: 0; }
      .sim:hover { background: #7B3FBF; }
      .sim:disabled { opacity: .6; cursor: default; }
      .nao { background: transparent; color: #6b6b76; border: 1px solid #e4e4e7; }
      .ok { color: #15803d; font-weight: 600; margin: 0; }
      .erro { color: #b91c1c; margin: 0; }
      @media (prefers-color-scheme: dark) {
        .caixa { background: #1e1f25; color: #f1f1f4; border-color: #3b2e4d; }
        .sub, dt { color: #9a9ba5; }
        .nao { color: #c9c9d1; border-color: #31333c; }
        .ok { color: #4ade80; }
        .erro { color: #f87171; }
      }
    `;

    const caixa = document.createElement("div");
    caixa.className = "caixa";

    const titulo = document.createElement("p");
    titulo.className = "titulo";
    titulo.textContent = `No quadro, ${dados.protocolo} está sem ${dados.descricao}.`;

    const sub = document.createElement("p");
    sub.className = "sub";
    sub.textContent = "Esta página mostra — confira antes de gravar. Só entra o que está vazio no quadro.";

    const lista = document.createElement("dl");

    const linhas = [
      ["Nome", lida.cliente],
      ["Telefone", lida.telefone],
      ["E-mail", lida.email],
      ["CPF/CNPJ", lida.documento],
    ].filter(([, valor]) => valor);

    for (const [rotulo, valor] of linhas) {
      const dt = document.createElement("dt");
      dt.textContent = rotulo;
      const dd = document.createElement("dd");
      dd.textContent = valor;
      dd.title = valor;
      lista.append(dt, dd);
    }

    const acoes = document.createElement("div");
    acoes.className = "acoes";

    const sim = document.createElement("button");
    sim.type = "button";
    sim.className = "sim";
    sim.textContent = "Completar no quadro";

    const nao = document.createElement("button");
    nao.type = "button";
    nao.className = "nao";
    nao.textContent = "Agora não";

    nao.addEventListener("click", fecharCompletar);

    sim.addEventListener("click", async () => {

      sim.disabled = true;
      sim.textContent = "Gravando…";

      const resposta = await CW.enviar({
        tipo: "completarNoQuadro",
        dados: {
          cod: lida.cod,
          id: lida.id,
          cliente: lida.cliente,
          email: lida.email,
          telefone: lida.telefone,
          documento: lida.documento,
          cidade: lida.cidade,
          estado: lida.estado,
        },
      });

      const resultado = document.createElement("p");

      if (resposta?.ok && Array.isArray(resposta.dados?.completou)) {
        const completou = resposta.dados.completou;
        resultado.className = "ok";
        resultado.textContent = completou.length > 0
          ? `Completei ${juntar(completou)}. Pode fechar esta aba.`
          : "Nada a completar: o quadro já tinha esses dados.";
        setTimeout(fecharCompletar, 6000);
      } else {
        resultado.className = "erro";
        resultado.textContent = resposta?.erro ?? "Não deu para gravar agora.";
        sim.disabled = false;
        sim.textContent = "Tentar de novo";
      }

      acoes.replaceWith(resultado);
    });

    acoes.append(sim, nao);
    caixa.append(titulo, sub, lista, acoes);
    sombra.append(estilo, caixa);
  }

  /* ============================================================
     RECLAMAÇÕES NOVAS NA LISTA
  ============================================================ */

  /**
   * Quais reclamações desta página ainda não estão na plataforma.
   *
   * **O pedido.** "Preciso de uma forma de importar os casos do Reclame
   * Aqui sem o uso da API. Talvez a aplicação abrisse a página do
   * Reclame Aqui e verificasse se houve um novo caso."
   *
   * Quem abre a página é a pessoa, logada, no navegador dela — o
   * servidor não entra no portal, que é protegido contra robô e pediria
   * a senha. O que a extensão faz é o que qualquer um faria olhando a
   * lista: vê quais reclamações estão ali e confere se já estão no
   * quadro. A diferença é que confere todas, em um segundo.
   *
   * **Lê os links, não a lista.** A marcação das linhas muda sem aviso;
   * o link de cada reclamação carrega o código dela, porque é assim que
   * a lista funciona. `CW.ra.codigosDosLinks` é a regra, provada em
   * `check:ra` contra os endereços reais da base.
   *
   * **Esta varredura só avisa; quem grava é o vigia**, que lê a lista
   * pública quando a plataforma é aberta ou pelo botão "Ler o Reclame
   * Aqui" (`fundo/service-worker.js`, seção VIGIA). Por pedido do
   * Isaac, nada aqui dispara leitura sozinho — "somente quando eu abra a
   * plataforma".
   */
  let codigosPerguntados = "";
  let novos = [];
  let hospedeiroNovas = null;
  let listaAberta = false;

  /** Título de cada código, tirado do próprio link. */
  function titulosDosLinks() {

    const titulos = new Map();

    for (const a of document.querySelectorAll("a[href]")) {

      const [codigo] = CW.ra.codigosDosLinks([a.href]);

      if (!codigo || titulos.has(codigo)) continue;

      const texto = (
        a.getAttribute("title") ||
        a.textContent ||
        ""
      )
        .replace(/\s+/g, " ")
        .trim();

      titulos.set(codigo, {
        titulo: texto.slice(0, 110),
        href: a.href,
      });
    }

    return titulos;
  }

  async function varrerLista() {

    const titulos = titulosDosLinks();

    const codigos = [...titulos.keys()].sort();

    const chave = codigos.join(",");

    /* Mesma lista de antes: nada a perguntar. */
    if (chave === codigosPerguntados) return;

    codigosPerguntados = chave;

    if (codigos.length === 0) {
      novos = [];
      desenharNovas(titulos);
      return;
    }

    const resposta = await CW.enviar({
      tipo: "raNovas",
      codigos,
    });

    /* Falhou (sem sessão, fora do ar): cala, e tenta na próxima mudança. */
    if (!resposta.ok || !Array.isArray(resposta.dados?.novos)) {
      codigosPerguntados = "";
      return;
    }

    novos = resposta.dados.novos;

    desenharNovas(titulos);
  }

  /**
   * O aviso, montado com DOM e não com HTML em texto.
   *
   * O título vem da página do portal — é texto de consumidor. Com
   * `textContent` ele nunca vira marcação, e não depende de lembrar de
   * escapar.
   */
  function desenharNovas(titulos) {

    if (novos.length === 0) {
      hospedeiroNovas?.remove();
      hospedeiroNovas = null;
      listaAberta = false;
      return;
    }

    if (!hospedeiroNovas || !hospedeiroNovas.isConnected) {

      hospedeiroNovas = document.createElement("div");
      hospedeiroNovas.id = "cw-reputacao-novas";
      document.documentElement.appendChild(hospedeiroNovas);

      const sombra = hospedeiroNovas.attachShadow({ mode: "open" });

      const estilo = document.createElement("style");

      /* Canto oposto ao botão da gaveta, que fica à direita. */
      estilo.textContent = `
        :host { all: initial; }
        .caixa {
          position: fixed; left: 18px; bottom: 24px; z-index: 2147483646;
          font: 13px/1.4 "CW Geist", system-ui, sans-serif;
          max-width: 360px;
        }
        .pilula {
          display: flex; align-items: center; gap: 8px; cursor: pointer;
          border: 0; border-radius: 999px; padding: 9px 14px;
          background: #5B2A86; color: #fff; font: inherit; font-weight: 600;
          box-shadow: 0 8px 24px -8px rgba(40, 10, 70, .45);
        }
        .pilula:hover { background: #7B3FBF; }
        .ponto { width: 8px; height: 8px; border-radius: 50%; background: #F9A11B; }
        .lista {
          margin: 0 0 8px; padding: 6px; list-style: none;
          max-height: 320px; overflow-y: auto;
          background: #fff; color: #1f1f24; border-radius: 14px;
          box-shadow: 0 12px 32px -12px rgba(16, 24, 40, .35);
        }
        .lista li { display: flex; gap: 8px; align-items: center; padding: 7px 8px; border-radius: 9px; }
        .lista li:hover { background: #f4effb; }
        .titulo { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .abrir { color: #5B2A86; font-weight: 600; text-decoration: none; }
        .rodape { padding: 6px 8px 2px; color: #6b6b76; font-size: 11.5px; }
        @media (prefers-color-scheme: dark) {
          .lista { background: #1e1f25; color: #f1f1f4; }
          .lista li:hover { background: #2a2433; }
          .abrir { color: #c9a6f0; }
          .rodape { color: #9a9ba5; }
        }
      `;

      sombra.appendChild(estilo);

      const caixa = document.createElement("div");
      caixa.className = "caixa";
      sombra.appendChild(caixa);
    }

    const caixa =
      hospedeiroNovas.shadowRoot.querySelector(".caixa");

    caixa.replaceChildren();

    if (listaAberta) {

      const lista = document.createElement("ul");
      lista.className = "lista";

      for (const codigo of novos) {

        const dado = titulos.get(codigo);

        const item = document.createElement("li");

        const titulo = document.createElement("span");
        titulo.className = "titulo";
        titulo.textContent = dado?.titulo || codigo;
        titulo.title = dado?.titulo || codigo;

        const abrir = document.createElement("a");
        abrir.className = "abrir";
        abrir.textContent = "abrir";
        abrir.href = dado?.href ?? "#";

        item.append(titulo, abrir);
        lista.appendChild(item);
      }

      const rodape = document.createElement("li");
      rodape.className = "rodape";
      rodape.textContent =
        "Na plataforma, “Ler o Reclame Aqui” traz estas para o quadro. Ou abra uma e use “Criar no Kanban”.";
      lista.appendChild(rodape);

      caixa.appendChild(lista);
    }

    const pilula = document.createElement("button");
    pilula.type = "button";
    pilula.className = "pilula";

    const ponto = document.createElement("span");
    ponto.className = "ponto";

    const rotulo = document.createElement("span");
    rotulo.textContent =
      novos.length === 1
        ? "1 reclamação nesta página não está na plataforma"
        : `${novos.length} reclamações nesta página não estão na plataforma`;

    pilula.append(ponto, rotulo);

    pilula.addEventListener("click", () => {
      listaAberta = !listaAberta;
      desenharNovas(titulos);
    });

    caixa.appendChild(pilula);
  }

  /**
   * Voltar para a aba pergunta de novo.
   *
   * Enquanto a pessoa importava numa aba, esta continuava achando que
   * as reclamações eram novas. Esquecer a última pergunta ao voltar faz
   * a próxima volta do laço conferir com o banco de agora.
   */
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      codigosPerguntados = "";
    }
  });

  /**
   * Como reler sob demanda.
   *
   * O RA Forms nasce recolhido, e expandir não muda o endereço. Sem
   * isto, quem clicasse em "Exibir" depois de o painel ler continuaria
   * vendo "há informações adicionais não exibidas" para sempre.
   */
  CW.painel.definirReleitor(lerReclamacao);

  /**
   * E como entregar o texto cru, quando o leitor não achar nada.
   *
   * O portal decide a quebra de linha pelo layout: as mesmas etiquetas
   * podem chegar em uma linha ou em quatro, e um leitor certo para um
   * caso erra o outro. Copiar o texto que o navegador produziu é o que
   * transforma "não achou" em correção — em vez de mais um palpite.
   */
  CW.painel.definirDiagnostico(texto);

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

    /* A varredura tem rede própria: uma falha nela não cala o painel. */
    varrerLista().catch((erro) => {
      console.warn("[CW] varredura da lista falhou nesta volta", erro);
    });
  }

  setInterval(verificarComRede, INTERVALO);

  verificarComRede();
})();
