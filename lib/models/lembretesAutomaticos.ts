import { entenderLinha } from "@/lib/models/linhaDaAgenda";

/**
 * O lembrete que nasce sozinho (Fase 25).
 *
 * "Lembretes você pode criar automaticamente identificando alguma
 * pendência e agendamento com o cliente." Duas origens, cada uma com um
 * id fixo — a mesma pendência nunca vira dois lembretes, e o lembrete
 * desfeito (concluído) não volta:
 *
 * - **a área acionada** sem retorno: "Cobrar retorno do Financeiro" na
 *   hora do prazo da área;
 * - **o combinado na conversa**: a nossa mensagem guardada que promete
 *   um retorno com dia ou hora — "te ligo amanhã às 10h" — vira lembrete
 *   nesse dia e hora, contados a partir do dia da mensagem.
 */

export const idDoLembrete = (origem: "area" | "conversa" | "pedido" | "reuniao" | "promessa" | "espera", ref: string) => `auto-${origem}-${ref}`;

/**
 * O pedido do cliente com dia ou hora (Fase 36, 1.98): "me liga amanhã às
 * 15h", "pode retornar segunda?", "me manda o boleto até sexta". Vira
 * atividade para quem atende — é o combinado do outro lado da conversa.
 */
const PEDIDO =
  /\b(?:me\s+)?(?:liga|ligue|ligar|chama|chame|retorna|retorne|manda|mande|envia|envie|responde|responda)\b|\bpode(?:ria)?\s+(?:me\s+)?(?:ligar|chamar|retornar|mandar|enviar)\b|\baguardo\s+(?:o\s+|seu\s+)?retorno\b/;

/** Reunião, call, videochamada — de qualquer lado da conversa. */
const REUNIAO = /\b(?:reuniao|call|videochamada|video chamada|chamada de video|meet|zoom|teams)\b/;

function comDiaOuHora(texto: string, diaDaMensagem: string, padrao: RegExp) {
  const frases = texto.split(/(?<=[.!?\n])\s+/).map((f) => f.trim()).filter(Boolean);
  for (const frase of frases) {
    if (!padrao.test(sem(frase))) continue;
    const l = entenderLinha(frase, diaDaMensagem);
    if (!l) continue;
    if (l.dueDate === diaDaMensagem && !l.time) continue;
    const trecho = frase.length > 90 ? `${frase.slice(0, 89).trimEnd()}…` : frase;
    return { dueDate: l.dueDate, time: l.time, trecho };
  }
  return null;
}

export function pedidoNaMensagem(texto: string, diaDaMensagem: string) {
  return comDiaOuHora(texto, diaDaMensagem, PEDIDO);
}

export function reuniaoNaMensagem(texto: string, diaDaMensagem: string) {
  return comDiaOuHora(texto, diaDaMensagem, REUNIAO);
}

const sem = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** A frase promete um retorno nosso? */
const PROMESSA =
  /\b(?:te|lhe|vos|a gente|eu|nos|vou|vamos|irei|iremos|posso|podemos)\s+(?:te\s+|lhe\s+)?(?:ligo|ligar|ligamos|retorno|retornar|retornamos|chamo|chamar|mando|mandar|envio|enviar|falo|falar|dou retorno|dar retorno|dar um retorno|trago|trazer)\b|\b(?:retorno|ligacao|te ligo|volto a falar)\s+(?:amanha|hoje|segunda|terca|quarta|quinta|sexta|as\s+\d)/;

/* ============================================================
   O COMBINADO SEM DATA (09/10/2026)
============================================================ */

/*
  "Quero que apareça tudo aquilo de lembrete, seja eu falando pro cliente,
  pra eu lembrar e fazer, ou ele mesmo." O combinado com dia e hora já
  virava lembrete; o mais comum — "vou verificar e te retorno", "te mando o
  CNPJ" — não tem data nenhuma, e era exatamente o que se perdia.
*/

/** O que nós prometemos fazer: retornar, verificar, acionar a área. */
const NOS_VAMOS =
  /\b(?:vou|vamos|irei|iremos|ja vou|estou|estamos|deixa (?:eu|que eu))\s+(?:ja\s+)?(?:verificar|conferir|checar|olhar|ver|analisar|consultar|acionar|resolver|providenciar|encaminhar|abrir um chamado|abrir chamado|falar com|levar (?:isso|para)|testar|ajustar|corrigir)\b/;

