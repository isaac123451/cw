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

export const idDoLembrete = (origem: "area" | "conversa", ref: string) => `auto-${origem}-${ref}`;

const sem = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** A frase promete um retorno nosso? */
const PROMESSA =
  /\b(?:te|lhe|vos|a gente|eu|nos|vou|vamos|irei|iremos|posso|podemos)\s+(?:te\s+|lhe\s+)?(?:ligo|ligar|ligamos|retorno|retornar|retornamos|chamo|chamar|mando|mandar|envio|enviar|falo|falar|dou retorno|dar retorno|dar um retorno|trago|trazer)\b|\b(?:retorno|ligacao|te ligo|volto a falar)\s+(?:amanha|hoje|segunda|terca|quarta|quinta|sexta|as\s+\d)/;

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
