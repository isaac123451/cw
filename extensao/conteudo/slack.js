/**
 * Slack — a mensagem do canal vira atendimento das Redes.
 *
 * **O pedido.** "E também casos do Slack." A automação e o time avisam as
 * menções num canal; cada aviso era copiado para o formulário das Redes.
 *
 * **Sem token e sem administrador.** Nada de app instalado no Slack: a
 * extensão lê o que já está na tela de quem abriu o canal, pelo
 * navegador. Cada mensagem ganha, ao passar o mouse, um "Redes"; e o
 * lançador no canto lê o canal.
 *
 * **Só no clique, em dois tempos.** O primeiro clique mostra o que foi
 * entendido (rede, perfil, seguidores, link) e se o caso já está no CW;
 * só "Gravar" cria. A leitura do texto mora na aplicação
 * (`itemDoSlack`), a mesma para a mensagem solta e para o canal inteiro.
 *
 * **O que mudou em 1.134** — "lê o que tava aparecendo, informa que já
 * leu tudo, e quando vou carregar mensagens mais antigas ela acaba já
 * apontando como lida mas não leu". Duas causas:
 *
 * 1. O Slack só mantém na página o pedaço visível do histórico (a lista é
 *    virtual). "Ler o canal" mandava o que estava na tela no instante do
 *    clique — rolar para cima depois trazia mensagens que nunca tinham
 *    ido. Agora a extensão **junta** cada mensagem que passa na tela
 *    (observando a página, não só a cada 2 s), e a leitura manda todas as
 *    juntadas, em lotes. E diz o que leu: quantas, de quando a quando — e
 *    que as mais antigas que isso ainda não foram lidas.
 * 2. A marca de "feito" ficava no elemento da página, e o Slack reaproveita
 *    o elemento quando rola: a mensagem antiga entrava no lugar da lida e
 *    herdava a marca. Agora a marca segue a mensagem (o `ts`), guardada na
 *    extensão — o elemento reaproveitado é reconhecido e redesenhado.
 */
