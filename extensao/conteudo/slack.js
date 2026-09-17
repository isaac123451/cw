/**
 * Slack — a mensagem do canal vira atendimento das Redes.
 *
 * **O pedido.** "E também casos do Slack." A automação e o time avisam as
 * menções num canal; cada aviso era copiado para o formulário das Redes.
 *
 * **Sem token e sem administrador.** Nada de app instalado no Slack: a
 * extensão lê o que já está na tela de quem abriu o canal, pelo
 * navegador. Cada mensagem ganha, ao passar o mouse, um "Redes"; e o
 * lançador no canto lê as mensagens visíveis de uma vez.
 *
 * **Só no clique, em dois tempos.** O primeiro clique mostra o que foi
 * entendido (rede, perfil, seguidores, link) e se o caso já está no CW;
 * só "Gravar" cria. A leitura do texto mora na aplicação
 * (`itemDoSlack`), a mesma para a mensagem solta e para o canal inteiro.
 */
(() => {
  const CW = window.CWReputacao;

  if (!CW || !CW.painelDeCaptura) return;

  const PAINEL = "cw-captura-slack";
  const LANCADOR = "cw-captura-slack-botao";
  const MARCA = "data-cw-slack";

  /* O ts do Slack: segundos e microssegundos, a identidade da mensagem. */
  const TS = /^\d{9,11}\.\d{6}$/;

  const canalAtual = () => location.pathname.match(/\/client\/[A-Z0-9]+\/([CG][A-Z0-9]{6,})/)?.[1] ?? "";

  function nomeDoCanal() {
    const el = document.querySelector('[data-qa="channel_name"], [data-qa="channel_header_title"] button, .p-view_header__channel_title');
    return CW.texto(el, 60) || "canal";
  }

  function mensagensVisiveis() {
    const canal = canalAtual();
    if (!canal) return [];
    return [...document.querySelectorAll("[data-item-key]")]
      .filter((el) => TS.test(el.getAttribute("data-item-key") ?? ""))
      .map((el) => lerMensagem(el, canal))
      .filter(Boolean);
  }

  function lerMensagem(el, canal) {
    const ts = el.getAttribute("data-item-key");
    const blocos = el.querySelectorAll('[data-qa="message-text"], .c-message_kit__blocks, .p-rich_text_section');
    const alvo = blocos[0] ?? null;
    if (!alvo) return null;
    const texto = (alvo.innerText ?? "").replace(/\u00a0/g, " ").trim().slice(0, 4000);
    if (!texto) return null;
    const links = [...alvo.querySelectorAll("a[href]")].map((a) => a.href).filter((h) => /^https?:/.test(h)).slice(0, 10);
    return {
      canal,
      ts,
      texto,
      links,
      quando: new Date(Number(ts.split(".")[0]) * 1000).toISOString(),
      elemento: el,
    };
  }

  const corpoDe = (mensagens) =>
    mensagens.map(({ canal, ts, texto, links, quando }) => ({ canal, ts, texto, links, quando }));

  function contagem(c) {
    const cel = (n, rotulo) => `<div><b>${Number(n) || 0}</b><span>${rotulo}</span></div>`;
    return `<div class="numeros">${cel(c.nova, "novas")}${cel(c.existente, "já no CW")}${cel(c.duplicada, "repetidas")}${cel(c["sem-rede"], "sem rede")}</div>`;
  }

  async function mostrar(mensagens, titulo) {
    const painel = CW.painelDeCaptura(PAINEL);
    painel.titulo(titulo);
    painel.rodape([]);
    painel.corpo(`<p class="vazio">Conferindo com o CW…</p>`);

    if (mensagens.length === 0) {
      painel.corpo(`<p class="vazio">Nenhuma mensagem com texto visível neste canal. Role até os avisos e tente de novo.</p>`);
      return;
    }

    const corpoBase = { fonte: "slack", mensagens: corpoDe(mensagens) };
    const resposta = await CW.enviar({ tipo: "capturaRedes", corpo: { ...corpoBase, acao: "previa" } });
    const dados = resposta?.dados;

    if (!resposta?.ok || !dados || dados.erro) {
      painel.corpo(`<div class="recado erro">${CW.escapar(dados?.erro ?? resposta?.erro ?? "Não deu para conferir agora.")}</div>`);
      painel.rodape([{ rotulo: "Tentar de novo", aoClicar: () => mostrar(mensagens, titulo) }]);
      return;
    }

    const linhas = dados.linhas ?? [];
    const novas = linhas.filter((l) => l.estado === "nova");
    const umaSo = mensagens.length === 1;
    const l0 = linhas[0];

    painel.corpo(
      (umaSo
        ? l0.estado === "existente"
          ? `<div class="recado ok">Já está no CW como ${CW.escapar(l0.protocolo ?? "atendimento")}.</div>`
          : l0.estado === "sem-rede"
            ? `<div class="recado aviso">Não achei a rede nesta mensagem (Instagram, Facebook, WhatsApp ou ManyChat, pelo nome ou pelo link).</div>`
            : ""
        : contagem(dados.contagem)) +
        (umaSo
          ? `<p class="rotulo">O que foi entendido</p>${CW.linhasDaCaptura(linhas)}`
          : novas.length
            ? `<p class="rotulo">Novas${novas.length > 8 ? ` — as 8 primeiras de ${novas.length}` : ""}</p>${CW.linhasDaCaptura(novas.slice(0, 8))}`
            : `<p class="vazio">Nada novo nas mensagens visíveis.</p>`)
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
          const r = await CW.enviar({ tipo: "capturaRedes", corpo: { ...corpoBase, acao: "gravar", apenas: novas.map((l) => l.chave) } });
          const g = r?.dados;
          if (!r?.ok || !g || g.erro) {
            painel.corpo(`<div class="recado erro">${CW.escapar(g?.erro ?? r?.erro ?? "Não foi gravado.")}</div>`);
            painel.rodape([{ rotulo: "Tentar de novo", aoClicar: () => mostrar(mensagens, titulo) }]);
            return;
          }
          const criados = g.criados ?? [];
          for (const m of mensagens) m.elemento?.querySelector(`[${MARCA}="botao"]`)?.setAttribute("data-feito", "1");
          painel.corpo(
            `<div class="recado ok">${criados.length} ${criados.length === 1 ? "atendimento criado" : "atendimentos criados"} nas Redes, em Recebido e a triar.</div>` +
              (criados.length ? `<ul>${criados.slice(0, 12).map((c) => `<li><b>${CW.escapar(c.protocolo)}</b></li>`).join("")}</ul>` : "")
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
    if (el.querySelector(`[${MARCA}="botao"]`)) return;
    const alvo = el.querySelector('[data-qa="message-text"], .c-message_kit__blocks');
    if (!alvo) return;
    const botao = document.createElement("button");
    botao.type = "button";
    botao.setAttribute(MARCA, "botao");
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
    </style><button type="button" title="Conferir as mensagens visíveis deste canal e registrar as novas nas Redes"><b>CW</b>Ler o canal para as Redes</button>`;
    CW.registrarFonte?.();
    raiz.querySelector("button").addEventListener("click", () => mostrar(mensagensVisiveis(), `#${nomeDoCanal()} · mensagens visíveis`));
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
    } catch (erro) {
      console.warn("[CW] leitura do Slack falhou nesta volta", erro);
    }
  }

  /* A lista do Slack é virtual e redesenha ao rolar: uma varredura a cada 2 s, como no Google Perfil. */
  setInterval(varrer, 2000);
  varrer();
})();
