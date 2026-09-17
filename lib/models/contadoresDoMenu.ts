import type { AgendaTask } from "@/lib/models/agenda";
import type { Case } from "@/lib/models/case";
import { respondida } from "@/lib/models/case";
import type { NpsResponseView } from "@/lib/models/nps";
import { etapaDasRedes } from "@/lib/models/redes";
import type { SlaRule } from "@/lib/models/sla";

import { prazosDeHoje } from "@/lib/models/aberturaDoAgente";
import { isOpen, isReclameAqui, isSocial } from "@/lib/services/case.service";
import type { Expediente } from "@/lib/services/horasUteis";
import { summarize } from "@/lib/services/nps.service";
import { diaNaOperacao } from "@/lib/services/reputation.service";

/**
 * O número ao lado de cada item do menu (Fase 11).
 *
 * **Só o que pede ação**, e com a conta da própria tela — um "12" no menu
 * que vira "9" ao abrir a tela ensina a ignorar o menu:
 *
 * - Meu dia: prazos estourados (`prazosDeHoje`, o mesmo do Assistente e
 *   do popup da extensão);
 * - Reclame Aqui: reclamações abertas sem resposta pública;
 * - Redes: atendimentos ainda não encerrados;
 * - NPS: ciclos com o 1º contato fora do prazo (`summarize`, o da tela);
 * - Google: avaliações abertas;
 * - Agenda: atividades vencidas ou de hoje, não feitas.
 *
 * `urgente` pinta o número de vermelho: é quando há algo já atrasado.
 */
export interface ContadorDoMenu {
  valor: number;
  urgente: boolean;
  /** O que o número conta, para o `title`. */
  explicacao: string;
}

export function contadoresDoMenu(entrada: {
  casos: Case[];
  nps: NpsResponseView[];
  googleAbertas: number;
  tarefas: AgendaTask[];
  regras: SlaRule[];
  expediente: Expediente;
  agora: Date;
}): Record<string, ContadorDoMenu> {
  const { casos, nps, tarefas, agora } = entrada;
  const abertos = casos.filter(isOpen);
  const hoje = diaNaOperacao(agora);

  const prazos = prazosDeHoje(abertos, entrada.regras, nps, entrada.expediente, agora);
  const semResposta = abertos.filter((c) => isReclameAqui(c) && !respondida(c)).length;
  const redesAbertas = casos.filter((c) => isSocial(c) && !etapaDasRedes(c.status)?.final).length;
  const npsForaDoPrazo = summarize(nps, agora).estourados;
  const tarefasDoDia = tarefas.filter((t) => !t.done && t.dueDate <= hoje);
  const tarefasAtrasadas = tarefasDoDia.filter((t) => t.dueDate < hoje).length;

  const c = (valor: number, urgente: boolean, explicacao: string): ContadorDoMenu => ({ valor, urgente, explicacao });

  return {
    "/meu-dia": c(prazos.estourados, prazos.estourados > 0, `${prazos.estourados} prazo(s) estourado(s)`),
    "/reclame-aqui": c(semResposta, false, `${semResposta} reclamação(ões) aberta(s) sem resposta pública`),
    "/redes-sociais": c(redesAbertas, false, `${redesAbertas} atendimento(s) em aberto`),
    "/nps": c(npsForaDoPrazo, npsForaDoPrazo > 0, `${npsForaDoPrazo} ciclo(s) com o 1º contato fora do prazo`),
    "/google": c(entrada.googleAbertas, false, `${entrada.googleAbertas} avaliação(ões) aberta(s)`),
    "/agenda": c(tarefasDoDia.length, tarefasAtrasadas > 0, `${tarefasDoDia.length} atividade(s) para hoje${tarefasAtrasadas ? `, ${tarefasAtrasadas} atrasada(s)` : ""}`),
  };
}

/** "1,2 mil" a partir de mil: o número cabe na pílula sem empurrar o nome. */
export function numeroCurto(n: number) {
  if (n < 1000) return String(n);
  return `${(n / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
}