(() => {
  const CW = window.CWReputacao;

  if (!CW || !CW.painelDeCaptura) return;

  const PAINEL = "cw-captura-slack";
  const LANCADOR = "cw-captura-slack-botao";
  const MARCA = "data-cw-slack";
  const POR_LOTE = 200;
  const GUARDADAS = 3000;

  /* O ts do Slack: segundos e microssegundos, a identidade da mensagem. */
  const TS = /^\d{9,11}\.\d{6}$/;

  const canalAtual = () => location.pathname.match(/\/client\/[A-Z0-9]+\/([CG][A-Z0-9]{6,})/)?.[1] ?? "";

  function nomeDoCanal() {
    const el = document.querySelector('[data-qa="channel_name"], [data-qa="channel_header_title"] button, .p-view_header__channel_title');
    return CW.texto(el, 60) || "canal";
  }

  function lerMensagem(el, canal) {
    const ts = el.getAttribute("data-item-key");
    const blocos = el.querySelectorAll('[data-qa="message-text"], .c-message_kit__blocks, .p-rich_text_section');
    const alvo = blocos[0] ?? null;
    if (!alvo) return null;
    const texto = (alvo.innerText ?? "").replace(/ /g, " ").trim().slice(0, 4000);
    if (!texto) return null;
    const links = [...alvo.querySelectorAll("a[href]")].map((a) => a.href).filter((h) => /^https?:/.test(h)).slice(0, 10);
    /* As menções (@Carlos Isaac): é a quem vai atender, não o perfil do cliente — o servidor tira do texto. */
    const mencoes = [...alvo.querySelectorAll('[data-stringify-type="mention"], .c-member_slug, [data-member-id]')]
      .map((m) => (m.innerText ?? "").trim())
      .filter(Boolean)
      .slice(0, 10);
    return {
      canal,
      ts,
      texto,
      links,
      mencoes,
      quando: new Date(Number(ts.split(".")[0]) * 1000).toISOString(),
      elemento: el,
    };
  }

  const corpoDe = (mensagens) => mensagens.map(({ canal, ts, texto, links, mencoes, quando }) => ({ canal, ts, texto, links, mencoes, quando }));

  /* ============================================================
     O QUE JÁ PASSOU NA TELA, E O QUE JÁ ESTÁ NO CW
  ============================================================ */

  /** As mensagens que passaram na tela neste canal, desde que ele foi aberto. */
  let canalJuntado = "";
  const juntadas = new Map();

  /** Os `ts` que já estão no CW, por canal — guardados na extensão, não no elemento da página. */
  const noCw = new Map();

  function chaveGuardada(canal) {
    return `cwSlackNoCw:${canal}`;
  }

  async function carregarNoCw(canal) {
    if (noCw.has(canal)) return noCw.get(canal);
    const conjunto = new Set();
    noCw.set(canal, conjunto);
    try {
      const guardado = await chrome.storage.local.get(chaveGuardada(canal));
      for (const ts of guardado[chaveGuardada(canal)] ?? []) conjunto.add(ts);
    } catch {
      /* Sem a memória da extensão, a marca volta na próxima leitura — o servidor é quem sabe. */
    }
    return conjunto;
  }

  async function marcarNoCw(canal, lista) {
    if (!lista.length) return;
    const conjunto = await carregarNoCw(canal);
    for (const ts of lista) conjunto.add(ts);
    try {
      await chrome.storage.local.set({ [chaveGuardada(canal)]: [...conjunto].sort().slice(-GUARDADAS) });
    } catch {
      /* idem */
    }
    desenharMarcas();
  }

  /** O ts que cada elemento mostrava na última leitura — para não reler o texto à toa. */
  const lidoNoElemento = new WeakMap();

  /** Junta as mensagens que estão na página agora. */
  function juntar() {
    const canal = canalAtual();
    if (!canal) return;
    if (canal !== canalJuntado) {
      canalJuntado = canal;
      juntadas.clear();
      carregarNoCw(canal).then(desenharMarcas);
    }
    for (const el of document.querySelectorAll("[data-item-key]")) {
      const ts = el.getAttribute("data-item-key") ?? "";
      if (!TS.test(ts)) continue;
      /* Ler o texto força o navegador a medir a página: só quando o elemento mostra outra mensagem. */
      if (lidoNoElemento.get(el) === ts && juntadas.has(ts)) continue;
      const m = lerMensagem(el, canal);
      if (m) lidoNoElemento.set(el, ts);
      if (!m) continue;
      const antes = juntadas.get(m.ts);
      /* Texto que ainda estava carregando chega mais curto: fica o mais completo. */
      if (!antes || m.texto.length >= antes.texto.length) juntadas.set(m.ts, m);
    }
    atualizarLancador();
  }

  const ordenadas = () => [...juntadas.values()].sort((a, b) => Number(a.ts) - Number(b.ts));

  /* ============================================================
     O PAINEL
  ============================================================ */

  function contagem(c) {
    const cel = (n, rotulo) => `<div><b>${Number(n) || 0}</b><span>${CW.escapar(rotulo)}</span></div>`;
    return `<div class="numeros">${cel(c.nova, "novas")}${cel(c.existente, "já no CW")}${cel(c.duplicada, "repetidas")}${cel(c["sem-rede"], "sem rede")}</div>`;
  }

  function lotes(lista) {
    const saida = [];
    for (let i = 0; i < lista.length; i += POR_LOTE) saida.push(lista.slice(i, i + POR_LOTE));
    return saida;
  }

  /** O que foi lido, de quando a quando — e o que ficou de fora. */
  function cobertura(mensagens) {
    if (mensagens.length < 2) return "";
    const primeira = CW.quandoCurto(mensagens[0].quando);
    const ultima = CW.quandoCurto(mensagens[mensagens.length - 1].quando);
    return `<div class="recado">Li ${mensagens.length} mensagens deste canal, de ${CW.escapar(primeira)} a ${CW.escapar(ultima)} — todas as que passaram na tela desde que o canal foi aberto. As mais antigas que ${CW.escapar(primeira)} ainda não foram lidas: role o canal para cima até onde quiser e clique de novo.</div>`;
  }

  async function mostrar(mensagens, titulo) {
    const painel = CW.painelDeCaptura(PAINEL);
    painel.titulo(titulo);
    painel.rodape([]);
    painel.corpo(`<p class="vazio">Conferindo com o CW…</p>`);

    if (mensagens.length === 0) {
      painel.corpo(`<p class="vazio">Nenhuma mensagem com texto neste canal ainda. Role até os avisos e tente de novo.</p>`);
      return;
    }

    /* Cada lote é conferido à parte; as linhas e a contagem se somam. */
    const partes = [];
    for (const lote of lotes(mensagens)) {
      const corpoBase = { fonte: "slack", mensagens: corpoDe(lote) };
      const resposta = await CW.enviar({ tipo: "capturaRedes", corpo: { ...corpoBase, acao: "previa" } });
      const dados = resposta?.dados;
      if (!resposta?.ok || !dados || dados.erro) {
        painel.corpo(`<div class="recado erro">${CW.escapar(dados?.erro ?? resposta?.erro ?? "Não deu para conferir agora.")}</div>`);
        painel.rodape([{ rotulo: "Tentar de novo", aoClicar: () => mostrar(mensagens, titulo) }]);
        return;
      }
      partes.push({ corpoBase, linhas: dados.linhas ?? [] });
      if (lotes(mensagens).length > 1) painel.corpo(`<p class="vazio">Conferindo com o CW… ${Math.min(partes.length * POR_LOTE, mensagens.length)} de ${mensagens.length}</p>`);
    }

    const linhas = partes.flatMap((p) => p.linhas);

    /* Prévia vazia (texto que o servidor não entendeu): sem isto, "linhas[0].estado" quebrava o painel. */
    if (linhas.length === 0) {
      painel.corpo(`<p class="vazio">Não entendi ${mensagens.length === 1 ? "esta mensagem" : "estas mensagens"} como atendimento das Redes.</p>`);
      painel.rodape([{ rotulo: "Tentar de novo", aoClicar: () => mostrar(mensagens, titulo) }]);
      return;
    }

    const c = { nova: 0, existente: 0, duplicada: 0, "sem-rede": 0 };
    for (const l of linhas) c[l.estado] = (c[l.estado] ?? 0) + 1;
    const novas = linhas.filter((l) => l.estado === "nova");
    const tsDa = (chave) => String(chave ?? "").split(":").pop();
    await marcarNoCw(canalAtual(), linhas.filter((l) => l.estado === "existente").map((l) => tsDa(l.chave)));

    const umaSo = mensagens.length === 1;
    const l0 = linhas[0];

    painel.corpo(
      (umaSo
        ? l0.estado === "existente"
          ? `<div class="recado ok">Já está no CW como ${CW.escapar(l0.protocolo ?? "atendimento")}.</div>`
          : l0.estado === "sem-rede"
            ? `<div class="recado aviso">Não achei a rede nesta mensagem (Instagram, Facebook ou ManyChat, pelo nome ou pelo link).</div>`
            : ""
        : contagem(c) + cobertura(mensagens)) +
        (umaSo
          ? `<p class="rotulo">O que foi entendido</p>${CW.linhasDaCaptura(linhas)}`
          : novas.length
            ? `<p class="rotulo">Novas${novas.length > 8 ? ` — as 8 primeiras de ${novas.length}` : ""}</p>${CW.linhasDaCaptura(novas.slice(0, 8))}`
            : `<p class="vazio">Nada novo nas ${mensagens.length} mensagens lidas.</p>`)
    );

    painel.rodape([
      {
        rotulo: novas.length ? (umaSo ? "Gravar nas Redes" : `Gravar ${novas.length} ${novas.length === 1 ? "nova" : "novas"}`) : "Nada para gravar",
        tom: "acao",
        empurra: true,
        desligado: novas.length === 0,
        aoClicar: async (e) => {
          e.currentTarget.disabled = true;
          e.currentTarget.textContent = "Gravando…";
          const criados = [];
          for (const p of partes) {
            const apenas = p.linhas.filter((l) => l.estado === "nova").map((l) => l.chave);
            if (apenas.length === 0) continue;
            const r = await CW.enviar({ tipo: "capturaRedes", corpo: { ...p.corpoBase, acao: "gravar", apenas } });
            const g = r?.dados;
            if (!r?.ok || !g || g.erro) {
              painel.corpo(`<div class="recado erro">${CW.escapar(g?.erro ?? r?.erro ?? "Não foi gravado.")}${criados.length ? ` Antes do erro, ${criados.length} já tinham sido criados.` : ""}</div>`);
              painel.rodape([{ rotulo: "Tentar de novo", aoClicar: () => mostrar(mensagens, titulo) }]);
              return;
            }
            criados.push(...(g.criados ?? []));
            await marcarNoCw(canalAtual(), apenas.map(tsDa));
          }
          painel.corpo(
            `<div class="recado ok">${criados.length} ${criados.length === 1 ? "atendimento criado" : "atendimentos criados"} nas Redes, em Recebido e a triar.</div>` +
              (criados.length ? `<ul>${criados.slice(0, 12).map((x) => `<li><b>${CW.escapar(x.protocolo)}</b></li>`).join("")}</ul>` : "")
          );
          painel.rodape([{ rotulo: "Triar nas Redes", tom: "acao", empurra: true, aoClicar: () => CW.enviar({ tipo: "abrirNaPlataforma", caminho: "/redes-sociais" }) }]);
        },
      },
    ]);
  }

  /* ============================================================
     BOTÕES
  ============================================================ */

  /*
    Uma regra só, com o nosso atributo no seletor: o botão aparece com o
    mouse na mensagem. O Slack redesenha a mensagem quando quer — por isso
    a varredura pergunta pelo botão, e não por uma marca que sobreviveria
    ao botão apagado.
  */
  function regraDeHover() {
    if (document.getElementById("cw-slack-regra")) return;
    const estilo = document.createElement("style");
    estilo.id = "cw-slack-regra";
    estilo.textContent = `[data-item-key]:hover [${MARCA}="botao"], [${MARCA}="botao"]:focus-visible { opacity: 1 !important; } [${MARCA}="botao"][data-feito] { opacity: .6; }`;
    document.head.appendChild(estilo);
  }

  function botaoNaMensagem(el) {
    const ts = el.getAttribute("data-item-key");
    const existente = el.querySelector(`[${MARCA}="botao"]`);
    /* Elemento reaproveitado pelo Slack para outra mensagem: o botão é da mensagem antiga. */
    if (existente && existente.getAttribute("data-cw-ts") === ts) return;
    existente?.remove();
    const alvo = el.querySelector('[data-qa="message-text"], .c-message_kit__blocks');
    if (!alvo) return;
    const botao = document.createElement("button");
    botao.type = "button";
    botao.setAttribute(MARCA, "botao");
    botao.setAttribute("data-cw-ts", ts);
    botao.textContent = "CW · Redes";
    botao.title = "Registrar esta mensagem nas Redes Sociais do CW";
    botao.style.cssText =
      "margin:4px 0 0;padding:2px 8px;border-radius:6px;border:1px solid rgba(29,28,29,.13);background:transparent;color:inherit;font:500 11.5px/1.5 inherit;cursor:pointer;opacity:0;transition:opacity .12s";
    botao.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const m = lerMensagem(el, canalAtual());
      if (m) mostrar([m], `#${nomeDoCanal()}`);
    });
    alvo.insertAdjacentElement("afterend", botao);
  }

  /** A marca de "já no CW" segue o `ts` da mensagem, não o elemento. */
  function desenharMarcas() {
    const conjunto = noCw.get(canalAtual());
    for (const b of document.querySelectorAll(`[${MARCA}="botao"]`)) {
      const ts = b.getAttribute("data-cw-ts");
      if (conjunto?.has(ts)) {
        b.setAttribute("data-feito", "1");
        b.title = "Já está no CW";
      } else {
        b.removeAttribute("data-feito");
        b.title = "Registrar esta mensagem nas Redes Sociais do CW";
      }
    }
  }

  function montarLancador() {
    if (document.getElementById(LANCADOR)) return;
    const host = document.createElement("div");
    host.id = LANCADOR;
    document.documentElement.appendChild(host);
    const raiz = host.attachShadow({ mode: "open" });
    raiz.innerHTML = `<style>
      :host { all: initial; }
      button { position: fixed; right: 16px; bottom: 64px; z-index: 2147482999; border: 1px solid #e4e4e7; background: #fff; color: #18181b;
        border-radius: 999px; padding: 6px 12px 6px 10px; font: 500 12px/1 "CW Geist", ui-sans-serif, system-ui, sans-serif; cursor: pointer;
        box-shadow: 0 4px 14px -6px rgba(16,24,40,.25); display: flex; align-items: center; gap: 6px; }
      button:hover { border-color: #a1a1aa; }
      b { font: 600 10px/1 ui-monospace, monospace; letter-spacing: .06em; color: #71717a; }
      @media (prefers-color-scheme: dark) { button { background: #1e1f25; color: #f1f1f4; border-color: #31333c; } b { color: #8b8c96; } }
    </style><button type="button"><b>CW</b><span>Ler o canal para as Redes</span></button>`;
    CW.registrarFonte?.();
    raiz.querySelector("button").addEventListener("click", () => {
      juntar();
      mostrar(ordenadas(), `#${nomeDoCanal()}`);
    });
    atualizarLancador();
  }

  /** O lançador diz quantas mensagens juntou e desde quando — o que a leitura vai mandar. */
  function atualizarLancador() {
    const host = document.getElementById(LANCADOR);
    if (!host?.shadowRoot) return;
    const lista = ordenadas();
    const rotulo = host.shadowRoot.querySelector("span");
    const botao = host.shadowRoot.querySelector("button");
    if (!rotulo || !botao) return;
    const desde = lista.length ? CW.quandoCurto(lista[0].quando).slice(0, 5) : "";
    const texto = lista.length ? `Ler ${lista.length} ${lista.length === 1 ? "mensagem" : "mensagens"} para as Redes · desde ${desde}` : "Ler o canal para as Redes";
    if (rotulo.textContent !== texto) rotulo.textContent = texto;
    botao.title = "A extensão junta cada mensagem que passa na tela. Para ler as mais antigas, role o canal para cima antes de clicar.";
  }

  function varrer() {
    try {
      const noCanal = Boolean(canalAtual());
      const lancador = document.getElementById(LANCADOR);
      if (!noCanal) {
        lancador?.remove();
        return;
      }
      montarLancador();
      regraDeHover();
      for (const el of document.querySelectorAll("[data-item-key]")) {
        if (TS.test(el.getAttribute("data-item-key") ?? "")) botaoNaMensagem(el);
      }
      juntar();
      desenharMarcas();
    } catch (erro) {
      console.warn("[CW] leitura do Slack falhou nesta volta", erro);
    }
  }

  /*
    A lista do Slack é virtual e troca as mensagens ao rolar. Além da volta
    de 2 s, cada mudança na página junta o que está nela no quadro seguinte:
    quem rola rápido não deixa mensagem passar sem ser vista.
  */
  let espera = null;
  new MutationObserver(() => {
    if (!canalAtual()) return;
    /*
      Juntar na hora: rolando rápido, uma mensagem fica na página por um
      instante só. Sem esperar o quadro da tela (requestAnimationFrame para
      quando a aba não está à vista — medido: 56 de 300). Barato: só relê o
      elemento que passou a mostrar outra mensagem.
    */
    juntar();
    /* Botões e marcas podem esperar meio segundo. */
    if (!espera) {
      espera = setTimeout(() => {
        espera = null;
        varrer();
      }, 500);
    }
  }).observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["data-item-key"] });

  setInterval(varrer, 2000);
  varrer();

  /* ============================================================
     A IA DO DIA — o que é para você vira lembrete (08/10/2026)
  ============================================================ */

  /*
    "Me lembra de coisas importantes, seja do Slack." Sem token do Slack: a
    extensão olha o que passa na tela — conversa direta (canal D…) ou
    mensagem com menção — e manda em lote para a aplicação, que decide o
    que pede ação e cria o lembrete na agenda. Nada é respondido no Slack.
    Cada mensagem vai uma vez só (o `ts` fica guardado na extensão).
  */
  const ENVIADAS = "cwSlackAvisosEnviados";
  const DOIS_DIAS_MS = 2 * 86_400_000;
  let enviadas = null;
  const fila = new Map();

  const canalDaConversa = () => location.pathname.match(/\/client\/[A-Z0-9]+\/([CGD][A-Z0-9]{6,})/)?.[1] ?? "";

  async function carregarEnviadas() {
    if (enviadas) return enviadas;
    enviadas = new Set();
    try {
      const guardado = await chrome.storage.local.get(ENVIADAS);
      for (const ts of guardado[ENVIADAS] ?? []) enviadas.add(ts);
    } catch {
      /* Sem a memória da extensão: o servidor não repete (a chave é única por mensagem). */
    }
    return enviadas;
  }

  /** Quem escreveu: o Slack só mostra o nome na primeira de uma sequência — as seguintes herdam. */
  function autorDe(el) {
    let atual = el;
    for (let i = 0; atual && i < 15; i += 1) {
      const nome = atual.querySelector?.('[data-qa="message_sender_name"], .c-message__sender_button');
      if (nome) return (nome.innerText ?? "").trim().slice(0, 80);
      atual = atual.previousElementSibling;
    }
    return "";
  }

  async function juntarAvisos() {
    const canal = canalDaConversa();
    if (!canal) return;
    const ja = await carregarEnviadas();
    const direta = canal.startsWith("D");
    for (const el of document.querySelectorAll("[data-item-key]")) {
      const ts = el.getAttribute("data-item-key") ?? "";
      if (!TS.test(ts) || ja.has(ts) || fila.has(ts)) continue;
      if (Date.now() - Number(ts.split(".")[0]) * 1000 > DOIS_DIAS_MS) continue;
      const m = lerMensagem(el, canal);
      if (!m || (!direta && !m.mencoes.length)) continue;
      const link = el.querySelector("a.c-timestamp, a[data-qa='message_timestamp']")?.href ?? "";
      fila.set(ts, { canal, ts, texto: m.texto, autor: autorDe(el), mencoes: m.mencoes, quando: m.quando, link });
    }
  }

  async function enviarAvisos() {
    if (!fila.size) return;
    const lote = [...fila.values()].slice(0, 50);
    try {
      const r = await CW.enviar({ tipo: "slackAvisos", corpo: { mensagens: lote } });
      if (r?.ok === false && r?.codigo !== "http") return;
      const ja = await carregarEnviadas();
      for (const m of lote) {
        ja.add(m.ts);
        fila.delete(m.ts);
      }
      await chrome.storage.local.set({ [ENVIADAS]: [...ja].sort().slice(-GUARDADAS) });
    } catch {
      /* Sem conexão agora: a fila tenta de novo na próxima volta. */
    }
  }

  setInterval(() => void juntarAvisos(), 5000);
  setInterval(() => void enviarAvisos(), 30_000);
})();
