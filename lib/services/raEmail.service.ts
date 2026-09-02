/**
 * O aviso do Reclame Aqui, lido como dado.
 *
 * **O que este arquivo é.** Funções puras: entra o texto de um e-mail,
 * sai uma reclamação ou `null`. Nenhuma consulta, nenhuma escrita,
 * nenhuma chamada de rede — é o que permite conferir cada regra contra
 * uma amostra real em `npm run check:email-ra`, sem banco e sem Gmail.
 *
 * **O e-mail é texto de terceiro.** Ele chega de fora, escrito por
 * outra pessoa, e é tratado exclusivamente como conteúdo a extrair.
 * Nada dele vira comando, caminho ou consulta; o que não casar com um
 * padrão declarado aqui é descartado.
 *
 * **Recusar é melhor que inventar.** Se o protocolo não for encontrado,
 * a função devolve `null` e nenhuma reclamação é criada. Um caso com
 * protocolo errado entra no Kanban, recebe dono, é respondido e vira
 * um erro caro; um aviso não processado fica no e-mail, onde já estava.
 * O `check:email-ra` diz exatamente qual campo faltou.
 */

export interface AvisoDeReclamacao {
  /** O identificador da reclamação no Reclame Aqui. */
  protocolo: string;
  titulo: string;
  consumidor?: string;
  cidade?: string;
  estado?: string;
  /** O que o consumidor escreveu, quando o aviso traz. */
  relato?: string;
  /** Link para a reclamação no portal, quando existe. */
  url?: string;
  /** Data do aviso, em ISO — vem do cabeçalho, não do corpo. */
  recebidoEm: string;
}

/**
 * De quem o aviso precisa vir.
 *
 * Casar por remetente é a primeira defesa e a mais barata: qualquer um
 * pode mandar um e-mail dizendo "nova reclamação". Só os domínios
 * abaixo entram, e a comparação é no domínio, não no nome de exibição,
 * que é livre.
 */
const REMETENTES = [
  "reclameaqui.com.br",
  "hugme.com.br",
];

export function remetenteConfiavel(de: string) {

  const dominio = de
    .match(/<([^>]+)>/)?.[1]
    ?.split("@")[1]
    ?.toLowerCase()
    ?? de.split("@")[1]?.toLowerCase()
    ?? "";

  return REMETENTES.some(
    (bom) => dominio === bom || dominio.endsWith(`.${bom}`)
  );
}

/**
 * Os jeitos de o protocolo aparecer, do mais específico ao mais solto.
 *
 * Lista, e não um padrão só, porque o formato do aviso muda com o
 * tempo e entre tipos de notificação. Cada entrada é uma forma já
 * observada ou declarada; a ordem importa, porque a primeira que casar
 * ganha, e as de cima carregam rótulo — são as que não podem ser
 * confundidas com outro número da mensagem.
 *
 * **Nenhum padrão é um número solto.** Um `\d{8,}` pego em qualquer
 * lugar do texto casaria com CEP, telefone ou id de campanha, e o caso
 * entraria com protocolo errado, que é o defeito que este módulo
 * inteiro existe para evitar.
 */
const PADROES_DE_PROTOCOLO: RegExp[] = [
  /protocolo[:\s]+([A-Z0-9][A-Z0-9._-]{5,30})/i,
  /reclama(?:ção|cao)\s+n[º°o.]?\s*([A-Z0-9][A-Z0-9._-]{5,30})/i,
  /\bID[:\s]+([A-Z0-9][A-Z0-9._-]{5,30})/i,
  /reclameaqui\.com\.br\/[^\s]*?[?&]id=([A-Za-z0-9_-]{6,40})/i,
  /hugme\.com\.br\/[^\s]*?\/(\d{6,})/i,
];

const PADROES_DE_TITULO: RegExp[] = [
  /(?:assunto|título|titulo)[:\s]+(.{5,140}?)(?:\n|$)/i,
  /nova reclama(?:ção|cao)[:\s—-]+(.{5,140}?)(?:\n|$)/i,
];

const PADROES_DE_CONSUMIDOR: RegExp[] = [
  /(?:consumidor|cliente|reclamante)[:\s]+(.{3,80}?)(?:\n|$)/i,
];

