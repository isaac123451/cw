/**
 * O cartão do caso no WhatsApp (22/10/2026).
 *
 * O Isaac: "a parte que abre a tela no Reclame Aqui, podia abrir uma
 * também no WhatsApp conforme o caso... e precisa ser bem menor."
 *
 * Quando a conversa aberta é de um cliente com reclamação em aberto ou NPS
 * em andamento, aparece um cartão pequeno no canto (arrastável pelo topo,
 * sem desfoque): o que está aberto, o prazo e o que falta, cada linha
 * levando ao CW. O painel completo continua a um clique ("Painel").
 *
 * **Não consulta nada sozinho:** usa a mesma consulta que o painel já faz
 * ao trocar de conversa (`P.ultimoDado`). Some quando o painel está aberto
 * (seria repetido), quando a conversa não tem nada em aberto, quando a
 * pessoa fecha (vale para aquela conversa) e quando a opção está desligada.
 *
 * `CW.cartaoWhatsapp.html(dados)` é pura: o `check:cartao-whatsapp` a roda
 * sem navegador.
 */
(() => {
  const CW = (window.CWReputacao = window.CWReputacao || {});
  if (CW.cartaoWhatsapp) return;

  const e = (valor) => CW.escapar(valor ?? "");
  const COR_DO_NIVEL = { Urgente: "urgente", Alta: "alta", Normal: "normal" };
  const COR_DO_PRAZO = { estourado: "perigo", atencao: "atencao", dentro: "ok" };
  const ddmm = (dia) => (/^\d{4}-\d{2}-\d{2}/.test(String(dia || "")) ? `${dia.slice(8, 10)}/${dia.slice(5, 7)}` : "");

  /** O NPS em uma linha: nota, etapa e o que falta (1º contato ou tentativas). */
  function linhaDoNps(nps) {
    const falta = !nps.primeiroContatoEm
      ? `1º contato${nps.prazoPrimeiroContato ? ` até ${ddmm(nps.prazoPrimeiroContato)}` : ""}`
      : nps.tentativasMinimas && nps.tentativas < nps.tentativasMinimas
        ? `${Number(nps.tentativas) || 0}/${Number(nps.tentativasMinimas)} tentativas`
        : "";
    const tipo = nps.nota >= 9 ? "normal" : nps.nota >= 7 ? "alta" : "urgente";
    return `
      <div class="item">
        <p class="l1"><span class="nivel ${tipo}">NPS ${Number(nps.nota)}</span> ${e(nps.status)}</p>
        ${falta ? `<p class="l2">${e(falta)}</p>` : ""}
      </div>`;
  }

  /**
   * O HTML do cartão, ou "" quando não há nada em aberto para esta conversa.
   * `dados` é a resposta de `/api/extensao/contexto`.
   */
  function html(dados) {
    if (!dados) return "";
    const abertos = (dados.casos ?? []).filter((c) => c && c.aberto);
    const nps = dados.nps && !dados.nps.encerrado ? dados.nps : null;
    if (!abertos.length && !nps) return "";

    const nome = dados.cliente?.nome || dados.estabelecimento?.nome || nps?.cliente || "Cliente";
    const itens = abertos.slice(0, 2).map((c) => {
      const prazo = c.sla?.rotulo ? `<span class="prazo ${e(COR_DO_PRAZO[c.sla.situacao] || "neutro")}">${e(c.sla.rotulo)}</span> · ` : "";
      return `
        <a class="item" href="${e(c.url)}" target="_blank" rel="noopener" title="Abrir no CW">
          <p class="l1"><span class="nivel ${e(COR_DO_NIVEL[c.prioridade] || "normal")}">${e(c.prioridade || "Sem triagem")}</span> <span class="titulo">${e(c.titulo || c.protocolo)}</span></p>
          <p class="l2">${prazo}${e(c.status)}${c.respondido ? "" : " · sem resposta pública"}</p>
        </a>`;
    });
    if (abertos.length > 2) itens.push(`<p class="l2 mais-casos">+${abertos.length - 2} em aberto no painel</p>`);
    if (nps) itens.push(linhaDoNps(nps));

    const risco = Number(dados.risco) > 0 ? '<p class="risco">Risco de cancelar — tente reter.</p>' : "";

    return `
      <header class="topo" data-arrastar title="Arraste para mudar de lugar">
        <span class="marca">CW</span>
        <b class="nome">${e(nome)}</b>
        <span class="espaco"></span>
        <button type="button" data-acao="painel" title="Abrir o painel completo">Painel</button>
        <button type="button" data-acao="fechar" class="x" title="Fechar nesta conversa" aria-label="Fechar">×</button>
      </header>
      <div class="corpo">${itens.join("")}${risco}</div>`;
  }

  CW.cartaoWhatsapp = { html };

  /* ============================================================
     NA PÁGINA
  ============================================================ */

  const P = CW.painel;
  if (typeof document === "undefined" || !document.documentElement || !P) return;

  const CHAVE_POSICAO = "cw-whats-cartao-posicao";

  const ESTILO = `
    :host { all: initial; }
    .cartao {
      position: fixed; z-index: 2147483640; width: 244px; max-width: calc(100vw - 24px);
      font: 12px/1.4 "CW Geist", system-ui, sans-serif; color: #1f1f24; background: #fff;
      border: 1px solid #e4dcf3; border-radius: 12px; box-shadow: 0 12px 30px -16px rgba(40, 10, 70, .4);
      overflow: hidden;
    }
    .topo { display: flex; align-items: center; gap: 6px; padding: 6px 7px 6px 8px; cursor: grab; border-bottom: 1px solid #f0ecf7; user-select: none; }
    .topo:active { cursor: grabbing; }
    .marca { font-weight: 700; font-size: 10px; color: #fff; background: #5B2A86; border-radius: 5px; padding: 1px 4px; }
    .nome { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; font-size: 12px; }
    .espaco { flex: 1; }
    .topo button { font: inherit; font-size: 11px; font-weight: 600; height: 20px; border: 0; border-radius: 6px; background: #f4f1fa; color: #5B2A86; cursor: pointer; padding: 0 7px; }
    .topo button.x { background: transparent; color: #6b6b76; width: 20px; padding: 0; font-size: 14px; }
    .topo button:hover { background: #ede9fe; color: #1f1f24; }
    .corpo { padding: 4px 6px 6px; display: grid; grid-template-columns: minmax(0, 1fr); gap: 2px; }
    .item { display: block; padding: 4px 4px; border-radius: 7px; text-decoration: none; color: inherit; }
    a.item:hover { background: #f7f5fb; }
    p { margin: 0; }
    .l1 { display: flex; align-items: center; gap: 5px; min-width: 0; }
    .titulo { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; font-weight: 600; }
    .l2 { color: #6b6b76; font-size: 11px; margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .mais-casos { padding: 0 4px; }
    .nivel { flex: none; font-size: 10px; font-weight: 600; border-radius: 5px; padding: 0 5px; }
    .nivel.urgente { background: #ffe4e6; color: #9f1239; }
    .nivel.alta { background: #ffedd5; color: #9a3412; }
    .nivel.normal { background: #dcfce7; color: #166534; }
    .prazo { font-weight: 600; }
    .prazo.perigo { color: #be123c; } .prazo.atencao { color: #b45309; } .prazo.ok { color: #15803d; }
    .risco { margin: 2px 4px 0; padding: 3px 6px; border-radius: 6px; background: #fff1f2; color: #9f1239; font-size: 11px; font-weight: 600; }
    .cartao.escuro { background: #1f2c33; color: #e9edef; border-color: #33424b; }
    .escuro .topo { border-color: #2a3942; }
    .escuro .topo button { background: #2a3942; color: #d9c8f0; }
    .escuro .topo button.x { background: transparent; color: #8696a0; }
    .escuro .topo button:hover { background: #33424b; color: #fff; }
    .escuro a.item:hover { background: #2a3942; }
    .escuro .l2 { color: #8696a0; }
    .escuro .prazo.perigo { color: #fda4af; } .escuro .prazo.atencao { color: #fbbf24; } .escuro .prazo.ok { color: #4ade80; }
    .escuro .risco { background: #3b1119; color: #fda4af; }
  `;

  let hospedeiro = null;
  let sombra = null;
  let ultimoHtml = "";
  let dadosVistos = null;
  const fechados = new Set();

  function lerLocal(chave) {
    try {
      return JSON.parse(localStorage.getItem(chave) || "null");
    } catch {
      return null;
    }
  }

  function cartaoEl() {
    return sombra?.querySelector(".cartao");
  }

  function posicionar(x, y) {
    const c = cartaoEl();
    if (!c) return;
    c.style.left = `${Math.min(Math.max(8, x), Math.max(8, window.innerWidth - (c.offsetWidth || 244) - 8))}px`;
    c.style.top = `${Math.min(Math.max(8, y), Math.max(8, window.innerHeight - 60))}px`;
  }

  function montar() {
    if (hospedeiro?.isConnected) return;
    hospedeiro = document.createElement("div");
    hospedeiro.id = "cw-reputacao-whats-cartao";
    document.documentElement.appendChild(hospedeiro);
    sombra = hospedeiro.attachShadow({ mode: "open" });
    const estilo = document.createElement("style");
    estilo.textContent = ESTILO;
    const cartao = document.createElement("div");
    cartao.className = "cartao";
    sombra.append(estilo, cartao);
    ultimoHtml = "";

    const pos = lerLocal(CHAVE_POSICAO);
    posicionar(pos?.x ?? window.innerWidth - 264, pos?.y ?? 72);

    cartao.addEventListener("click", (ev) => {
      const alvo = ev.target.closest?.("[data-acao]");
      if (!alvo) return;
      if (alvo.dataset.acao === "fechar") fechados.add(P.chaveConsulta);
      if (alvo.dataset.acao === "painel") P.abrir?.();
      tirar();
    });

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
      try {
        localStorage.setItem(CHAVE_POSICAO, JSON.stringify({ x: Math.round(r.left), y: Math.round(r.top) }));
      } catch {
        /* armazenamento bloqueado: o cartão só não lembra o lugar */
      }
    });
  }

  function tirar() {
    hospedeiro?.remove();
    hospedeiro = null;
    ultimoHtml = "";
  }

  /*
    Uma olhada a cada 1,5 s no que o painel já sabe — barato, e sem
    observar a árvore do WhatsApp, que muda o tempo todo.
  */
  function olhar() {
    const desligado = P.config?.cartaoNoWhatsapp === false;
    const dados = P.vista === "contato" ? P.ultimoDado : null;
    const conteudo = desligado || P.aberto || fechados.has(P.chaveConsulta) ? "" : html(dados);
    if (!conteudo) {
      if (hospedeiro) tirar();
      return;
    }
    montar();
    const c = cartaoEl();
    c.classList.toggle("escuro", document.body?.classList.contains("dark") === true);
    if (conteudo !== ultimoHtml || dados !== dadosVistos) {
      c.innerHTML = conteudo;
      ultimoHtml = conteudo;
      dadosVistos = dados;
    }
  }

  setInterval(olhar, 1500);
})();
