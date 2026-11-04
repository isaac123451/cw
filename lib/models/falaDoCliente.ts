/**
 * O que a fala do cliente pede de nós (04/11/2026).
 *
 * Pedido do Isaac: "a IA… atividades que consiga ler conversas… e já
 * faça". A IA do dia já registrava o 1º contato, completava a ficha e
 * marcava a tentativa do NPS como respondida. Faltavam os dois momentos
 * que um analista de reputação não deixa passar:
 *
 * - **"Funcionou"** — o problema foi resolvido na conversa. É a hora de
 *   pedir a avaliação no Reclame Aqui: o cliente está satisfeito agora, e
 *   em três dias já esqueceu.
 * - **Procon, advogado, justiça** — o caso escalou para fora. Vira
 *   prioridade do dia, antes que vire processo ou nova reclamação.
 *
 * Só a regra, sem IA: a frase é curta e o erro custa caro dos dois lados
 * (pedir avaliação para quem disse "não funcionou" é pior que não pedir).
 */

export type SinalDoCliente = "funcionou" | "alerta";

export interface MensagemComSinal {
  de: "nos" | "cliente";
  texto: string | null;
  em: Date;
}

export interface SinalAchado {
  sinal: SinalDoCliente;
  em: Date;
  /** O trecho que disparou, para o detalhe da atividade. */
  trecho: string;
}

export function semAcentos(texto: string) {
  return texto.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/*
  "Funcionou" e parentes. "Resolvido" sozinho também é como o cliente
  responde ao "conseguiu?" — mas "resolvi cancelar" não é, por isso o
  verbo no passado e sem complemento de intenção.
*/
const FUNCIONOU =
  /\b(funcionou|funcionando (normal|certinho|perfeitamente|agora)|deu (certo|tudo certo)|ja (esta|ta) (funcionando|normal|ok|certo)|voltou a funcionar|resolveu|resolvido|resolvida|consegui(mos)?( sim)?)\b/;

/*
  Negação, condição ou hipótese antes ("não funcionou", "nenhuma das
  tentativas deu certo", "veja se deu certo", "poderia ter sido
  resolvido"). Medido nas 1.253 mensagens reais de 90 dias (04/11/2026):
  as quatro formas eram metade dos falsos.
*/
const NEGACAO = /\b(nao|nem|nunca|nada|nenhum|nenhuma|sem|se|poderia|deveria|seria|teria|ter sido|tinha sido)\s+(\S+\s+){0,5}$/;

/* Pergunta não é afirmação ("funcionou?", "deu certo aí?"). */
const PERGUNTA = /\?\s*$/;

/*
  O "funcionou" que importa é a resposta curta ao "conseguiu?". Mensagem
  longa é relato — "um técnico resolveu depois de três dias" vem dentro
  de uma queixa, e pedir avaliação ali é pedir nota baixa.
*/
const FUNCIONOU_ATE = 200;

/* "Resolveu, porém é insustentável": resolvido com queixa não é hora de pedir nota. */
const RESSALVA = /\b(porem|entretanto|contudo|sendo que|insustentavel|absurdo|descaso|pessimo|horrivel|vergonha|demorou|demora)\b/;

/*
  O caso que saiu do atendimento. "Processo" sozinho é a palavra mais
  comum de configuração ("o processo de cadastro"), então só com verbo de
  justiça; "Reclame Aqui" não entra (é onde o caso já está).
*/
const ALERTA =
  /\b(procon|advogad[oa]s?|juridico|juizado|pequenas causas|consumidor\.gov|acao judicial|medidas? (judicia(l|is)|legais|cabiveis)|(entrar|entrarei|vou entrar|acionar|acionarei|recorrer) (na|a) justica|processar|processo judicial|danos morais|ministerio publico)\b/;

function trechoEm(texto: string, inicio: number) {
  const de = Math.max(0, inicio - 50);
  const ate = Math.min(texto.length, inicio + 90);
  return `${de > 0 ? "…" : ""}${texto.slice(de, ate).trim()}${ate < texto.length ? "…" : ""}`;
}

/** O sinal de uma mensagem do cliente, se houver. */
export function sinalNaMensagem(texto: string): { sinal: SinalDoCliente; trecho: string } | null {
  const limpo = semAcentos(texto);
  const alerta = ALERTA.exec(limpo);
  if (alerta) return { sinal: "alerta", trecho: trechoEm(texto, alerta.index) };
  if (texto.trim().length > FUNCIONOU_ATE || RESSALVA.test(limpo)) return null;

  const frases = limpo.split(/(?<=[.!?\n])/);
  let deslocamento = 0;
  for (const frase of frases) {
    const achou = FUNCIONOU.exec(frase);
    if (achou && !NEGACAO.test(frase.slice(0, achou.index)) && !PERGUNTA.test(frase)) {
      return { sinal: "funcionou", trecho: trechoEm(texto, deslocamento + achou.index) };
    }
    deslocamento += frase.length;
  }
  return null;
}

/**
 * Os sinais da conversa desde um instante: o alerta mais recente e o
 * "funcionou" mais recente — este só vale se o cliente não reclamou de
 * novo depois (a última fala dele com sinal manda).
 */
export function sinaisDaConversa(mensagens: MensagemComSinal[], desde: Date): SinalAchado[] {
  const doCliente = mensagens.filter((m) => m.de === "cliente" && m.em >= desde && m.texto?.trim());
  let alerta: SinalAchado | null = null;
  let funcionou: SinalAchado | null = null;
  for (const m of doCliente) {
    const achado = sinalNaMensagem(m.texto!);
    if (!achado) continue;
    if (achado.sinal === "alerta") alerta = { ...achado, em: m.em };
    else funcionou = { ...achado, em: m.em };
  }
  /* "Funcionou" seguido de reclamação nova não é mais "funcionou". */
  if (funcionou) {
    const depois = doCliente.filter((m) => m.em > funcionou!.em && m.texto);
    if (depois.some((m) => /\b(nao (funcionou|deu|resolveu|esta|ta)|parou|de novo|voltou o (erro|problema)|continua)\b/.test(semAcentos(m.texto!)))) {
      funcionou = null;
    }
  }
  return [alerta, funcionou].filter((s): s is SinalAchado => Boolean(s));
}