const PADROES_DE_LOCAL: RegExp[] = [
  /(?:cidade|local)[:\s]+([^\n,]{2,60}?)\s*[,/-]\s*([A-Z]{2})\b/i,
];

const PADROES_DE_RELATO: RegExp[] = [
  /(?:relato|descri(?:ção|cao)|mensagem do consumidor)[:\s]+([\s\S]{20,4000}?)(?:\n\s*\n|$)/i,
];

function primeiro(
  texto: string,
  padroes: RegExp[]
): string | undefined {

  for (const padrao of padroes) {
    const achado = texto.match(padrao)?.[1]?.trim();
    if (achado) return achado;
  }

  return undefined;
}

/** O link da reclamação, se houver um. */
function linkDaReclamacao(texto: string) {
  return texto.match(
    /https?:\/\/[^\s<>"]*(?:reclameaqui|hugme)\.com\.br[^\s<>"]*/i
  )?.[0];
}

/**
 * Interpreta o aviso. Devolve `null` quando não reconhece.
 *
 * Três motivos para devolver `null`, e os três são deliberados:
 *
 * 1. **Remetente que não é o do portal.** Qualquer um manda e-mail.
 * 2. **Sem protocolo.** É a chave da reclamação; sem ela não há como
 *    ligar ao que já existe, e criar um caso sem chave produz
 *    duplicata a cada nova execução da rotina.
 * 3. **Sem título.** Um caso sem assunto não é acionável no Kanban, e
 *    o assunto é o mínimo para alguém decidir o que fazer.
 *
 * O que é opcional continua opcional: cidade, relato e nome do
 * consumidor entram quando o aviso os traz, e ficam vazios quando não —
 * a extensão completa depois, ao abrir a reclamação no portal.
 */
export function interpretarAviso(mensagem: {
  remetente: string;
  assunto: string;
  texto: string;
  recebidoEm: string;
}): AvisoDeReclamacao | null {

  if (!remetenteConfiavel(mensagem.remetente)) {
    return null;
  }

  /*
    Assunto e corpo juntos, nesta ordem.

    Metade dos avisos traz o protocolo só no assunto e o resto no
    corpo. Procurar nos dois como um texto só evita duplicar cada
    padrão — e o assunto vem primeiro porque, quando ele traz o
    protocolo, é a fonte mais limpa.
  */
  const inteiro = `${mensagem.assunto}\n${mensagem.texto}`;

  const protocolo = primeiro(
    inteiro,
    PADROES_DE_PROTOCOLO
  );

  if (!protocolo) return null;

  const titulo =
    primeiro(inteiro, PADROES_DE_TITULO) ??
    /*
      Sem rótulo de assunto, vale o assunto do e-mail — limpo do
      prefixo do portal, que se repete em todos e não diz nada.
    */
    mensagem.assunto
      .replace(
        /^\s*(re:|enc:|fwd:)?\s*(reclame aqui|hugme)\s*[-–—:]\s*/i,
        ""
      )
      .trim();

  if (!titulo) return null;

  const local = PADROES_DE_LOCAL.map((p) =>
    inteiro.match(p)
  ).find(Boolean);

  return {
    protocolo,
    titulo: titulo.slice(0, 140),
    consumidor: primeiro(inteiro, PADROES_DE_CONSUMIDOR),
    cidade: local?.[1]?.trim(),
    estado: local?.[2]?.toUpperCase(),
    relato: primeiro(inteiro, PADROES_DE_RELATO),
    url: linkDaReclamacao(inteiro),
    recebidoEm: mensagem.recebidoEm,
  };
}

/**
 * A consulta do Gmail que traz os avisos.
 *
 * Escrita aqui, e não espalhada, para caber numa linha de leitura: é
 * exatamente o que a rotina vai olhar na caixa de entrada, e nada além.
 *
 * `newer_than` limita a primeira execução: sem ele, uma caixa com anos
 * de histórico viraria centenas de chamadas e reclamações antigas
 * entrando como novas.
 */
export function consultaDeAvisos(dias = 7) {
  return `(from:reclameaqui.com.br OR from:hugme.com.br) newer_than:${dias}d`;
}
