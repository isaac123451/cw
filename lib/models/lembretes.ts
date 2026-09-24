import type { AgendaTask } from "@/lib/models/agenda";
import { EXPEDIENTE_PADRAO, paredeDe, proximoDiaUtil, type Expediente } from "@/lib/services/horasUteis";

/**
 * O lembrete que avisa (Fase 25).
 *
 * A atividade com hora marcada não chamava ninguém: ficava na lista
 * esperando alguém abrir a Agenda. Na hora marcada, ela aparece na tela
 * — em qualquer página — com abrir o caso e adiar 15 minutos, 1 hora ou
 * para o próximo dia útil.
 */

const minutoDe = (hora?: string) => {
  const m = hora?.match(/^(\d{1,2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/**
 * A marca de "já avisei" é da atividade **naquele horário**: adiada, ela
 * ganha outro horário e avisa de novo.
 */
export const chaveDoAviso = (t: Pick<AgendaTask, "id" | "dueDate" | "time">) => `${t.id}@${t.dueDate}T${t.time ?? ""}`;

/** As atividades de hoje cuja hora chegou, ainda abertas e ainda não dispensadas. */
export function lembretesNaHora(tarefas: AgendaTask[], agora: Date, vistos: ReadonlySet<string>) {
  const { dia, min } = paredeDe(agora);
  return tarefas
    .filter((t) => {
      const m = minutoDe(t.time);
      return !t.done && t.dueDate === dia && m !== null && m <= min && !vistos.has(chaveDoAviso(t));
    })
    .sort((a, b) => (minutoDe(a.time) ?? 0) - (minutoDe(b.time) ?? 0));
}

export type AdiamentoDoLembrete = "15min" | "1h" | "amanha";

/**
 * O novo dia e hora de um lembrete adiado.
 *
 * 15 minutos e 1 hora contam de agora — adiar é "me lembra daqui a
 * pouco", não "do horário antigo". Passou da meia-noite, vai para o dia
 * seguinte. "Amanhã" é o próximo dia útil, no mesmo horário.
 */
export function adiarLembrete(
  t: Pick<AgendaTask, "dueDate" | "time">,
  como: AdiamentoDoLembrete,
  agora: Date,
  expediente: Expediente = EXPEDIENTE_PADRAO
): { dueDate: string; time: string } {
  const { dia, min } = paredeDe(agora);
  if (como === "amanha") return { dueDate: proximoDiaUtil(dia, expediente), time: t.time ?? hhmm(min) };
  const novo = min + (como === "15min" ? 15 : 60);
  if (novo < 24 * 60) return { dueDate: dia, time: hhmm(novo) };
  const amanha = new Date(Date.parse(`${dia}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  return { dueDate: amanha, time: hhmm(novo - 24 * 60) };
}
