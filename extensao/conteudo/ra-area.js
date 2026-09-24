/**
 * A extensão na área da empresa do Reclame Aqui.
 *
 * O Isaac: "dentro da área da empresa, quero algumas iniciativas que a
 * extensão possa fazer. Ela pode aparecer com algo, popup sei lá
 * resumindo a reclamação, fácil acesso para a reclamação em nova guia.
 * Pense em mais coisas também." Duas peças:
 *
 * 1. **O cartão da reclamação aberta** — flutuante, arrastável pelo
 *    topo, recolhível e sem desfoque, no canto de cima. Traz o resumo do
 *    relato (o que aconteceu, o que o cliente quer, os sinais de
 *    criticidade com o trecho e o tom), o caso no CW (prioridade, prazo,
 *    passo da vez, responsável, reincidência pelo CPF/CNPJ, réplica
 *    pendente, validação antes de responder) e os atalhos: abrir no CW,
 *    página pública e dossiê em nova guia, copiar o protocolo e o
 *    rascunho da resposta. Sem caso no CW, "Criar no quadro" abre a
 *    captura que o painel já tem.
 * 2. **Os selos da lista** — ao lado de cada reclamação, se ela já está
 *    no CW (prioridade e prazo) ou se é nova, e um ↗ para abrir a
 *    reclamação em nova guia.
 *
 * **O que ele não faz:** não responde, não clica em nada do portal e não
 * lê nada sozinho além da página que a pessoa abriu. A leitura da
 * reclamação é a do `hugme.js` (evento `cw:reclamacao-lida`) — o texto da
 * página não é lido duas vezes.
 *
 * As funções que montam HTML ficam em `CW.raArea` e são puras: o
 * `check:ra-area` as roda sem navegador. Todo texto de terceiro passa
 * por `CW.escapar`.
 */
