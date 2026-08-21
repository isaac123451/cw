/**
 * Configuração da extensão, em um lugar só.
 *
 * O service worker, o popup e a tela de opções leem daqui. Os scripts
 * de conteúdo **não** — eles nunca falam com a rede nem com o storage
 * direto; perguntam ao service worker. É o padrão do Manifest V3: um
 * script de conteúdo roda dentro da página do WhatsApp e não deve ter
 * nas mãos nem o endereço nem o cookie da sessão.
 */

export const PADROES = {
  /**
   * Endereço da aplicação. O padrão é o servidor de desenvolvimento
   * porque é a única origem que o manifesto pode declarar de antemão:
   * o endereço de produção varia por instalação e entra como permissão
   * opcional, pedida na tela de opções.
   */
  base: "http://localhost:3000",

  /** Abrir o painel sozinho ao entrar numa conversa reconhecida. */
  autoAbrir: false,

  /**
   * Tema: "auto", "claro" ou "escuro".
   *
   * Três estados, e não um interruptor: quem trabalha o dia inteiro no
   * WhatsApp Web escuro quer o painel escuro junto, mas quem alterna
   * entre telas claras e escuras quer poder fixar. "auto" segue o
   * sistema.
   */
  tema: "auto",

  /** Largura da gaveta em pixels, ajustável arrastando a borda. */
  largura: 380,

  /**
   * Manter o painel aberto.
   *
   * O WhatsApp Web reescreve a árvore da página em algumas navegações,
   * e o painel precisa se remontar quando isso acontece — remontado, ele
   * nascia fechado, o que parecia uma minimização espontânea. Com isto
   * ligado, ele volta aberto, do jeito que estava.
   */
  fixado: false,

  /**
   * Posição da janela quando solta do canto, em pixels.
   *
   * `null` significa ancorada à direita, que é o padrão. Vira
   * `{ x, y }` no momento em que alguém arrasta o cabeçalho.
   */
  posicao: null,

  /** Contador de pendências no ícone da extensão. */
  contador: true,

  /** Aviso de área de trabalho, no máximo uma vez por dia. */
  aviso: true,

  /**
   * Cobrança das etapas do fluxo.
   *
   * Quem define o intervalo é cada etapa, na tela de fluxo. Isto aqui é
   * só o interruptor geral — para quem quer silêncio numa tarde sem
   * precisar desconfigurar o quadro inteiro.
   */
  lembretes: true,
};

export const CHAVE = "cw-reputacao-config";

export async function lerConfig() {

  const guardado = await chrome.storage.sync.get(CHAVE);

  return { ...PADROES, ...(guardado[CHAVE] ?? {}) };
}

export async function gravarConfig(parcial) {

  const atual = await lerConfig();

  const novo = { ...atual, ...parcial };

  await chrome.storage.sync.set({ [CHAVE]: novo });

  return novo;
}

/** Sem barra no fim: o resto do código sempre concatena com "/...". */
export function normalizarBase(valor) {

  const limpo = String(valor ?? "").trim();

  if (limpo === "") return "";

  const comEsquema = /^https?:\/\//i.test(limpo)
    ? limpo
    : `https://${limpo}`;

  try {
    const url = new URL(comEsquema);
    return `${url.protocol}//${url.host}`;
  } catch {
    return "";
  }
}

/** Padrão de permissão exigido para ler cookie e chamar a API. */
export function padraoDeOrigem(base) {
  return base ? `${base}/*` : "";
}
