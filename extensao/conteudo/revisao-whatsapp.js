/**
 * A revisão da mensagem enquanto se escreve no WhatsApp Web (22/10/2026).
 *
 * "Quando digitar alguma coisa no WhatsApp, a extensão me ajude com uma
 * resposta, corrija a frase... coisas que podem piorar a relação com o
 * cliente, dicas do que responder até para reter."
 *
 * Duas camadas:
 * - **na hora, sem IA**: ao parar de digitar, as regras de
 *   `revisao-regras.js` apontam erro comum (com a troca pronta), o que
 *   piora a relação, prazo prometido e o cancelamento facilitado;
 * - **"Melhorar com IA"**: a IA reescreve com a mesma intenção, lendo a
 *   conversa e o que o time aprendeu, e diz o risco e a dica de retenção.
 *
 * Nada é enviado: "Usar este texto" troca o que está na caixa, e quem manda
 * é a pessoa, com Enter. O painel mora numa sombra própria e só se redesenha
 * quando o conteúdo muda — redesenhar sem mudar atrapalhava selecionar e
 * copiar (lição de 22/10).
 */
(() => {
  const CW = window.CWReputacao;
  if (!CW?.revisaoDaMensagem || window.__cwRevisaoWhatsapp) return;
  window.__cwRevisaoWhatsapp = true;

  const ONDE_ESCREVE = [
    'footer [contenteditable="true"][role="textbox"]',
    '#main footer [contenteditable="true"]',
    '[data-testid="conversation-compose-box-input"]',
    'footer [contenteditable="true"]',
  ];
  const ESPERA_MS = 800;

  let caixaAtual = null;
  const ligadas = new WeakSet();
  let espera = null;
  let host = null;
  let raiz = null;
  let ultimoHtml = "";
  let dispensadoPara = "";
  let ia = { para: "", pedindo: false, revisao: null, erro: "" };

  /* A chave mora na configuração da extensão — a tela de opções liga de novo. */
  const desligada = () => CW.painel?.config?.revisaoDaMensagem === false;

  function caixa() {
    for (const seletor of ONDE_ESCREVE) {
      const achado = document.querySelector(seletor);
      if (achado) return achado;
    }
    return null;
  }

  const textoDaCaixa = (el) => (el?.innerText || "").replace(/ /g, " ").trim();

  function mensagensDaTela() {
    try {
      const leitura = CW.painel?.lerConversa?.();
      return (Array.isArray(leitura) ? leitura : leitura?.mensagens ?? [])
        .filter((m) => m && typeof m.texto === "string" && m.texto.trim())
        .slice(-12)
        .map((m) => ({ de: m.de === "nos" ? "nos" : "cliente", texto: m.texto.slice(0, 500) }));
    } catch {
      return [];
    }
  }

  function montar() {
    if (host?.isConnected) return;
    host = document.createElement("div");
    host.id = "cw-revisao-whatsapp";
    document.documentElement.appendChild(host);
    raiz = host.attachShadow({ mode: "open" });
    raiz.innerHTML = `<style>
      :host { all: initial; }
      .painel { position: fixed; z-index: 2147482990; box-sizing: border-box; max-height: 46vh; overflow: auto;
        font: 13px/1.45 "CW Geist", ui-sans-serif, system-ui, -apple-system, sans-serif; color: var(--t); background: var(--f);
        border: 1px solid var(--b); border-radius: 12px; box-shadow: 0 10px 28px -10px rgba(16,24,40,.35); padding: 10px 12px; }
      .claro { --f: #fff; --t: #27272a; --s: #71717a; --b: #e4e4e7; --sutil: #f4f4f5; }
      .escuro { --f: #1f2329; --t: #e9edef; --s: #9aa4ab; --b: #313a41; --sutil: #2a3036; }
      .topo { display: flex; align-items: center; gap: 8px; }
      .marca { font: 600 10px/1 ui-monospace, monospace; letter-spacing: .06em; color: var(--s); }
      .titulo { font-weight: 600; }
      .fechar { margin-left: auto; border: 0; background: transparent; color: var(--s); cursor: pointer; font-size: 15px; line-height: 1; padding: 2px 4px; border-radius: 6px; }
      .fechar:hover { background: var(--sutil); }
      ul { margin: 6px 0 0; padding: 0; list-style: none; }
      li { display: flex; gap: 6px; margin-top: 4px; }
      .ponto { flex: 0 0 auto; width: 7px; height: 7px; border-radius: 50%; margin-top: 6px; }
      .perigo { background: #e11d48; } .atencao { background: #d97706; } .ok { background: #16a34a; } .neutro { background: #a1a1aa; }
      .troca { color: var(--s); }
      .troca b { color: var(--t); font-weight: 600; }
      .retencao { margin-top: 8px; padding: 7px 9px; border-radius: 8px; background: var(--sutil); }
      .retencao b { font-weight: 600; }
      .revisado { margin-top: 8px; padding: 8px 10px; border-radius: 8px; border: 1px solid var(--b); white-space: pre-wrap; }
      .risco { display: inline-block; font-size: 11px; font-weight: 600; border-radius: 999px; padding: 1px 8px; margin-left: 4px; }
      .risco.alto { background: #fee2e2; color: #9f1239; } .risco.medio { background: #fef3c7; color: #92400e; } .risco.baixo { background: #dcfce7; color: #166534; }
      .acoes { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; align-items: center; }
      button.acao { border: 1px solid var(--b); background: var(--f); color: var(--t); border-radius: 8px; padding: 4px 10px; font: inherit; font-weight: 500; cursor: pointer; }
      button.acao:hover { background: var(--sutil); }
      button.principal { background: #7c3aed; border-color: #7c3aed; color: #fff; }
      button.principal:hover { background: #6d28d9; }
      button.acao:disabled { opacity: .55; cursor: default; }
      .discreto { margin-left: auto; border: 0; background: transparent; color: var(--s); font: inherit; font-size: 11.5px; cursor: pointer; text-decoration: underline; }
      .pilula { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; }
    </style><div class="painel" hidden></div>`;
    CW.registrarFonte?.();
    raiz.querySelector(".painel").addEventListener("click", aoClicar);
    /* Clicar no painel não pode tirar o foco da caixa de escrita do WhatsApp. */
    raiz.querySelector(".painel").addEventListener("mousedown", (e) => {
      if (e.target.closest("button")) e.preventDefault();
    });
  }

  function painel() {
    montar();
    return raiz.querySelector(".painel");
  }

  function esconder() {
    const p = raiz?.querySelector(".painel");
    if (p && !p.hidden) p.hidden = true;
    ultimoHtml = "";
  }

  function posicionar(p, el) {
    const r = el.getBoundingClientRect();
    const largura = Math.min(Math.max(r.width, 320), 560);
    p.style.width = `${largura}px`;
    p.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - largura - 8))}px`;
    p.style.bottom = `${Math.max(8, window.innerHeight - r.top + 10)}px`;
    const escuro = document.body.classList.contains("dark") || matchMedia("(prefers-color-scheme: dark)").matches;
    p.className = `painel ${escuro ? "escuro" : "claro"}`;
  }

  const esc = (t) => (CW.escapar ? CW.escapar(t) : String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]));

  function desenhar(el, texto, r) {
    const temAlgo = r.correcoes.length || r.avisos.length || r.retencao;
    const iaDeste = ia.para === texto ? ia : null;
    let html = "";
    if (!temAlgo && !iaDeste) {
      /* Nada a apontar: só a pílula para pedir a IA, sem ocupar espaço. */
      html = `<div class="topo pilula"><span class="marca">CW</span><span class="troca">Nada a apontar.</span>
        <button class="acao principal" data-acao="ia">Melhorar com IA</button><button class="fechar" data-acao="fechar" title="Esconder até a próxima mensagem">×</button></div>`;
    } else {
      const partes = [`<div class="topo"><span class="marca">CW</span><span class="titulo">Revisão da mensagem</span><button class="fechar" data-acao="fechar" title="Esconder até a próxima mensagem">×</button></div>`];
      if (r.correcoes.length) {
        partes.push(`<ul><li><span class="ponto neutro"></span><span class="troca">${r.correcoes.slice(0, 4).map((c) => `${esc(c.de.trim())} → <b>${esc(c.para.trim())}</b>`).join(" · ")}</span></li></ul>`);
      }
      if (r.avisos.length) partes.push(`<ul>${r.avisos.slice(0, 4).map((a) => `<li><span class="ponto ${a.tom}"></span><span>${esc(a.texto)}</span></li>`).join("")}</ul>`);
      if (r.retencao) partes.push(`<div class="retencao"><b>Para reter:</b> ${esc(r.retencao)}</div>`);
      if (iaDeste?.revisao) {
        const v = iaDeste.revisao;
        partes.push(
          `<div class="revisado">${esc(v.texto)}</div>` +
            `<div class="acoes"><span>Risco do rascunho:<span class="risco ${v.risco}">${v.risco === "medio" ? "médio" : v.risco}</span></span></div>` +
            (v.pontos?.length ? `<ul>${v.pontos.map((p) => `<li><span class="ponto ok"></span><span>${esc(p)}</span></li>`).join("")}</ul>` : "") +
            (v.retencao && !r.retencao ? `<div class="retencao"><b>Para reter:</b> ${esc(v.retencao)}</div>` : "")
        );
      } else if (iaDeste?.erro) {
        partes.push(`<ul><li><span class="ponto atencao"></span><span>${esc(iaDeste.erro)}</span></li></ul>`);
      }
      const botoes = [];
      if (r.correcoes.length && r.corrigido !== texto) botoes.push(`<button class="acao" data-acao="corrigir">Aplicar as correções</button>`);
      if (iaDeste?.revisao && !iaDeste.revisao.igual) botoes.push(`<button class="acao principal" data-acao="usar">Usar este texto</button><button class="acao" data-acao="copiar">Copiar</button>`);
      else botoes.push(`<button class="acao principal" data-acao="ia" ${iaDeste?.pedindo ? "disabled" : ""}>${iaDeste?.pedindo ? "Revisando…" : "Melhorar com IA"}</button>`);
      botoes.push(`<button class="discreto" data-acao="desligar" title="Liga de novo nas opções da extensão">Desligar a revisão</button>`);
      partes.push(`<div class="acoes">${botoes.join("")}</div>`);
      html = partes.join("");
    }
    const p = painel();
    posicionar(p, el);
    if (html !== ultimoHtml) {
      p.innerHTML = html;
      ultimoHtml = html;
    }
    if (p.hidden) p.hidden = false;
  }

  function revisarAgora() {
    const el = caixa();
    if (!el || desligada()) return esconder();
    const texto = textoDaCaixa(el);
    if (texto.length < 8) {
      dispensadoPara = "";
      return esconder();
    }
    if (dispensadoPara && texto.startsWith(dispensadoPara.slice(0, 20))) return esconder();
    dispensadoPara = "";
    desenhar(el, texto, CW.revisaoDaMensagem.revisar(texto, mensagensDaTela()));
  }

  /** Troca o texto da caixa do WhatsApp — o editor dele aceita `insertText`. */
  function trocarTexto(novo) {
    const el = caixa();
    if (!el) return;
    el.focus();
    document.execCommand("selectAll", false);
    document.execCommand("insertText", false, novo);
  }

  async function pedirIA() {
    const el = caixa();
    const texto = textoDaCaixa(el);
    if (!texto) return;
    ia = { para: texto, pedindo: true, revisao: null, erro: "" };
    revisarAgora();
    const conversa = mensagensDaTela();
    /* O que as regras já acharam vai junto: a IA parte disso, e o risco não fica abaixo. */
    const avisos = CW.revisaoDaMensagem.revisar(texto, conversa).avisos;
    const r = await CW.enviar({ tipo: "melhorarMensagem", texto, mensagens: conversa, nome: CW.painel?.consulta?.nome ?? "", avisos }).catch(() => null);
    if (ia.para !== texto) return;
    if (r?.ok && r.dados?.ok && r.dados.revisao) ia = { para: texto, pedindo: false, revisao: r.dados.revisao, erro: "" };
    else ia = { para: texto, pedindo: false, revisao: null, erro: r?.dados?.erro || r?.erro || "A IA não respondeu agora. As dicas acima continuam valendo." };
    revisarAgora();
  }

  async function aoClicar(e) {
    const acao = e.target.closest("[data-acao]")?.dataset.acao;
    if (!acao) return;
    const el = caixa();
    const texto = textoDaCaixa(el);
    if (acao === "fechar") {
      dispensadoPara = texto;
      esconder();
    } else if (acao === "desligar") {
      if (CW.painel) CW.painel.config = { ...(CW.painel.config ?? {}), revisaoDaMensagem: false };
      CW.enviar({ tipo: "salvar", parcial: { revisaoDaMensagem: false } });
      esconder();
      CW.notificar?.("Revisão das mensagens desligada. Liga de novo nas opções da extensão.");
    } else if (acao === "corrigir") {
      trocarTexto(CW.revisaoDaMensagem.revisar(texto, []).corrigido);
    } else if (acao === "ia") {
      void pedirIA();
    } else if (acao === "usar" && ia.revisao) {
      trocarTexto(ia.revisao.texto);
    } else if (acao === "copiar" && ia.revisao) {
      await navigator.clipboard?.writeText(ia.revisao.texto).catch(() => undefined);
      e.target.textContent = "Copiado";
    }
  }

  function aoDigitar() {
    clearTimeout(espera);
    espera = setTimeout(revisarAgora, ESPERA_MS);
    /* Mandou (a caixa esvaziou): o painel some na hora, sem esperar. */
    if (!textoDaCaixa(caixaAtual)) esconder();
  }

  function ligar() {
    const el = caixa();
    if (!el) {
      esconder();
      return;
    }
    if (el !== caixaAtual) {
      caixaAtual = el;
      esconder();
    }
    if (ligadas.has(el)) return;
    ligadas.add(el);
    el.addEventListener("input", aoDigitar);
    el.addEventListener("keyup", (e) => {
      if (e.key === "Enter" && !textoDaCaixa(el)) esconder();
    });
  }

  /* O WhatsApp troca a caixa ao mudar de conversa: uma varredura barata acha a nova. */
  setInterval(() => {
    try {
      ligar();
      /* A janela mudou de tamanho ou a caixa cresceu: o painel acompanha. */
      const p = raiz?.querySelector(".painel");
      if (p && !p.hidden && caixaAtual) posicionar(p, caixaAtual);
    } catch (erro) {
      console.warn("[CW] revisão da mensagem", erro);
    }
  }, 1500);
})();