/** O que o cliente disse que vai fazer — e que fica esperando a gente cobrar. */
const CLIENTE_VAI =
  /\b(?:vou|vamos|ja vou|irei|depois eu|mais tarde eu|amanha eu|assim que (?:eu )?(?:puder|der))\s+(?:te\s+|lhe\s+)?(?:mandar|enviar|passar|verificar|ver|olhar|conferir|testar|tentar|falar com|retornar|responder|separar|pegar|tirar (?:o |um )?print)\b|\bte\s+(?:mando|envio|passo|retorno|respondo|aviso|falo)\b|\bja\s+(?:te\s+)?(?:mando|envio|passo)\b/;

function frasesQueCasam(texto: string, padrao: RegExp, diaDaMensagem: string) {
  const frases = texto.split(/(?<=[.!?\n])\s+/).map((f) => f.trim()).filter(Boolean);
  for (const frase of frases) {
    if (!padrao.test(sem(frase))) continue;
    /* Com dia ou hora, quem cuida é o combinado/pedido com data — não duplica. */
    const l = entenderLinha(frase, diaDaMensagem);
    if (l && (l.dueDate !== diaDaMensagem || l.time)) continue;
    return frase.length > 90 ? `${frase.slice(0, 89).trimEnd()}…` : frase;
  }
  return null;
}

/** "Vou verificar e te retorno": a promessa nossa sem dia nem hora. */
export function promessaSemData(texto: string, diaDaMensagem: string) {
  return frasesQueCasam(texto, new RegExp(`${PROMESSA.source}|${NOS_VAMOS.source}`), diaDaMensagem);
}

/** "Te mando o CNPJ", "vou testar aqui": o cliente ficou de fazer algo, sem data. */
export function esperaDoCliente(texto: string, diaDaMensagem: string) {
  return frasesQueCasam(texto, CLIENTE_VAI, diaDaMensagem);
}

export interface MensagemDoCombinado {
  id: string;
  de: string;
  texto: string;
  /** ISO. */
  em: string;
  /** AAAA-MM-DD em Brasília. */
  dia: string;
}

export interface CombinadoSemData {
  tipo: "promessa" | "espera";
  mensagemId: string;
  trecho: string;
  /** ISO da mensagem — o prazo conta daí. */
  em: string;
}

/**
 * O combinado sem data que ainda está de pé numa conversa: no máximo um
 * de cada lado — o mais recente.
 *
 * Já cumprido não volta: a promessa nossa seguida de outra mensagem nossa
 * (a resposta veio), ou a espera seguida de mensagem do cliente (ele
 * mandou), não viram lembrete.
 */
export function combinadosSemData(mensagens: MensagemDoCombinado[]): CombinadoSemData[] {
  const ordem = [...mensagens].sort((a, b) => a.em.localeCompare(b.em));
  const saida: CombinadoSemData[] = [];

  for (const [tipo, lado, achar] of [
    ["promessa", "nos", promessaSemData],
    ["espera", "cliente", esperaDoCliente],
  ] as const) {
    for (let i = ordem.length - 1; i >= 0; i--) {
      const m = ordem[i];
      if ((lado === "nos") !== (m.de === "nos")) continue;
      const trecho = achar(m.texto, m.dia);
      if (!trecho) continue;
      const cumprido = ordem.slice(i + 1).some((d) => (lado === "nos" ? d.de === "nos" : d.de === "cliente"));
      if (!cumprido) saida.push({ tipo, mensagemId: m.id, trecho, em: m.em });
      break;
    }
  }

  return saida;
}

/**
 * O combinado de uma mensagem nossa: o dia e a hora prometidos, e o
 * trecho — ou `null` quando não há promessa com dia ou hora.
 *
 * @param diaDaMensagem AAAA-MM-DD em Brasília: "amanhã" conta daí.
 */
export function combinadoNaMensagem(texto: string, diaDaMensagem: string): { dueDate: string; time?: string; trecho: string } | null {
  const frases = texto.split(/(?<=[.!?\n])\s+/).map((f) => f.trim()).filter(Boolean);
  for (const frase of frases) {
    if (!PROMESSA.test(sem(frase))) continue;
    const l = entenderLinha(frase, diaDaMensagem);
    if (!l) continue;
    /* Sem dia nem hora ("vou verificar e te retorno") não é agendamento. */
    if (l.dueDate === diaDaMensagem && !l.time) continue;
    const trecho = frase.length > 90 ? `${frase.slice(0, 89).trimEnd()}…` : frase;
    return { dueDate: l.dueDate, time: l.time, trecho };
  }
  return null;
}
