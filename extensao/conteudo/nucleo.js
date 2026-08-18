/**
 * Base compartilhada pelos scripts de conteúdo.
 *
 * Script de conteúdo declarado no manifesto não aceita `import` — então
 * os arquivos são carregados em ordem e conversam por este objeto
 * global. É deliberadamente pequeno: tudo que envolve rede, cookie ou
 * configuração vive no service worker.
 */
(() => {
  if (window.CWReputacao) return;

  const CW = {};

  /* ---------- conversa com o service worker ---------- */

  CW.enviar = (mensagem) =>
    new Promise((resolver) => {
      try {
        chrome.runtime.sendMessage(mensagem, (resposta) => {

          /**
           * `lastError` precisa ser lido, mesmo que só para descartar:
           * sem isso o Chrome registra "Unchecked runtime.lastError" no
           * console da página, que não é nossa.
           */
          const falha = chrome.runtime.lastError;

          if (falha) {
            resolver({
              ok: false,
              codigo: "extensao",
              erro: falha.message,
            });
            return;
          }

          resolver(
            resposta ?? {
              ok: false,
              codigo: "vazio",
              erro: "Sem resposta da extensão.",
            }
          );
        });
      } catch {
        /**
         * Acontece de verdade: ao recarregar a extensão, o script de
         * conteúdo antigo continua na página com o canal já morto.
         */
        resolver({
          ok: false,
          codigo: "recarregue",
          erro: "A extensão foi recarregada. Atualize esta página.",
        });
      }
    });

  /* ---------- utilidades ---------- */

  CW.escapar = (valor) =>
    String(valor ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  CW.data = (iso) => {
    if (!iso) return "";
    const partes = String(iso).slice(0, 10).split("-");
    return partes.length === 3
      ? `${partes[2]}/${partes[1]}/${partes[0]}`
      : iso;
  };

  CW.dinheiro = (valor) =>
    typeof valor === "number"
      ? valor.toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
          maximumFractionDigits: 0,
        })
      : "";

  CW.debounce = (fn, ms) => {
    let id = null;
    return (...args) => {
      clearTimeout(id);
      id = setTimeout(() => fn(...args), ms);
    };
  };

  /** Dígitos de um telefone, sem DDI e sem pontuação. */
  CW.digitos = (valor) =>
    String(valor ?? "").replace(/\D/g, "");

  /**
   * Texto visível de um elemento, cortado.
   *
   * Existe para ler rótulo de cabeçalho, nunca conteúdo de mensagem —
   * ver o compromisso registrado em `LEIA-ME.md`.
   */
  CW.texto = (elemento, limite = 120) =>
    (elemento?.textContent ?? "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, limite);

  window.CWReputacao = CW;
})();
