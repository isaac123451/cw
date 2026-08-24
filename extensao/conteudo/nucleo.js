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

  /* ---------- fonte ---------- */

  /**
   * Registra a Geist no documento da página.
   *
   * Tem de ser aqui, e não no CSS do painel: `@font-face` declarado
   * dentro de um Shadow DOM é ignorado pelo Chrome — a regra precisa
   * existir no documento, mesmo que só o shadow vá usá-la. A API
   * `FontFace` faz isso sem injetar `<style>` na página alheia.
   *
   * O nome "CW Geist" é proposital: registrar como "Geist" poderia
   * colidir com uma fonte que o site já tenha carregado com esse nome,
   * e aí quem quebraria seria a página, não a extensão.
   */
  CW.registrarFonte = () => {

    if (CW.fonteRegistrada) return;

    CW.fonteRegistrada = true;

    try {

      const fonte = new FontFace(
        "CW Geist",
        `url(${chrome.runtime.getURL(
          "fontes/Geist-Variable.woff2"
        )}) format("woff2")`,
        { weight: "100 900", style: "normal", display: "swap" }
      );

      fonte
        .load()
        .then((carregada) => {
          document.fonts.add(carregada);
        })
        .catch(() => {
          /**
           * Falhou o carregamento — a pilha de fontes do sistema no CSS
           * assume. Vale um painel com fonte pior, não um painel sem
           * texto.
           */
        });

    } catch {
      // `chrome.runtime` morto após recarregar a extensão.
    }
  };

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
   * Caracteres invisíveis que os sites inserem em telefone.
   *
   * Marcas e embutidos de direção: um `+` seguido de dígitos precisa de
   * dica de direção para renderizar igual em qualquer idioma, e o
   * WhatsApp Web as coloca sem avisar. Não aparecem no editor nem na
   * tela, mas quebram qualquer teste que valide a **forma** do texto.
   */
  CW.INVISIVEIS =
    /[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;

  /**
   * Tudo que separa dígito num telefone, em qualquer tipografia.
   *
   * Espaço (inclusive o não separável U+00A0), parêntese, ponto,
   * barra, o sinal de mais, a família inteira de traços (U+2010 a
   * U+2015) e o menos matemático (U+2212).
   *
   * **Isto existe por um defeito real**, reportado pelo Isaac: alguns
   * contatos do WhatsApp não eram reconhecidos com o número idêntico
   * ao da base. Os leitores validavam a forma com `[\s\-().]`, que só
   * aceita o hífen ASCII — e o WhatsApp escreve com hífen não
   * separável (U+2011) ou travessão curto (U+2013) conforme o caso.
   * Medido: dez de quinze formatos reais eram recusados.
   *
   * Escrito com escape e não com o caractere: os invisíveis somem
   * num copiar e colar, e a expressão voltaria a falhar só para
   * alguns contatos — o mesmo sintoma que isto conserta.
   */
  CW.SEPARADORES =
    /[\s()./+\u00A0\u2010-\u2015\u2212-]/g;
  /**
   * O texto é um telefone? Devolve os dígitos, ou vazio.
   *
   * A pergunta não é "tem a forma de um telefone" — é "sobrou letra
   * depois de tirar a pontuação". Nome tem letra, número não, e essa
   * pergunta não muda quando o site troca de traço.
   */
  CW.telefoneDoTexto = (valor) => {

    const semInvisiveis = String(valor ?? "").replace(
      CW.INVISIVEIS,
      ""
    );

    const semPontuacao = semInvisiveis.replace(
      CW.SEPARADORES,
      ""
    );

    const digitos = CW.digitos(semInvisiveis);

    const soDigitos =
      semPontuacao.length > 0 &&
      /^\d+$/.test(semPontuacao);

    /** Dez sem DDI, treze com ele; quinze é o teto do E.164. */
    return soDigitos &&
      digitos.length >= 10 &&
      digitos.length <= 15
      ? digitos
      : "";
  };

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
