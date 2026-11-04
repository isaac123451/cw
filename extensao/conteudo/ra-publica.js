/**
 * "Enviar ao CW" nas páginas públicas do Reclame Aqui (04/11/2026), no canto de baixo à direita.
 *
 * O Isaac: "faça um botão para a leitura do vigia quando não é feita de
 * forma automática, para ele entender e enviar para a ferramenta".
 *
 * O vigia lê o portal em segundo plano, e às vezes o Cloudflare barra a
 * leitura. A aba que a pessoa abriu passa — ela é um navegador de verdade.
 * O botão manda o que está nesta aba para o vigia, que faz o mesmo que
 * faria com o que buscou sozinho:
 *
 * - página de uma reclamação: grava ou completa (resposta, réplica,
 *   avaliação), e marca a desativada;
 * - lista de reclamações da empresa: diz quais são novas ou estão atrás no
 *   CW e põe na fila do vigia;
 * - página da empresa: o painel da nota.
 *
 * Só nas páginas da Cardápio Web. Nada é lido sem o clique.
 */
(() => {
  const CW = window.CWReputacao;
  if (!CW) return;

  const EMPRESA = "cardapio-web-servicos-de-tecnologia";

  if (location.hostname !== "www.reclameaqui.com.br") return;

  const ehDaEmpresa = () =>
    location.pathname.startsWith(`/${EMPRESA}/`) || location.pathname.startsWith(`/empresa/${EMPRESA}`);

  let host = null;

  function montar() {
    if (host || !ehDaEmpresa()) return;

    host = document.createElement("div");
    host.setAttribute("data-cw-enviar", "");
    const raiz = host.attachShadow({ mode: "open" });
    raiz.innerHTML = `
      <style>
        :host { all: initial; }
        /* No canto direito, ao lado do botão do painel CW: o canto esquerdo é do ícone do próprio Reclame Aqui. */
        .caixa { position: fixed; right: 80px; bottom: 30px; z-index: 2147483000; display: flex; flex-direction: row-reverse; align-items: center; gap: 8px;
          font: 500 13px/1.4 ui-sans-serif, -apple-system, "Segoe UI", Roboto, Arial, sans-serif; }
        button { display: flex; align-items: center; gap: 6px; border: 0; border-radius: 999px; padding: 8px 14px; cursor: pointer;
          background: #5B2A86; color: #fff; font: inherit; box-shadow: 0 6px 18px -6px rgba(91, 42, 134, .6); }
        button:hover { background: #4a2270; }
        button:disabled { opacity: .7; cursor: default; }
        .msg { max-width: 340px; padding: 7px 11px; border-radius: 10px; background: #fff; color: #18181b; box-shadow: 0 6px 18px -6px rgba(0,0,0,.25);
          border: 1px solid #e4e4e7; font-weight: 400; }
        .msg.erro { border-color: #fecaca; color: #b91c1c; }
        .msg[hidden] { display: none; }
      </style>
      <div class="caixa">
        <button type="button" title="Mandar o que está nesta página para o CW Reputação — para quando o vigia não conseguiu ler sozinho">
          <span aria-hidden="true">⇪</span> Enviar ao CW
        </button>
        <span class="msg" hidden></span>
      </div>`;
    document.documentElement.appendChild(host);

    const botao = raiz.querySelector("button");
    const msg = raiz.querySelector(".msg");
    let apagar = 0;

    const mostrar = (texto, erro = false) => {
      msg.textContent = texto;
      msg.className = `msg${erro ? " erro" : ""}`;
      msg.hidden = false;
      clearTimeout(apagar);
      apagar = setTimeout(() => (msg.hidden = true), 9000);
    };

    botao.addEventListener("click", async () => {
      botao.disabled = true;
      mostrar("Enviando para o CW…");
      const r = await CW.enviar({ tipo: "vigiaPelaPagina", html: document.documentElement.outerHTML, caminho: location.pathname });
      botao.disabled = false;
      if (!r?.ok) return mostrar(r?.erro ?? "Não deu para enviar agora. Confira se a extensão está conectada.", true);
      const d = r.dados ?? {};
      if (d.tipo === "reclamacao") {
        return mostrar(d.criadas ? "Reclamação nova: entrou no quadro do CW." : d.completadas ? "Reclamação atualizada no CW." : "Esta reclamação já estava igual no CW.");
      }
      if (d.tipo === "desativada") return mostrar(d.marcadas ? "Reclamação desativada: saiu da nota e das filas do CW." : "Já constava como desativada no CW.");
      if (d.tipo === "lista") {
        const atras = d.novas + d.atrasadas;
        return mostrar(
          atras
            ? `${d.lidas} lidas · ${d.novas} ${d.novas === 1 ? "nova" : "novas"} e ${d.atrasadas} para atualizar. Elas entraram na fila do vigia; abra cada uma e clique em Enviar ao CW para trazer agora.`
            : `${d.lidas} lidas · nenhuma nova ou atrasada: o CW está em dia com esta página.`
        );
      }
      if (d.tipo === "painel") return mostrar("Painel da nota enviado ao CW.");
      return mostrar("Nada para ler nesta página. Abra uma reclamação, a lista de reclamações ou a página da empresa.", true);
    });
  }

  /* O portal troca de página sem recarregar: confere o endereço de tempos em tempos. */
  montar();
  let ultimo = location.pathname;
  setInterval(() => {
    if (location.pathname === ultimo) return;
    ultimo = location.pathname;
    if (!ehDaEmpresa() && host) {
      host.remove();
      host = null;
    } else montar();
  }, 1500);
})();
