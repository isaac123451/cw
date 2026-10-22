/**
 * A revisão da mensagem enquanto se escreve no WhatsApp Web (22/10/2026).
 *
 * "Quando digitar alguma coisa no WhatsApp, a extensão me ajude com uma
 * resposta, corrija a frase... coisas que podem piorar a relação com o
 * cliente, dicas do que responder até para reter."
 *
 * Mínima por padrão (refeita em 22/10 — "está muito grande, precisa ser bem
 * menor"): uma pílula de 24 px no canto direito, logo acima da caixa de
 * escrita — "● 2 ajustes", "● Reter cliente" ou só "✦" quando não há nada.
 * O balão só abre quando a pessoa clica, com uma linha por ponto e as ações
 * como links curtos.
 *
 * Duas camadas: na hora, sem IA (`revisao-regras.js`); e "Melhorar com IA",
 * que reescreve com a mesma intenção. Nada é enviado: "Usar" troca o texto
 * da caixa, e quem manda é a pessoa. Mora numa sombra própria, não rouba o
 * foco da caixa e só se redesenha quando o conteúdo muda (lição de 22/10:
 * redesenhar sem mudar atrapalhava selecionar e copiar).
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
  const ESPERA_MS = 700;
  const ESPACO_DURO = new RegExp(String.fromCharCode(160), "g");

  let caixaAtual = null;
  const ligadas = new WeakSet();
  let espera = null;
  let raiz = null;
  let ultimoHtml = "";
  let aberto = false;
  let dispensadoPara = "";
  let estado = null;
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

  const textoDaCaixa = (el) => (el?.innerText || "").replace(ESPACO_DURO, " ").trim();
  const esc = (t) => (CW.escapar ? CW.escapar(t) : String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]));

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

  const ESTILO = `
    :host { all: initial; }
    .raiz { position: fixed; z-index: 2147482990; display: flex; flex-direction: column; align-items: flex-end; gap: 6px;
      font: 12px/1.4 "CW Geist", ui-sans-serif, system-ui, -apple-system, sans-serif; color: var(--t); }
    .claro { --f: #fff; --t: #27272a; --s: #71717a; --b: #e4e4e7; --h: #f4f4f5; }
    .escuro { --f: #233138; --t: #e9edef; --s: #8696a0; --b: #34434b; --h: #2a3942; }
    .pilula { display: inline-flex; align-items: center; gap: 5px; height: 24px; padding: 0 9px; border-radius: 999px; cursor: pointer;
      background: var(--f); color: var(--t); border: 1px solid var(--b); box-shadow: 0 2px 8px -3px rgba(0,0,0,.25); font: inherit; font-weight: 500; }
    .pilula:hover { background: var(--h); }
    .pilula.so-icone { width: 24px; padding: 0; justify-content: center; color: var(--s); opacity: .7; }
    .pilula.so-icone:hover { opacity: 1; }
    .ponto { width: 7px; height: 7px; border-radius: 50%; flex: 0 0 auto; }
    .perigo { background: #e11d48; } .atencao { background: #f59e0b; } .neutro { background: #a1a1aa; } .ok { background: #22c55e; } .reter { background: #7c3aed; }
    .balao { width: 320px; max-height: 260px; display: flex; flex-direction: column; box-sizing: border-box; padding: 8px 10px; border-radius: 10px;
      background: var(--f); border: 1px solid var(--b); box-shadow: 0 8px 24px -8px rgba(0,0,0,.35); }
    .conteudo { overflow: auto; min-height: 0; }
    .linha { display: flex; gap: 6px; align-items: flex-start; padding: 3px 0; }
    .linha .ponto { margin-top: 5px; }
    .sutil { color: var(--s); }
    b { font-weight: 600; }
    .revisado { margin: 6px 0 2px; padding: 6px 8px; border-radius: 7px; background: var(--h); white-space: pre-wrap; max-height: 110px; overflow: auto; }
    .acoes { display: flex; gap: 12px; align-items: center; margin-top: 6px; padding-top: 6px; border-top: 1px solid var(--b); }
    .acoes button, .link { border: 0; background: none; padding: 0; font: inherit; font-weight: 600; color: #7c3aed; cursor: pointer; }
    .escuro .acoes button, .escuro .link { color: #b9a4f5; }
    .acoes button:hover, .link:hover { text-decoration: underline; }
    .acoes .fim { margin-left: auto; color: var(--s); font-weight: 500; }
    .risco { font-weight: 600; }
    .risco.alto { color: #e11d48; } .risco.medio { color: #d97706; } .risco.baixo { color: #16a34a; }
  `;

  function montar() {
    if (raiz?.host?.isConnected) return;
    const host = document.createElement("div");
    host.id = "cw-revisao-whatsapp";
    document.documentElement.appendChild(host);
    raiz = host.attachShadow({ mode: "open" });
    raiz.innerHTML = `<style>${ESTILO}</style><div class="raiz" hidden></div>`;
    CW.registrarFonte?.();
    const r = raiz.querySelector(".raiz");
    r.addEventListener("click", aoClicar);
    /* Clicar aqui não tira o foco da caixa de escrita do WhatsApp. */
    r.addEventListener("mousedown", (e) => {
      if (e.target.closest("button")) e.preventDefault();
    });
  }

  function caixaDaRaiz() {
    montar();
    return raiz.querySelector(".raiz");
  }

  function esconder() {
    const r = raiz?.querySelector(".raiz");
    if (r && !r.hidden) r.hidden = true;
    ultimoHtml = "";
    aberto = false;
  }

  function posicionar(r, el) {
    const box = el.getBoundingClientRect();
    r.style.right = `${Math.max(8, window.innerWidth - box.right)}px`;
    r.style.bottom = `${Math.max(8, window.innerHeight - box.top + 6)}px`;
    /* O tema do WhatsApp (classe no body), não o do sistema: a página clara com o Windows escuro saía com a pílula escura. */
    const escuro = document.body.classList.contains("dark");
    r.classList.toggle("escuro", escuro);
    r.classList.toggle("claro", !escuro);
  }

  /** O pior tom entre os pontos — a cor da pílula. */
  function piorTom(r) {
    if (r.avisos.some((a) => a.tom === "perigo")) return "perigo";
    if (r.avisos.length) return "atencao";
    if (r.correcoes.length) return "neutro";
    if (r.retencao) return "reter";
    return "";
  }

  function htmlDaPilula(r, iaDeste) {
    const n = r.avisos.length + (r.correcoes.length ? 1 : 0);
    if (iaDeste?.revisao) return `<button class="pilula" data-acao="alternar" title="Revisão da IA pronta"><span class="ponto ok"></span>Revisão pronta</button>`;
    if (iaDeste?.pedindo) return `<button class="pilula" data-acao="alternar"><span class="ponto neutro"></span>Revisando…</button>`;
    if (n) return `<button class="pilula" data-acao="alternar" title="O que a revisão achou nesta mensagem"><span class="ponto ${piorTom(r)}"></span>${n} ${n === 1 ? "ajuste" : "ajustes"}</button>`;
    if (r.retencao) return `<button class="pilula" data-acao="alternar" title="O cliente falou em sair"><span class="ponto reter"></span>Reter cliente</button>`;
    return `<button class="pilula so-icone" data-acao="ia" title="Melhorar com IA">✦</button>`;
  }

  function htmlDoBalao(texto, r, iaDeste) {
    const linhas = [];
    const v = iaDeste?.revisao;
    if (v && !v.igual) {
      /* Com a revisão da IA pronta, só ela: os avisos que ela já resolveu não se repetem. */
      linhas.push(`<div class="revisado">${esc(v.texto)}</div>`);
      linhas.push(`<div class="sutil">Risco do seu texto: <span class="risco ${v.risco}">${v.risco === "medio" ? "médio" : v.risco}</span>${v.pontos?.length ? ` · ${esc(v.pontos[0])}` : ""}</div>`);
    } else {
      if (r.correcoes.length) {
        linhas.push(
          `<div class="linha"><span class="ponto neutro"></span><span>${r.correcoes
            .slice(0, 4)
            .map((c) => `<span class="sutil">${esc(c.de.trim())}</span> → <b>${esc(c.para.trim())}</b>`)
            .join(", ")} · <button class="link" data-acao="corrigir">aplicar</button></span></div>`
        );
      }
      for (const a of r.avisos.slice(0, 4)) linhas.push(`<div class="linha"><span class="ponto ${a.tom}"></span><span>${esc(a.texto)}</span></div>`);
      const retencao = r.retencao || v?.retencao;
      if (retencao) linhas.push(`<div class="linha"><span class="ponto reter"></span><span><b>Reter:</b> ${esc(retencao)}</span></div>`);
      if (v?.igual) linhas.push(`<div class="linha"><span class="ponto ok"></span><span>A IA não mudaria nada.</span></div>`);
      if (iaDeste?.erro) linhas.push(`<div class="linha"><span class="ponto atencao"></span><span>${esc(iaDeste.erro)}</span></div>`);
    }
    const acoes = [];
    if (v && !v.igual) acoes.push(`<button data-acao="usar">Usar este texto</button><button data-acao="copiar">Copiar</button>`);
    else acoes.push(`<button data-acao="ia" ${iaDeste?.pedindo ? "disabled" : ""}>${iaDeste?.pedindo ? "Revisando…" : "Melhorar com IA"}</button>`);
    acoes.push(`<button class="fim" data-acao="fechar" title="Esconder até a próxima mensagem">Fechar</button>`);
    /* As ações ficam fora da rolagem: o "Usar este texto" sumia embaixo do texto longo. */
    return `<div class="balao"><div class="conteudo">${linhas.join("") || `<div class="linha sutil">Nada a apontar nesta mensagem.</div>`}</div><div class="acoes">${acoes.join("")}</div></div>`;
  }

  function desenhar() {
    const el = caixaAtual;
    if (!el || !estado) return;
    const { texto, r } = estado;
    const iaDeste = ia.para === texto ? ia : null;
    const html = `${aberto ? htmlDoBalao(texto, r, iaDeste) : ""}${htmlDaPilula(r, iaDeste)}`;
    const raizEl = caixaDaRaiz();
    posicionar(raizEl, el);
    if (html !== ultimoHtml) {
      raizEl.innerHTML = html;
      ultimoHtml = html;
    }
    if (raizEl.hidden) raizEl.hidden = false;
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
    caixaAtual = el;
    estado = { texto, r: CW.revisaoDaMensagem.revisar(texto, mensagensDaTela()) };
    desenhar();
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
    aberto = true;
    revisarAgora();
    const conversa = mensagensDaTela();
    /* O que as regras já acharam vai junto: a IA parte disso, e o risco não fica abaixo. */
    const avisos = CW.revisaoDaMensagem.revisar(texto, conversa).avisos;
    const r = await CW.enviar({ tipo: "melhorarMensagem", texto, mensagens: conversa, nome: CW.painel?.consulta?.nome ?? "", avisos }).catch(() => null);
    if (ia.para !== texto) return;
    ia =
      r?.ok && r.dados?.ok && r.dados.revisao
        ? { para: texto, pedindo: false, revisao: r.dados.revisao, erro: "" }
        : { para: texto, pedindo: false, revisao: null, erro: r?.dados?.erro || r?.erro || "A IA não respondeu agora." };
    revisarAgora();
  }

  async function aoClicar(e) {
    const botao = e.target.closest("[data-acao]");
    const acao = botao?.dataset.acao;
    if (!acao) return;
    const texto = textoDaCaixa(caixa());
    if (acao === "alternar") {
      aberto = !aberto;
      desenhar();
    } else if (acao === "fechar") {
      dispensadoPara = texto;
      esconder();
    } else if (acao === "corrigir") {
      trocarTexto(CW.revisaoDaMensagem.revisar(texto, []).corrigido);
    } else if (acao === "ia") {
      void pedirIA();
    } else if (acao === "usar" && ia.revisao) {
      trocarTexto(ia.revisao.texto);
      aberto = false;
    } else if (acao === "copiar" && ia.revisao) {
      await navigator.clipboard?.writeText(ia.revisao.texto).catch(() => undefined);
      botao.textContent = "Copiado";
    }
  }

  function aoDigitar() {
    clearTimeout(espera);
    espera = setTimeout(revisarAgora, ESPERA_MS);
    /* Mandou (a caixa esvaziou): some na hora. */
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
    /* A digitação vem pelo ouvinte da página; aqui só o Enter que esvazia a caixa. */
    el.addEventListener("keyup", (e) => {
      if (e.key === "Enter" && !textoDaCaixa(el)) esconder();
    });
  }

  /*
    A digitação é ouvida na página inteira (22/10/2026): ligar só na
    varredura de 1,5 s perdia a mensagem de quem começava a escrever logo ao
    abrir a conversa — e a revisão "não aparecia". Qualquer tecla na caixa de
    escrita já conta.
  */
  document.addEventListener(
    "input",
    (e) => {
      const el = caixa();
      if (!el || !(e.target === el || el.contains(e.target))) return;
      if (el !== caixaAtual) {
        caixaAtual = el;
        esconder();
      }
      aoDigitar();
    },
    true
  );

  /* O WhatsApp troca a caixa ao mudar de conversa: uma varredura barata acha a nova. */
  setInterval(() => {
    try {
      ligar();
      const r = raiz?.querySelector(".raiz");
      if (r && !r.hidden && caixaAtual) posicionar(r, caixaAtual);
    } catch (erro) {
      console.warn("[CW] revisão da mensagem", erro);
    }
  }, 1500);
})();