(() => {
  const CW = window.CWReputacao;
  if (!CW || CW.raArea) return;

  const area = {};
  CW.raArea = area;

  const e = (valor) => CW.escapar(valor ?? "");

  const COR_DO_NIVEL = { Urgente: "urgente", Alta: "alta", Normal: "normal" };
  const COR_DO_PRAZO = { estourado: "perigo", atencao: "atencao", dentro: "ok", concluido: "neutro", "sem-regra": "neutro", "sem-registro": "neutro" };

  /** A reclamação na área da empresa, pelo código de 16 caracteres. */
  area.enderecoDaReclamacao = (codigo) =>
    /^[A-Za-z0-9_-]{16}$/.test(String(codigo ?? ""))
      ? `https://www.reclameaqui.com.br/area-da-empresa/reclamacoes/${codigo}/`
      : "";

  /** "2ª reclamação do mesmo CPF/CNPJ em 90 dias". */
  function reincidencia(n) {
    return n > 0 ? `${n + 1}ª reclamação do mesmo CPF/CNPJ em 90 dias` : "";
  }

  /* ============================================================
     O CARTÃO — HTML puro
  ============================================================ */

  /**
   * O corpo do cartão.
   *
   * `lida` é o que a página mostrou (código, título); `dados` é a
   * resposta de `/api/extensao/ra-cartao` — `null` enquanto carrega, e
   * `{ erro }` se o CW não respondeu.
   */
  area.htmlDoCartao = function htmlDoCartao(lida, dados, recolhido) {
    const codigo = lida?.cod || "";
    const caso = dados?.caso ?? null;
    const resumo = dados?.resumo ?? null;
    const nivel = caso?.prioridade || resumo?.nivel || "";

    const topo = `
      <header class="topo" data-arrastar title="Arraste para mudar de lugar">
        <span class="marca">CW</span>
        <b class="protocolo">${e(caso?.protocolo || (codigo ? `RA-${codigo}` : "Reclamação"))}</b>
        ${nivel ? `<span class="nivel ${e(COR_DO_NIVEL[nivel] || "normal")}">${e(nivel)}${caso && !caso.triada ? " · a triar" : ""}</span>` : ""}
        <span class="espaco"></span>
        <button type="button" data-acao="recolher" title="${recolhido ? "Abrir o cartão" : "Recolher"}" aria-label="${recolhido ? "Abrir o cartão" : "Recolher"}">${recolhido ? "+" : "–"}</button>
        <button type="button" data-acao="fechar" title="Fechar nesta reclamação" aria-label="Fechar">×</button>
      </header>`;

    if (recolhido) return topo;

    if (!dados) {
      return `${topo}<div class="corpo"><p class="sub">Lendo a reclamação e o CW…</p></div>`;
    }

    const partes = [];

    /* ---- o resumo ---- */
    if (resumo) {
      const sinais = (resumo.sinais ?? [])
        .map(
          (s) => `<li><span class="nivel ${e(COR_DO_NIVEL[s.nivel] || "normal")}">${e(s.nivel)}</span> ${e(s.texto)}${
            s.trecho ? `<span class="trecho">“${e(s.trecho)}”</span>` : ""
          }</li>`
        )
        .join("");
      partes.push(`
        <section>
          <h4>Resumo</h4>
          ${resumo.aconteceu ? `<p><em>Aconteceu</em> ${e(resumo.aconteceu)}</p>` : ""}
          <p><em>Quer</em> ${resumo.quer ? e(resumo.quer) : '<span class="sub">o relato não diz o que pede</span>'}</p>
          ${sinais ? `<ul class="sinais">${sinais}</ul>` : ""}
          <p class="sub">Tom: ${e(resumo.tom)} · ${Number(resumo.palavras) || 0} palavras</p>
        </section>`);
    }

    /* ---- o caso no CW ---- */
    if (caso) {
      const linhas = [];
      if (caso.replica) linhas.push('<p class="alerta">O consumidor respondeu — a vez é nossa (réplica).</p>');
      if (!caso.respondida && !caso.validado) {
        linhas.push('<p class="aviso">Antes de responder: o cliente ainda não confirmou a solução (Passo 6).</p>');
      }
      linhas.push(
        `<p>${caso.sla?.rotulo ? `<span class="prazo ${e(COR_DO_PRAZO[caso.sla.situacao] || "neutro")}">${e(caso.sla.rotulo)}</span> · ` : ""}${e(caso.status)}</p>`
      );
      if (caso.passo) linhas.push(`<p><em>Agora</em> passo ${Number(caso.passo.numero) || ""} — ${e(caso.passo.titulo)}</p>`);
      const extras = [
        caso.responsavel ? `Responsável: ${e(caso.responsavel)}` : "Sem responsável",
        caso.estabelecimento ? `Conta: ${e(caso.estabelecimento.nome)}${caso.estabelecimento.plano ? ` (${e(caso.estabelecimento.plano)})` : ""}` : "",
        e(reincidencia(Number(caso.reincidencia) || 0)),
        caso.avaliado ? `Avaliada${caso.nota !== null && caso.nota !== undefined ? ` com nota ${Number(caso.nota)}` : ""}` : "",
      ].filter(Boolean);
      linhas.push(`<p class="sub">${extras.join(" · ")}</p>`);
      partes.push(`<section><h4>No CW</h4>${linhas.join("")}</section>`);
    } else if (dados.erro) {
      partes.push(`<section><h4>No CW</h4><p class="sub">${e(dados.erro)}</p></section>`);
    } else {
      partes.push(`
        <section>
          <h4>No CW</h4>
          <p>Ainda não está no quadro.</p>
          <button type="button" class="principal" data-acao="criar">Criar no quadro</button>
        </section>`);
    }

    /* ---- os atalhos ---- */
    const atalhos = [
      caso?.url ? `<a href="${e(caso.url)}" target="_blank" rel="noopener" class="principal">Abrir no CW ↗</a>` : "",
      caso?.urlPortal ? `<a href="${e(caso.urlPortal)}" target="_blank" rel="noopener">Página pública ↗</a>` : "",
      caso?.urlDossie ? `<a href="${e(caso.urlDossie)}" target="_blank" rel="noopener">Dossiê ↗</a>` : "",
      codigo || caso?.protocolo ? `<button type="button" data-acao="copiar" data-texto="${e(caso?.protocolo || `RA-${codigo}`)}">Copiar protocolo</button>` : "",
      caso?.rascunho ? `<button type="button" data-acao="copiar" data-texto="${e(caso.rascunho)}">Copiar o rascunho do CW</button>` : "",
    ].filter(Boolean);
    if (atalhos.length) partes.push(`<div class="acoes">${atalhos.join("")}</div>`);

    return `${topo}<div class="corpo">${partes.join("")}</div>`;
  };

  /* ============================================================
     O SELO DA LISTA — HTML puro
  ============================================================ */

  /** O selo ao lado de uma reclamação da lista: no CW (prioridade e prazo) ou nova. */
  area.htmlDoSelo = function htmlDoSelo(codigo, info) {
    const nova = area.enderecoDaReclamacao(codigo);
    const abrir = nova
      ? `<a class="cw-selo-abrir" href="${e(nova)}" target="_blank" rel="noopener" title="Abrir esta reclamação em nova guia">↗</a>`
      : "";
    if (!info) {
      return `<span class="cw-selo cw-selo-nova" title="Esta reclamação ainda não está no CW">CW · nova</span>${abrir}`;
    }
    const prazo = info.sla?.situacao === "estourado" ? " · atrasada" : info.sla?.situacao === "atencao" ? " · vence logo" : "";
    return `<a class="cw-selo cw-selo-${e(COR_DO_NIVEL[info.prioridade] || "normal")}" href="${e(info.url)}" target="_blank" rel="noopener" title="${e(`No CW: ${info.protocolo}${info.passo ? ` — próximo: ${info.passo}` : ""}`)}">CW · ${e(info.prioridade)}${e(prazo)}</a>${abrir}`;
  };

  /*
    Sem página (a conferência roda as funções acima numa caixa), para aqui.
    Fora do portal, só na bancada local (`CW.bancada`, que só a própria
    bancada define — a página do portal não alcança o mundo da extensão).
  */
  const noPortal = typeof location !== "undefined" && /(^|\.)reclameaqui\.com\.br$|(^|\.)hugme\.com\.br$/.test(location.hostname);
  if (typeof document === "undefined" || !document.documentElement || (!noPortal && CW.bancada !== true)) return;

  /* ============================================================
     O CARTÃO — na página
  ============================================================ */

  const CHAVE_POSICAO = "cw-ra-cartao-posicao";
  const CHAVE_RECOLHIDO = "cw-ra-cartao-recolhido";

  let hospedeiro = null;
  let sombra = null;
  let lidaAtual = null;
  let dadosAtuais = null;
  const fechados = new Set();

  function lerLocal(chave, padrao) {
    try {
      const v = localStorage.getItem(chave);
      return v === null ? padrao : JSON.parse(v);
    } catch {
      return padrao;
    }
  }

  function gravarLocal(chave, valor) {
    try {
      localStorage.setItem(chave, JSON.stringify(valor));
    } catch {
      /* armazenamento bloqueado: o cartão só não lembra */
    }
  }

  const ESTILO = `
    :host { all: initial; }
    .cartao {
      position: fixed; z-index: 2147483645; width: 340px; max-width: calc(100vw - 24px);
      max-height: calc(100vh - 110px); display: flex; flex-direction: column;
      font: 12.5px/1.45 "CW Geist", system-ui, sans-serif; color: #1f1f24; background: #fff;
      border: 1px solid #e4dcf3; border-radius: 14px; box-shadow: 0 16px 40px -18px rgba(40, 10, 70, .45);
    }
    .topo { display: flex; align-items: center; gap: 6px; padding: 8px 10px; cursor: grab; border-bottom: 1px solid #f0ecf7; user-select: none; }
    .topo:active { cursor: grabbing; }
    .marca { font-weight: 700; font-size: 10.5px; color: #fff; background: #5B2A86; border-radius: 6px; padding: 2px 5px; }
    .protocolo { font-family: ui-monospace, monospace; font-size: 11.5px; }
    .espaco { flex: 1; }
    .topo button { font: inherit; width: 22px; height: 22px; border: 0; border-radius: 6px; background: transparent; color: #6b6b76; cursor: pointer; }
    .topo button:hover { background: #f4f1fa; color: #1f1f24; }
    .corpo { overflow-y: auto; padding: 8px 12px 12px; }
    section { margin-top: 6px; }
    h4 { margin: 8px 0 4px; font-size: 10.5px; letter-spacing: .06em; text-transform: uppercase; color: #8a8494; }
    p { margin: 0 0 5px; }
    em { font-style: normal; font-weight: 600; margin-right: 4px; }
    .sub { color: #6b6b76; font-size: 11.5px; }
    .sinais { list-style: none; margin: 4px 0 6px; padding: 0; display: grid; gap: 4px; }
    .trecho { display: block; color: #6b6b76; font-size: 11px; margin-top: 1px; }
    .nivel { font-size: 10.5px; font-weight: 600; border-radius: 5px; padding: 1px 6px; }
    .nivel.urgente { background: #ffe4e6; color: #9f1239; }
    .nivel.alta { background: #ffedd5; color: #9a3412; }
    .nivel.normal { background: #dcfce7; color: #166534; }
    .prazo { font-weight: 600; }
    .prazo.perigo { color: #be123c; } .prazo.atencao { color: #b45309; } .prazo.ok { color: #15803d; } .prazo.neutro { color: #6b6b76; }
    .alerta { background: #fff1f2; color: #9f1239; border-radius: 8px; padding: 6px 8px; font-weight: 600; }
    .aviso { background: #fffbeb; color: #92400e; border-radius: 8px; padding: 6px 8px; }
    .acoes { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
    .acoes a, .acoes button, section > button {
      font: inherit; font-size: 12px; font-weight: 600; text-decoration: none; cursor: pointer;
      border: 1px solid #e4e4e7; background: #fff; color: #3f3f46; border-radius: 9px; padding: 5px 9px;
    }
    .acoes a:hover, .acoes button:hover, section > button:hover { border-color: #c4b5fd; color: #5B2A86; }
    .principal { background: #5B2A86 !important; color: #fff !important; border-color: #5B2A86 !important; }
    .principal:hover { background: #7B3FBF !important; }
    @media (prefers-color-scheme: dark) {
      .cartao { background: #1e1f25; color: #f1f1f4; border-color: #3b2e4d; }
      .topo { border-color: #2c2a33; }
      .topo button:hover { background: #2c2a33; color: #fff; }
      .sub, .trecho, h4 { color: #9a9ba5; }
      .acoes a, .acoes button, section > button { background: #26272e; color: #e4e4e7; border-color: #3a3b44; }
      .aviso { background: #3a2a0c; color: #fbbf24; } .alerta { background: #3b1119; color: #fda4af; }
      .prazo.perigo { color: #fda4af; } .prazo.atencao { color: #fbbf24; } .prazo.ok { color: #4ade80; } .prazo.neutro { color: #9a9ba5; }
    }
  `;

  function montar() {
    if (hospedeiro?.isConnected) return;
    hospedeiro = document.createElement("div");
    hospedeiro.id = "cw-reputacao-ra-cartao";
    document.documentElement.appendChild(hospedeiro);
    sombra = hospedeiro.attachShadow({ mode: "open" });
    const estilo = document.createElement("style");
    estilo.textContent = ESTILO;
    const cartao = document.createElement("div");
    cartao.className = "cartao";
    sombra.append(estilo, cartao);

    const pos = lerLocal(CHAVE_POSICAO, null);
    posicionar(pos?.x ?? window.innerWidth - 360, pos?.y ?? 84);

    cartao.addEventListener("click", aoClicar);
    arrastavel(cartao);
  }

  function cartaoEl() {
    return sombra?.querySelector(".cartao");
  }

  function posicionar(x, y) {
    const c = cartaoEl();
    if (!c) return;
    const maxX = Math.max(8, window.innerWidth - 60);
    const maxY = Math.max(8, window.innerHeight - 40);
    c.style.left = `${Math.min(Math.max(8, x), maxX)}px`;
    c.style.top = `${Math.min(Math.max(8, y), maxY)}px`;
  }

  /** Arrasta pelo topo; a posição fica guardada neste navegador. */
  function arrastavel(cartao) {
    let inicio = null;
    cartao.addEventListener("pointerdown", (ev) => {
      if (!ev.target.closest?.("[data-arrastar]") || ev.target.closest("button")) return;
      const r = cartao.getBoundingClientRect();
      inicio = { dx: ev.clientX - r.left, dy: ev.clientY - r.top };
      cartao.setPointerCapture?.(ev.pointerId);
    });
    cartao.addEventListener("pointermove", (ev) => {
      if (inicio) posicionar(ev.clientX - inicio.dx, ev.clientY - inicio.dy);
    });
    cartao.addEventListener("pointerup", () => {
      if (!inicio) return;
      inicio = null;
      const r = cartao.getBoundingClientRect();
      gravarLocal(CHAVE_POSICAO, { x: Math.round(r.left), y: Math.round(r.top) });
    });
  }

  function desenhar() {
    if (!lidaAtual || fechados.has(lidaAtual.cod || lidaAtual.id)) {
      hospedeiro?.remove();
      hospedeiro = null;
      return;
    }
    montar();
    const c = cartaoEl();
    if (c) c.innerHTML = area.htmlDoCartao(lidaAtual, dadosAtuais, lerLocal(CHAVE_RECOLHIDO, false));
  }

  async function aoClicar(ev) {
    const alvo = ev.target.closest?.("[data-acao]");
    if (!alvo) return;
    const acao = alvo.dataset.acao;

    if (acao === "recolher") {
      gravarLocal(CHAVE_RECOLHIDO, !lerLocal(CHAVE_RECOLHIDO, false));
      desenhar();
    } else if (acao === "fechar") {
      fechados.add(lidaAtual?.cod || lidaAtual?.id);
      desenhar();
    } else if (acao === "criar") {
      const P = window.__cwPainel;
      P?.abrir?.();
      P?.abrirCaptura?.();
    } else if (acao === "copiar") {
      const original = alvo.textContent;
      try {
        await navigator.clipboard.writeText(alvo.dataset.texto ?? "");
        alvo.textContent = "Copiado";
      } catch {
        alvo.textContent = "Não copiou";
      }
      setTimeout(() => (alvo.textContent = original), 1400);
    }
  }

  let pedido = 0;

  async function carregar(lida) {
    const meu = ++pedido;
    dadosAtuais = null;
    desenhar();
    const resposta = await CW.enviar({
      tipo: "raCartao",
      corpo: { cod: lida.cod, id: lida.id, titulo: lida.titulo, relato: lida.texto },
    });
    if (meu !== pedido) return;
    dadosAtuais = resposta?.ok ? resposta.dados : { resumo: null, caso: null, erro: resposta?.erro || "O CW não respondeu agora." };
    desenhar();
  }

  /*
    A leitura é do hugme.js: ele avisa quando a reclamação aberta muda. A
    primeira leitura acontece antes deste arquivo carregar, então a última
    fica guardada em `CW.raUltimaLida` e é pega aqui ao começar.
  */
  function aoLer(lida) {
    if (!lida || (!lida.cod && !lida.id)) {
      lidaAtual = null;
      desenhar();
      return;
    }
    if (lidaAtual && (lidaAtual.cod || lidaAtual.id) === (lida.cod || lida.id)) return;
    lidaAtual = lida;
    carregar(lida).catch(() => undefined);
  }

  window.addEventListener("cw:reclamacao-lida", (ev) => aoLer(ev.detail));
  if (CW.raUltimaLida) aoLer(CW.raUltimaLida);

  /* ============================================================
     OS SELOS DA LISTA
  ============================================================ */

  const ESTILO_DOS_SELOS = `
    .cw-selo { display: inline-block; margin-left: 8px; padding: 1px 7px; border-radius: 6px; font: 600 11px/1.6 system-ui, sans-serif; text-decoration: none !important; vertical-align: middle; white-space: nowrap; }
    .cw-selo-nova { background: #ede9fe; color: #5b21b6; }
    .cw-selo-urgente { background: #ffe4e6; color: #9f1239; }
    .cw-selo-alta { background: #ffedd5; color: #9a3412; }
    .cw-selo-normal { background: #dcfce7; color: #166534; }
    .cw-selo-abrir { display: inline-block; margin-left: 4px; padding: 0 5px; border-radius: 6px; font: 600 12px/1.6 system-ui, sans-serif; color: #5B2A86 !important; text-decoration: none !important; vertical-align: middle; }
    .cw-selo-abrir:hover { background: #ede9fe; }
  `;

  function garantirEstiloDosSelos() {
    if (document.getElementById("cw-reputacao-selos")) return;
    const estilo = document.createElement("style");
    estilo.id = "cw-reputacao-selos";
    estilo.textContent = ESTILO_DOS_SELOS;
    document.head?.appendChild(estilo);
  }

  let consultados = "";
  let conhecidos = {};

  /** Os links de reclamação na lista, um por código (o primeiro, que costuma ser o título). */
  function linksDaLista() {
    const porCodigo = new Map();
    for (const a of document.querySelectorAll("a[href]")) {
      if (a.closest("#cw-reputacao-ra-cartao") || a.classList.contains("cw-selo") || a.classList.contains("cw-selo-abrir")) continue;
      const [codigo] = CW.ra?.codigosDosLinks?.([a.href]) ?? [];
      if (codigo && !porCodigo.has(codigo) && (a.innerText || "").trim().length > 8) porCodigo.set(codigo, a);
    }
    return porCodigo;
  }

  async function selarLista() {
    /* Numa reclamação aberta, o cartão faz o trabalho; os selos são da lista. */
    if (lidaAtual) return;
    const links = linksDaLista();
    if (links.size < 2) return;

    const codigos = [...links.keys()].sort().join(",");
    if (codigos !== consultados) {
      consultados = codigos;
      const resposta = await CW.enviar({ tipo: "raLista", codigos: [...links.keys()] });
      conhecidos = resposta?.ok ? (resposta.dados?.casos ?? {}) : {};
    }

    garantirEstiloDosSelos();
    for (const [codigo, a] of links) {
      if (a.dataset.cwSelo === "1" && a.nextElementSibling?.classList?.contains("cw-selo")) continue;
      a.dataset.cwSelo = "1";
      a.insertAdjacentHTML("afterend", area.htmlDoSelo(codigo, conhecidos[codigo]));
    }
  }

  setInterval(() => {
    selarLista().catch((erro) => console.warn("[CW] selos da lista falharam nesta volta", erro));
  }, 2500);
})();
