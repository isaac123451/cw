/**
 * O painelzinho da captura das Redes — o mesmo na planilha e no Slack.
 *
 * Pequeno, no canto, arrastável pelo cabeçalho e sem escurecer a página
 * (o Isaac pediu os painéis assim). Mora num Shadow DOM: o CSS do Google
 * Sheets e o do Slack não chegam aqui, e o nosso não vaza para eles.
 *
 * Só desenha. Quem lê a planilha ou a mensagem e quem fala com a
 * aplicação são `planilha.js` e `slack.js`.
 */
(() => {
  const CW = window.CWReputacao;

  if (!CW || CW.painelDeCaptura) return;

  const CSS = `
  :host { all: initial; }
  .caixa {
    --fundo: #ffffff; --borda: #e4e4e7; --texto: #18181b; --suave: #52525b; --fraco: #a1a1aa;
    --linha: #f4f4f5; --acao: #18181b; --acao-texto: #ffffff; --ok: #15803d; --ok-fundo: #f0fdf4;
    --erro: #b91c1c; --erro-fundo: #fef2f2; --aviso: #92400e; --aviso-fundo: #fffbeb;
    position: fixed; right: 16px; bottom: 16px; z-index: 2147483000; width: 344px; max-width: calc(100vw - 32px);
    background: var(--fundo); color: var(--texto); border: 1px solid var(--borda); border-radius: 12px;
    box-shadow: 0 16px 40px -12px rgba(16, 24, 40, .28); font: 13px/1.45 "CW Geist", ui-sans-serif, system-ui, sans-serif;
    display: flex; flex-direction: column; max-height: min(640px, calc(100vh - 32px));
  }
  @media (prefers-color-scheme: dark) {
    .caixa { --fundo: #1e1f25; --borda: #31333c; --texto: #f1f1f4; --suave: #c8c9d0; --fraco: #8b8c96; --linha: #26282f;
      --acao: #f1f1f4; --acao-texto: #18181b; --ok: #4ade80; --ok-fundo: #15251b; --erro: #f87171; --erro-fundo: #2a1717; --aviso: #fbbf24; --aviso-fundo: #2a2210; }
  }
  .topo { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-bottom: 1px solid var(--linha); cursor: grab; user-select: none; }
  .topo:active { cursor: grabbing; }
  .marca { font: 600 10.5px/1 ui-monospace, monospace; letter-spacing: .06em; color: var(--fraco); text-transform: uppercase; }
  .titulo { font-weight: 600; flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .fechar { border: 0; background: transparent; color: var(--fraco); cursor: pointer; font-size: 16px; line-height: 1; padding: 2px 4px; border-radius: 6px; }
  .fechar:hover { color: var(--texto); background: var(--linha); }
  .corpo { padding: 12px; overflow: auto; }
  .rodape { display: flex; gap: 8px; align-items: center; padding: 10px 12px; border-top: 1px solid var(--linha); }
  .rodape:empty { display: none; }
  button.acao { border: 1px solid var(--acao); background: var(--acao); color: var(--acao-texto); border-radius: 8px; padding: 6px 11px; font: 600 12.5px/1.2 inherit; cursor: pointer; }
  button.acao[disabled] { opacity: .45; cursor: default; }
  button.leve { border: 1px solid var(--borda); background: transparent; color: var(--texto); border-radius: 8px; padding: 6px 10px; font: 500 12.5px/1.2 inherit; cursor: pointer; }
  button.leve:hover { background: var(--linha); }
  .empurra { margin-left: auto; }
  .numeros { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; background: var(--linha); border: 1px solid var(--linha); border-radius: 8px; overflow: hidden; margin: 2px 0 12px; }
  .numeros div { background: var(--fundo); padding: 7px 8px; }
  .numeros b { display: block; font-size: 16px; font-variant-numeric: tabular-nums; }
  .numeros span { color: var(--fraco); font-size: 11px; }
  .rotulo { color: var(--fraco); font-size: 11px; margin: 0 0 6px; }
  .chips { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 12px; }
  .chip { border: 1px solid var(--borda); border-radius: 6px; padding: 1px 6px; font-size: 11px; color: var(--suave); }
  .chip.falta { border-style: dashed; color: var(--fraco); }
  ul { list-style: none; margin: 0; padding: 0; }
  li { padding: 7px 0; border-top: 1px solid var(--linha); }
  li:first-child { border-top: 0; }
  .meta { color: var(--fraco); font-size: 11px; }
  .trecho { color: var(--suave); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .recado { border-radius: 8px; padding: 8px 10px; margin-bottom: 10px; }
  .recado.ok { background: var(--ok-fundo); color: var(--ok); }
  .recado.erro { background: var(--erro-fundo); color: var(--erro); }
  .recado.aviso { background: var(--aviso-fundo); color: var(--aviso); }
  .vazio { color: var(--fraco); padding: 8px 0; }
  a { color: inherit; }
  `;

  /**
   * Cria (ou reaproveita) o painel. Devolve funções para trocar o corpo e o
   * rodapé; os botões do rodapé chegam como `{ rotulo, tom, aoClicar, desligado }`.
   */
  CW.painelDeCaptura = (id) => {
    let host = document.getElementById(id);
    if (!host) {
      host = document.createElement("div");
      host.id = id;
      document.documentElement.appendChild(host);
      const raiz = host.attachShadow({ mode: "open" });
      raiz.innerHTML = `<style>${CSS}</style><section class="caixa" role="dialog" aria-label="CW Reputação — captura das Redes">
        <header class="topo"><span class="marca">CW</span><span class="titulo"></span><button class="fechar" type="button" aria-label="Fechar">×</button></header>
        <div class="corpo"></div><div class="rodape"></div></section>`;
      CW.registrarFonte?.();

      const caixa = raiz.querySelector(".caixa");
      raiz.querySelector(".fechar").addEventListener("click", () => host.remove());

      /* Arrastar pelo cabeçalho, preso à tela. */
      const topo = raiz.querySelector(".topo");
      topo.addEventListener("pointerdown", (e) => {
        if (e.target.closest("button")) return;
        const r = caixa.getBoundingClientRect();
        const dx = e.clientX - r.left;
        const dy = e.clientY - r.top;
        topo.setPointerCapture(e.pointerId);
        const mover = (m) => {
          const x = Math.max(8, Math.min(m.clientX - dx, innerWidth - r.width - 8));
          const y = Math.max(8, Math.min(m.clientY - dy, innerHeight - 48));
          Object.assign(caixa.style, { left: `${x}px`, top: `${y}px`, right: "auto", bottom: "auto" });
        };
        const soltar = () => {
          topo.removeEventListener("pointermove", mover);
          topo.removeEventListener("pointerup", soltar);
        };
        topo.addEventListener("pointermove", mover);
        topo.addEventListener("pointerup", soltar);
      });
    }

    const raiz = host.shadowRoot;
    return {
      titulo(texto) {
        raiz.querySelector(".titulo").textContent = texto;
      },
      /** HTML já escapado por quem chama. */
      corpo(html) {
        raiz.querySelector(".corpo").innerHTML = html;
      },
      rodape(botoes) {
        const rodape = raiz.querySelector(".rodape");
        rodape.innerHTML = "";
        for (const b of botoes) {
          const el = document.createElement("button");
          el.type = "button";
          el.className = `${b.tom === "acao" ? "acao" : "leve"}${b.empurra ? " empurra" : ""}`;
          el.textContent = b.rotulo;
          el.disabled = Boolean(b.desligado);
          el.addEventListener("click", b.aoClicar);
          rodape.appendChild(el);
        }
      },
      fechar() {
        host.remove();
      },
    };
  };

  /** "17/09 14:32" em Brasília, a partir do ISO. */
  CW.quandoCurto = (iso) => {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  /** A lista de linhas da prévia, escapada. */
  CW.linhasDaCaptura = (linhas) =>
    linhas.length
      ? `<ul>${linhas
          .map(
            (l) => `<li><div class="meta">${CW.escapar(l.referencia)}${l.rede ? ` · ${CW.escapar(l.rede)}` : " · rede não reconhecida"}${l.perfil ? ` · @${CW.escapar(l.perfil)}` : ""}${l.nome ? ` · ${CW.escapar(l.nome)}` : ""}${l.quando ? ` · ${CW.escapar(CW.quandoCurto(l.quando))}` : ""}${l.protocolo ? ` · já é ${CW.escapar(l.protocolo)}` : ""}</div><div class="trecho">${CW.escapar(l.texto || "(sem texto)")}</div></li>`
          )
          .join("")}</ul>`
      : `<p class="vazio">Nada aqui.</p>`;
})();
