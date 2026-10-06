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

  /**
   * `AAAA-MM-DD` → `DD/MM/AAAA`, sempre pronto para HTML.
   *
   * O que não tem cara de data volta **escapado**, e não cru. A função
   * é usada em oito lugares que montam HTML com data vinda do servidor,
   * e a conferência de escape a trata como segura pela forma — então o
   * texto que ela devolve precisa ser seguro de fato, para qualquer
   * entrada. Uma data real não tem nada a escapar: nada muda na tela.
   */
  CW.data = (iso) => {
    if (!iso) return "";
    const partes = String(iso).slice(0, 10).split("-");
    return partes.length === 3 &&
      partes.every((p) => /^\d+$/.test(p))
      ? `${partes[2]}/${partes[1]}/${partes[0]}`
      : CW.escapar(iso);
  };

  CW.dinheiro = (valor) =>
    typeof valor === "number"
      ? valor.toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
          maximumFractionDigits: 0,
        })
      : "";

  /**
   * Ícones de traço, no lugar de emoji e de entidade HTML (📌, &#9681;).
   *
   * Emoji muda de cara em cada sistema e não segue a cor do tema; o
   * traço em `currentColor` herda a cor de quem o usa, no claro e no
   * escuro. Desenho no estilo do Lucide, o mesmo da aplicação.
   */
  const ICONES = {
    cliente: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    ra: '<path d="M3 11l16-6v14L3 13z"/><path d="M7 13.5V17a2 2 0 0 0 4 0v-2"/>',
    nps: '<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9z"/>',
    redes: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z"/>',
    painel: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>',
    agenda: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    fixar: '<path d="M12 17v5"/><path d="M9 3h6l-1 6 3 3v2H7v-2l3-3z"/>',
    tema: '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" stroke="none"/>',
    voltar: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
    recarregar: '<path d="M21 12a9 9 0 1 1-2.6-6.4L21 8"/><path d="M21 3v5h-5"/>',
    fechar: '<path d="M18 6 6 18M6 6l12 12"/>',
    mais: '<g fill="currentColor"><circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/></g>',
    buscar: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    opcoes: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
    teclado: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
    lateral: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M15 3v18"/>',
    canto: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="16" cy="16" r="2"/>',
    abrir: '<path d="M4 12h12M12 6l6 6-6 6"/><path d="M20 4v16"/>',
    anotar: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    lembrete: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
    assistente: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 15l.7 1.8 1.8.7-1.8.7L19 20l-.7-1.8-1.8-.7 1.8-.7z"/>',
    ok: '<path d="M20 6 9 17l-5-5"/>',
    copiar: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    fora: '<path d="M15 3h6v6M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    direita: '<path d="m9 18 6-6-6-6"/>',
    baixo: '<path d="m6 9 6 6 6-6"/>',
    alerta: '<path d="M12 3 2 21h20z"/><path d="M12 10v4M12 17.5h.01"/>',
    relogio: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    documento: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>',
  };

  CW.icone = (nome, tamanho = 16) =>
    `<svg class="ic" width="${tamanho}" height="${tamanho}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONES[nome] ?? ""}</svg>`;

  /**
   * A palavra no número certo — no lugar do "reclamação(ões)".
   * Devolve só a palavra: `${n} ${CW.plural(n, "caso", "casos")}`.
   */
  CW.plural = (n, um, varios) => {
    const numero = typeof n === "number" ? n : Number(String(n ?? "").replace(/\./g, "").replace(",", "."));
    return Math.abs(numero) === 1 ? um : varios;
  };

  /** Número com vírgula, como se escreve aqui: 8,8 e não 8.8. */
  CW.numero = (valor, casas = 1, fixo = false) => {
    const n = Number(valor);
    if (valor === null || valor === undefined || valor === "" || !Number.isFinite(n)) return "—";
    return n.toLocaleString("pt-BR", { minimumFractionDigits: fixo || !Number.isInteger(n) ? casas : 0, maximumFractionDigits: casas });
  };

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
   * O telefone como se lê: "(11) 96059-9984" (out/2026). O cartão do
   * cliente mostrava "11960599984". Sem DDD ou com outro tamanho, volta
   * como veio — melhor cru do que formatado errado.
   */
  CW.telefoneLegivel = (valor) => {
    let d = CW.digitos(String(valor ?? ""));
    if ((d.length === 12 || d.length === 13) && d.startsWith("55")) d = d.slice(2);
    if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return String(valor ?? "");
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

  /**
   * Um aviso curto no canto, fora do painel (1.82).
   *
   * "Salvar conversas com aviso sem abrir nada": a gravação sozinha
   * acontecia calada, e só quem abria o painel sabia. Uma pílula pequena,
   * sem desfoque, que some em 3,5 s — e não empilha: o aviso novo troca o
   * anterior.
   */
  let avisoAtual = null;
  CW.notificar = (texto, tipo = "ok") => {
    try {
      avisoAtual?.remove();
      const host = document.createElement("div");
      host.id = "cw-reputacao-aviso";
      const sombra = host.attachShadow({ mode: "open" });
      const cor = tipo === "erro" ? "#9f1239" : "#5B2A86";
      sombra.innerHTML = `<style>
        .p { position: fixed; left: 16px; bottom: 16px; z-index: 2147483646; max-width: 360px; padding: 7px 12px; border-radius: 999px;
          font: 600 12px/1.4 system-ui, sans-serif; color: #fff; background: #5B2A86; box-shadow: 0 8px 24px -12px rgba(40,10,70,.5); }
      </style><div class="p" role="status"></div>`;
      const pilula = sombra.querySelector(".p");
      pilula.textContent = String(texto ?? "");
      pilula.style.background = cor;
      document.documentElement.appendChild(host);
      avisoAtual = host;
      setTimeout(() => host.remove(), 3500);
    } catch {
      /* página sem corpo ainda: o aviso só não aparece */
    }
  };

  window.CWReputacao = CW;
})();
