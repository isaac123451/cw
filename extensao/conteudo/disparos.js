/**
 * Disparos em lote seguros, no WhatsApp Web (1.78).
 *
 * A lista nasce na plataforma (Prêmio, Pedir avaliação). Aqui, uma
 * conversa por vez: a extensão abre a conversa com a mensagem já
 * escrita (o próprio WhatsApp preenche pelo endereço `send?phone=&text=`),
 * **a pessoa aperta Enter**, a extensão vê a mensagem sair, registra o
 * envio e espera ~40 s antes da próxima. A cada 10, para e espera um
 * clique. Pausar e parar a qualquer momento.
 *
 * **O que este arquivo não faz: enviar.** Nenhum clique no botão de
 * enviar, nenhuma tecla simulada. É a regra da extensão desde o começo e
 * é o que protege o número: o WhatsApp derruba conta que dispara sozinha.
 *
 * O estado mora no `sessionStorage` da aba, porque abrir cada conversa
 * recarrega o WhatsApp Web — a fila continua de onde estava.
 */
(() => {
  const CW = (window.CWReputacao = window.CWReputacao || {});
  const esc = (v) => (CW.escapar ? CW.escapar(v) : String(v ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`));

  /* ------------------------------------------------------------------ */
  /* A parte pura: o que o painel diz em cada fase.                       */
  /* ------------------------------------------------------------------ */

  function sortearIntervalo(faixa, sorteio = Math.random()) {
    const [min, max] = faixa && faixa.length === 2 ? faixa : [35, 50];
    return Math.round(min + (max - min) * sorteio);
  }

  function textoDaFase(estado, atual, agora = Date.now()) {
    const nome = atual?.nome ? esc(atual.nome) : "o contato";
    switch (estado?.fase) {
      case "abrindo":
        return `Abrindo a conversa de <b>${nome}</b>…`;
      case "esperando":
        return `Confira e <b>aperte Enter</b> para enviar a ${nome}.`;
      case "sem-texto":
        return `O texto saiu do campo sem ser enviado. Escreva de novo ou pule.`;
      case "intervalo": {
        const s = Math.max(0, Math.ceil(((estado.ateEm ?? agora) - agora) / 1000));
        return `Enviado. Próxima conversa em <b>${s} s</b>.`;
      }
      case "pausa-lote":
        return `Lote de ${esc(estado.porLote ?? 10)} enviado. Respire — continue quando quiser.`;
      case "pausa":
        return "Pausado.";
      default:
        return "Pronto para começar. Uma conversa por vez; quem envia é você.";
    }
  }

  function htmlDoPainel(estado, lote, agora = Date.now()) {
    if (!lote) return "";
    const atual = (lote.proximos || []).find((p) => p.id === estado?.itemId) || null;
    const feitos = (lote.enviados || 0) + (lote.pulados || 0);
    const fase = estado?.fase || "parado";
    const botoes = [];
    if (fase === "parado" || fase === "pausa-lote" || fase === "pausa") {
      botoes.push(`<button class="principal" data-acao="comecar">${fase === "parado" ? "Começar" : "Continuar"}</button>`);
    }
    if (fase === "esperando" || fase === "sem-texto" || fase === "abrindo") botoes.push(`<button data-acao="pular">Pular</button>`);
    if (fase === "sem-texto") botoes.push(`<button data-acao="escrever">Escrever de novo</button>`);
    if (fase === "intervalo" || fase === "esperando") botoes.push(`<button data-acao="pausar">Pausar</button>`);
    botoes.push(`<button class="discreto" data-acao="parar">Parar a lista</button>`);
    return `
      <header class="topo" data-arrastar title="Arraste para mudar de lugar">
        <span class="marca">CW</span>
        <strong class="titulo">Disparos · ${esc(lote.nome)}</strong>
      </header>
      <div class="corpo">
        <p class="progresso">${esc(feitos)} de ${esc(lote.total)} · ${esc(lote.enviados)} enviados${lote.pulados ? ` · ${esc(lote.pulados)} pulados` : ""}</p>
        <p class="lote">Neste lote: ${esc(estado?.noLote ?? 0)} de ${esc(lote.porLote ?? 10)}</p>
        <p class="fase">${textoDaFase({ ...estado, porLote: lote.porLote }, atual, agora)}</p>
        <div class="acoes">${botoes.join("")}</div>
      </div>`;
  }

  CW.disparos = { sortearIntervalo, textoDaFase, htmlDoPainel };

  /* ------------------------------------------------------------------ */
  /* A parte da página: só no WhatsApp Web.                               */
  /* ------------------------------------------------------------------ */

  if (location.hostname !== "web.whatsapp.com" && CW.bancada !== true) return;
  if (!chrome?.runtime?.id) return;

  const CHAVE = "cw-disparo";
  const CHAVE_POSICAO = "cw-disparo-posicao";
  const CAMPOS = ['footer [contenteditable="true"][role="textbox"]', '#main footer [contenteditable="true"]', 'footer [contenteditable="true"]'];
  const NOSSAS = '[data-icon="msg-check"], [data-icon="msg-dblcheck"], [data-icon="msg-dblcheck-ack"], [data-icon="msg-time"], .message-out';

  let lote = null;
  let hospedeiro = null;
  let sombra = null;

  const ler = () => {
    try {
      return JSON.parse(sessionStorage.getItem(CHAVE) || "null") || { fase: "parado", noLote: 0 };
    } catch {
      return { fase: "parado", noLote: 0 };
    }
  };
  const gravar = (estado) => {
    try {
      sessionStorage.setItem(CHAVE, JSON.stringify(estado));
    } catch {
      /* sem armazenamento, a fila não sobrevive à recarga — o painel avisa ao abrir */
    }
  };
  const limpar = () => {
    try {
      sessionStorage.removeItem(CHAVE);
    } catch {
      /* nada */
    }
  };

  const campo = () => CAMPOS.map((s) => document.querySelector(s)).find(Boolean) || null;
  const textoDoCampo = () => (campo()?.innerText || "").trim();
  const saidas = () => document.querySelectorAll(`#main ${NOSSAS.split(", ").join(", #main ")}`).length;
  const normal = (t) => String(t || "").replace(/s+/g, " ").trim().toLowerCase();
  /** A última mensagem da conversa começa como a nossa? É a outra prova de que saiu. */
  function ultimaEhANossa(mensagem) {
    const linhas = document.querySelectorAll("#main [data-id], #main [role=\"row\"]");
    const ultima = linhas[linhas.length - 1];
    const trecho = normal(mensagem).slice(0, 24);
    return Boolean(ultima && trecho && normal(ultima.innerText).includes(trecho) && ultima.querySelector(NOSSAS));
  }

  async function servidor(acao, extra = {}) {
    const r = await CW.enviar({ tipo: "disparos", acao, ...extra });
    if (r?.dados?.erro) {
      CW.notificar?.(r.dados.erro, "erro");
      return null;
    }
    lote = r?.dados?.lote ?? null;
    return lote;
  }

  const ESTILO = `
    :host { all: initial; }
    .painel { position: fixed; z-index: 2147483645; width: 300px; font: 12.5px/1.45 "CW Geist", system-ui, sans-serif; color: #1f1f24; background: #fff;
      border: 1px solid #e4dcf3; border-radius: 14px; box-shadow: 0 16px 40px -18px rgba(40, 10, 70, .45); }
    .topo { display: flex; align-items: center; gap: 6px; padding: 8px 10px; cursor: grab; border-bottom: 1px solid #f0ecf7; user-select: none; }
    .marca { font-weight: 700; font-size: 10.5px; color: #fff; background: #5B2A86; border-radius: 6px; padding: 2px 5px; }
    .titulo { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .corpo { padding: 8px 12px 12px; }
    p { margin: 0 0 4px; }
    .progresso { font-weight: 600; }
    .lote { color: #6b6b76; font-size: 11.5px; }
    .fase { margin-top: 6px; }
    .acoes { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
    button { font: inherit; font-size: 12px; font-weight: 600; cursor: pointer; border: 1px solid #e4e4e7; background: #fff; color: #3f3f46; border-radius: 9px; padding: 5px 9px; }
    button:hover { border-color: #c4b5fd; color: #5B2A86; }
    .principal { background: #5B2A86; color: #fff; border-color: #5B2A86; }
    .principal:hover { background: #7B3FBF; color: #fff; }
    .discreto { border-color: transparent; color: #8a8494; }
    @media (prefers-color-scheme: dark) {
      .painel { background: #1e1f25; color: #f1f1f4; border-color: #3b2e4d; }
      .topo { border-color: #2c2a33; } .lote { color: #9a9ba5; }
      button { background: #26272e; color: #e4e4e7; border-color: #3a3b44; }
      .principal { background: #5B2A86; color: #fff; border-color: #5B2A86; }
    }
  `;

  function desenhar() {
    if (!lote) {
      hospedeiro?.remove();
      hospedeiro = null;
      return;
    }
    if (!hospedeiro?.isConnected) {
      hospedeiro = document.createElement("div");
      hospedeiro.id = "cw-reputacao-disparos";
      document.documentElement.appendChild(hospedeiro);
      sombra = hospedeiro.attachShadow({ mode: "open" });
      const estilo = document.createElement("style");
      estilo.textContent = ESTILO;
      const painel = document.createElement("div");
      painel.className = "painel";
      sombra.append(estilo, painel);
      let pos = null;
      try {
        pos = JSON.parse(localStorage.getItem(CHAVE_POSICAO) || "null");
      } catch {
        pos = null;
      }
      painel.style.left = `${Math.min(pos?.x ?? window.innerWidth - 330, window.innerWidth - 60)}px`;
      painel.style.top = `${Math.min(pos?.y ?? 90, window.innerHeight - 60)}px`;
      painel.addEventListener("click", aoClicar);
      arrastavel(painel);
    }
    sombra.querySelector(".painel").innerHTML = htmlDoPainel(ler(), lote);
  }

  function arrastavel(painel) {
    let inicio = null;
    painel.addEventListener("pointerdown", (ev) => {
      if (!ev.target.closest?.("[data-arrastar]") || ev.target.closest("button")) return;
      const r = painel.getBoundingClientRect();
      inicio = { dx: ev.clientX - r.left, dy: ev.clientY - r.top };
      painel.setPointerCapture?.(ev.pointerId);
    });
    painel.addEventListener("pointermove", (ev) => {
      if (!inicio) return;
      painel.style.left = `${Math.max(8, Math.min(ev.clientX - inicio.dx, window.innerWidth - 60))}px`;
      painel.style.top = `${Math.max(8, Math.min(ev.clientY - inicio.dy, window.innerHeight - 40))}px`;
    });
    painel.addEventListener("pointerup", () => {
      if (!inicio) return;
      inicio = null;
      const r = painel.getBoundingClientRect();
      try {
        localStorage.setItem(CHAVE_POSICAO, JSON.stringify({ x: Math.round(r.left), y: Math.round(r.top) }));
      } catch {
        /* só não lembra a posição */
      }
    });
  }

  /** Abre a conversa do próximo pendente — o WhatsApp recarrega e a fila segue daqui. */
  function abrirProximo() {
    const proximo = (lote?.proximos || [])[0];
    const estado = ler();
    if (!proximo) {
      limpar();
      CW.notificar?.("Lista concluída.", "ok");
      servidor("ler").then(desenhar);
      return;
    }
    gravar({ ...estado, fase: "abrindo", itemId: proximo.id, loteId: lote.id, desde: Date.now() });
    location.href = `https://web.whatsapp.com/send?phone=${encodeURIComponent(proximo.telefone)}&text=${encodeURIComponent(proximo.mensagem)}`;
  }

  async function marcar(acao, motivo) {
    const estado = ler();
    if (!estado.itemId) return;
    await servidor(acao, { itemId: estado.itemId, motivo });
  }

  async function aoClicar(ev) {
    const alvo = ev.target.closest?.("[data-acao]");
    if (!alvo) return;
    const acao = alvo.dataset.acao;
    const estado = ler();
    if (acao === "comecar") {
      if (lote?.situacao === "pausado") await servidor("retomar", { loteId: lote.id });
      gravar({ ...estado, noLote: estado.fase === "pausa-lote" ? 0 : estado.noLote || 0 });
      abrirProximo();
    } else if (acao === "pular") {
      await marcar("pulado", "pulado por quem disparava");
      gravar({ ...ler(), fase: "intervalo", ateEm: Date.now() + 3000, itemId: null });
      desenhar();
    } else if (acao === "pausar") {
      await servidor("pausar", { loteId: lote.id });
      gravar({ ...ler(), fase: "pausa" });
      desenhar();
    } else if (acao === "parar") {
      if (!window.confirm("Parar a lista? Os que faltam não serão enviados.")) return;
      await servidor("parar", { loteId: lote.id });
      limpar();
      desenhar();
    } else if (acao === "escrever") {
      const atual = (lote?.proximos || []).find((p) => p.id === estado.itemId);
      const c = campo();
      if (atual && c) {
        c.focus();
        document.execCommand("insertText", false, atual.mensagem);
        gravar({ ...ler(), fase: "esperando", base: saidas() });
        desenhar();
      }
    }
  }

  /** O relógio da fila: meio segundo por volta, só lendo a página. */
  async function volta() {
    const estado = ler();
    if (!lote) return;

    if (estado.fase === "abrindo") {
      const dialogo = [...document.querySelectorAll('[role="dialog"], [data-animate-modal-popup="true"]')].find((d) => /inv[aá]lid|invalid/i.test(d.innerText || ""));
      if (dialogo) {
        await marcar("pulado", "número inválido no WhatsApp");
        gravar({ ...ler(), fase: "intervalo", ateEm: Date.now() + 4000, itemId: null });
      } else if (textoDoCampo()) {
        gravar({ ...estado, fase: "esperando", base: saidas() });
      } else if (Date.now() - (estado.desde || 0) > 45000) {
        gravar({ ...estado, fase: "sem-texto" });
      }
    } else if (estado.fase === "esperando") {
      if (!textoDoCampo()) {
        const atual = (lote?.proximos || []).find((p) => p.id === estado.itemId);
        if (saidas() > (estado.base ?? 0) || (atual && ultimaEhANossa(atual.mensagem))) {
          const noLote = (estado.noLote || 0) + 1;
          await marcar("enviado");
          const porLote = lote?.porLote ?? 10;
          gravar(
            noLote >= porLote
              ? { ...ler(), fase: "pausa-lote", noLote, itemId: null }
              : { ...ler(), fase: "intervalo", noLote, itemId: null, ateEm: Date.now() + sortearIntervalo(lote?.intervalo) * 1000 }
          );
        } else if (!estado.vazioDesde) {
          gravar({ ...estado, vazioDesde: Date.now() });
        } else if (Date.now() - estado.vazioDesde > 5000) {
          gravar({ ...estado, fase: "sem-texto", vazioDesde: null });
        }
      } else if (estado.vazioDesde) {
        gravar({ ...estado, vazioDesde: null });
      }
    } else if (estado.fase === "intervalo" && Date.now() >= (estado.ateEm || 0)) {
      await servidor("ler");
      abrirProximo();
      return;
    }
    desenhar();
  }

  async function iniciar() {
    await servidor("ler");
    if (!lote) {
      limpar();
      return;
    }
    desenhar();
    setInterval(() => void volta(), 500);
  }

  /* Espera o WhatsApp Web carregar a lista de conversas antes de ler a fila. */
  const espera = setInterval(() => {
    if (document.querySelector("#pane-side, #side, [data-testid='chat-list']")) {
      clearInterval(espera);
      void iniciar();
    }
  }, 1000);
})();
