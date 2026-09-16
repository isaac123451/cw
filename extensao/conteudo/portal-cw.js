/**
 * Detector do Portal Cardápio Web.
 *
 * **Por que existe.** É o lugar onde a operação passa o dia olhando um
 * estabelecimento — e era o único dos lugares do documento em que a
 * pergunta "este cliente já reclamou?" exigia sair da tela, abrir a
 * plataforma e digitar de novo o que estava na frente. O painel responde
 * ali mesmo.
 *
 * **O identificador é o documento.** CPF ou CNPJ, nunca o nome: dois
 * estabelecimentos com nome parecido são a mesma loja em duas cidades
 * com a mesma frequência com que não são, e casar errado é pior do que
 * não casar. Nome e telefone vão junto só como reforço, quando o
 * documento não aparece na tela.
 *
 * **Não lê conteúdo.** Nada de pedido, de valor, de endereço do
 * consumidor. O que sai desta página é o identificador do
 * estabelecimento — o suficiente para perguntar, e nada além.
 */
(() => {
  const CW = window.CWReputacao;

  if (!CW?.painel) return;

  CW.painel.montar();

  const INTERVALO = 2500;

  /**
   * CNPJ e CPF com ou sem máscara.
   *
   * As âncoras `(?<!\d)` e `(?!\d)` existem pelo mesmo motivo do
   * `ra-campos.js`: sem elas um CPF casa **dentro** de um CNPJ, e o
   * painel sairia perguntando por um documento que não existe.
   */
  const RE_CNPJ =
    /(?<!\d)(\d{2})[.\s]?(\d{3})[.\s]?(\d{3})[/\s]?(\d{4})[-\s]?(\d{2})(?!\d)/;

  const RE_CPF =
    /(?<!\d)(\d{3})[.\s]?(\d{3})[.\s]?(\d{3})[-\s]?(\d{2})(?!\d)/;

  /** Rótulos que o portal usa para o documento, do mais explícito ao menos. */
  const ROTULOS = /(CNPJ|CPF\s*\/\s*CNPJ|CPF|Documento)\s*:?\s*$/i;

  function digitos(valor) {
    return String(valor ?? "").replace(/\D/g, "");
  }

  /**
   * O documento do estabelecimento na tela.
   *
   * Primeiro pelo rótulo — é a leitura que continua certa quando a
   * página passa a mostrar também o documento de outra coisa. Só depois,
   * a varredura do texto visível, que é o que salva quando o portal
   * troca a marcação (e ele troca).
   */
  function documentoNaTela() {

    /* 1. Pelo rótulo, no elemento vizinho. */
    for (const el of document.querySelectorAll("dt, th, label, .label, [class*='label' i]")) {

      const rotulo = CW.texto(el, 40);

      if (!ROTULOS.test(rotulo)) continue;

      const vizinho =
        el.nextElementSibling ??
        el.parentElement?.nextElementSibling ??
        null;

      const bruto = CW.texto(vizinho, 40);
      const achado = bruto.match(RE_CNPJ) ?? bruto.match(RE_CPF);

      if (achado) return digitos(achado[0]);
    }

    /* 2. No texto visível, priorizando o CNPJ. */
    return documentoDoTexto(document.body?.innerText ?? "");
  }

  /** O documento dentro de um texto visível — CNPJ antes de CPF. */
  function documentoDoTexto(bruto) {

    const texto = String(bruto ?? "")
      .replace(CW.INVISIVEIS, "")
      .slice(0, 6000);

    const achado = texto.match(RE_CNPJ) ?? texto.match(RE_CPF);

    return achado ? digitos(achado[0]) : "";
  }

  /**
   * O nome do estabelecimento, pelo maior título da tela.
   *
   * Vale como **rótulo**, não como chave de busca: é ele que aparece no
   * painel para a pessoa reconhecer de quem está falando.
   */
  function nomeNaTela() {

    for (const seletor of ["h1", "[class*='titulo' i]", "[class*='title' i]", "h2"]) {

      const texto = CW.texto(document.querySelector(seletor), 80);

      /* Um título de uma palavra genérica não identifica ninguém. */
      if (texto.length >= 3 && !/^(painel|dashboard|in[íi]cio|home|portal)$/i.test(texto)) {
        return texto;
      }
    }

    return "";
  }

  function telefoneNaTela() {

    const link = document.querySelector('a[href^="tel:"]');

    if (link) {
      const so = CW.digitos(link.getAttribute("href"));
      if (so.length >= 10) return so;
    }

    return "";
  }

  function emailNaTela() {

    const link = document.querySelector('a[href^="mailto:"]');

    const bruto = (link?.getAttribute("href") ?? "")
      .replace(/^mailto:/i, "")
      .split("?")[0]
      .trim();

    return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(bruto) ? bruto : "";
  }

  /** O leitor, exposto para a conferência (`check:lugares`). */
  CW.portal = { documentoDoTexto };

  let ultimaChave = "";

  function verificar() {

    CW.painel.garantir();

    const documento = documentoNaTela();
    const nome = nomeNaTela();
    const telefone = telefoneNaTela();
    const email = emailNaTela();

    const chave = `${documento}|${telefone}|${email}|${nome}`;

    if (chave === ultimaChave) return;

    ultimaChave = chave;

    /*
      Nada identificável na tela não é erro: o portal tem telas de lista
      e de configuração que não falam de nenhum estabelecimento. O painel
      diz isso, em vez de mostrar o cliente da tela anterior.
    */
    if (!documento && !telefone && !email) {
      CW.painel.definirContexto({
        canalDaPagina: "Portal Cardápio Web",
        nome,
        rotulo: nome
          ? `${nome} — sem CPF/CNPJ visível nesta tela`
          : "nenhum estabelecimento identificado nesta tela",
      });
      return;
    }

    CW.painel.definirContexto({
      canalDaPagina: "Portal Cardápio Web",
      documento,
      telefone,
      email,
      nome,
      rotulo: nome || documento || email || telefone,
    });
  }

  /**
   * O laço nunca deixa a página quebrar a ferramenta.
   *
   * Detector lê DOM alheio, e DOM alheio muda. Sem a rede, uma exceção
   * na primeira volta derrubava o próprio `setInterval` — e o painel
   * ficava montado e mudo.
   */
  function verificarComRede() {
    try {
      verificar();
    } catch (erro) {
      console.warn("[CW] detector do portal falhou nesta volta", erro);
    }
  }

  setInterval(verificarComRede, INTERVALO);

  verificarComRede();
})();
