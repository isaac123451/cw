/**
 * A ponte entre a plataforma e a extensão.
 *
 * Roda **só nas páginas da própria plataforma** — o endereço configurado
 * nas Opções; quem registra é o service worker (`registrarPonte`).
 *
 * **Por que existe.** O Isaac pediu que a página do Reclame Aqui fosse
 * lida "somente quando eu abra a plataforma", com um botão para ler na
 * hora. Quem lê o portal tem de ser a extensão — o Cloudflare barra o
 * servidor —, e a página da plataforma não tem como chamar a extensão
 * diretamente: ela não sabe o id dela, que numa extensão descompactada
 * muda de máquina para máquina. Esta ponte escuta a página e repassa.
 *
 * **Repassa pouco, de propósito:** ler o portal e dizer como foi a última
 * leitura. Nada de sessão, cookie ou dado de consumidor passa por aqui —
 * quem grava continua sendo o servidor, com a sessão de sempre.
 *
 * Nada no DOM da página: um atributo no `<html>` faria o React acusar
 * diferença na hidratação. A presença se prova pela resposta ao "ping".
 */
(() => {
  if (window.__cwPonte) return;
  window.__cwPonte = true;

  const VERSAO = chrome.runtime.getManifest().version;

  const REPASSADOS = new Set(["vigiaAgora", "vigiaEstado"]);

  function responder(id, resposta) {
    window.postMessage(
      { de: "cw-extensao", id, resposta },
      location.origin
    );
  }

  const RECARREGADA = {
    ok: false,
    codigo: "extensao",
    erro: "A extensão foi atualizada depois que esta página abriu. Atualize a página (F5).",
  };

  window.addEventListener("message", (evento) => {

    /* Só a própria página, na própria origem. */
    if (evento.source !== window || evento.origin !== location.origin) return;

    const pedido = evento.data;

    if (
      !pedido ||
      pedido.para !== "cw-extensao" ||
      typeof pedido.id !== "string"
    ) {
      return;
    }

    if (pedido.tipo === "ping") {
      responder(pedido.id, { ok: true, dados: { versao: VERSAO } });
      return;
    }

    if (!REPASSADOS.has(pedido.tipo)) {
      responder(pedido.id, { ok: false, erro: "Pedido que a extensão não atende." });
      return;
    }

    try {
      chrome.runtime.sendMessage(
        {
          tipo: pedido.tipo,
          motivo: pedido.motivo === "manual" ? "manual" : "plataforma",
        },
        (resposta) => {
          /* Ler o lastError é obrigatório, mesmo para descartar. */
          const falha = chrome.runtime.lastError;
          responder(pedido.id, falha ? RECARREGADA : resposta);
        }
      );
    } catch {
      /* A extensão foi recarregada: o canal desta aba morreu. */
      responder(pedido.id, RECARREGADA);
    }
  });

  /* Para a página que já estava aberta quando a ponte foi injetada. */
  window.postMessage(
    { de: "cw-extensao", tipo: "pronta", versao: VERSAO },
    location.origin
  );
})();
