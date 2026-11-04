import type { AgendaTask } from "@/lib/models/agenda";
import type { Case } from "@/lib/models/case";
import type { NpsResponseView } from "@/lib/models/nps";
import { etapaDasRedes } from "@/lib/models/redes";

import { isSocial, semRespostaPublica } from "@/lib/services/case.service";
import { slaState, summarize } from "@/lib/services/nps.service";
import { segmentOf } from "@/lib/models/nps";
import { diaNaOperacao } from "@/lib/services/reputation.service";
import { pluralDe } from "@/lib/plural";

/**
 * O número ao lado de cada item do menu (Fase 11).
 *
 * **Só o que pede ação**, e com a conta da própria tela — um "12" no menu
 * que vira "9" ao abrir a tela ensina a ignorar o menu:
 *
 * - Meu dia: a fila de hoje, o mesmo número do "Próximo passo" (desde
 *   04/11/2026; antes eram os prazos estourados — 559, em vermelho);
 * - Reclame Aqui: reclamações abertas sem resposta pública;
 * - Redes: atendimentos ainda não encerrados;
 * - NPS: detratores com o 1º contato fora do prazo (desde 04/11/2026; o
 *   total de ciclos atrasados — 548 — vai na explicação);
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
  /** Conversas do WhatsApp esperando resposta, pela extensão (1.121). */
  esperandoNoWhatsapp?: number;
  /** O tamanho da fila de hoje do Meu dia, quando já calculado (`filaDeHojeGuardada`). */
  filaDeHoje?: number | null;
  tarefas: AgendaTask[];
  agora: Date;
}): Record<string, ContadorDoMenu> {
  const { casos, nps, tarefas, agora } = entrada;
  const hoje = diaNaOperacao(agora);

  const semResposta = casos.filter(semRespostaPublica).length;
  const redesAbertas = casos.filter((c) => isSocial(c) && !etapaDasRedes(c.status)?.final).length;
  const npsForaDoPrazo = summarize(nps, agora).estourados;
  /* De quem são os atrasos (22/10/2026): o "307" escondia que só 32 eram detratores — os que mais pedem a ligação. */
  const atrasadosDoNps = nps.filter((i) => slaState(i, agora) === "estourado");
  const porSegmento = (rotulo: string) => atrasadosDoNps.filter((i) => segmentOf(i.score).label === rotulo).length;
  const quebraDoNps = atrasadosDoNps.length
    ? ` — ${porSegmento("Detrator")} ${pluralDe(porSegmento("Detrator"), "detrator", "detratores")}, ${porSegmento("Passivo")} ${pluralDe(porSegmento("Passivo"), "passivo", "passivos")}, ${porSegmento("Promotor")} ${pluralDe(porSegmento("Promotor"), "promotor", "promotores")}`
    : "";
  const detratoresAtrasados = porSegmento("Detrator");
  const tarefasDoDia = tarefas.filter((t) => !t.done && t.dueDate <= hoje);
  const tarefasAtrasadas = tarefasDoDia.filter((t) => t.dueDate < hoje).length;

  const c = (valor: number, urgente: boolean, explicacao: string): ContadorDoMenu => ({ valor, urgente, explicacao });

  return {
    "/meu-dia": c(entrada.filaDeHoje ?? 0, false, `${entrada.filaDeHoje ?? 0} para hoje no Meu dia`),
    "/reclame-aqui": c(semResposta, false, `${semResposta} ${pluralDe(semResposta, "reclamação", "reclamações")} ${pluralDe(semResposta, "aberta", "abertas")} sem resposta pública`),
    "/redes-sociais": c(redesAbertas, false, `${redesAbertas} ${pluralDe(redesAbertas, "atendimento", "atendimentos")} em aberto`),
    "/nps": c(detratoresAtrasados, detratoresAtrasados > 0, `${detratoresAtrasados} ${pluralDe(detratoresAtrasados, "detrator", "detratores")} com o 1º contato fora do prazo (${npsForaDoPrazo} ${pluralDe(npsForaDoPrazo, "ciclo", "ciclos")} no total${quebraDoNps})`),
    "/google": c(entrada.googleAbertas, false, `${entrada.googleAbertas} ${pluralDe(entrada.googleAbertas, "avaliação", "avaliações")} ${pluralDe(entrada.googleAbertas, "aberta", "abertas")}`),
    "/agenda": c(tarefasDoDia.length, tarefasAtrasadas > 0, `${tarefasDoDia.length} ${pluralDe(tarefasDoDia.length, "atividade", "atividades")} para hoje${tarefasAtrasadas ? `, ${tarefasAtrasadas} ${pluralDe(tarefasAtrasadas, "atrasada", "atrasadas")}` : ""}`),
    "/conversas": c(entrada.esperandoNoWhatsapp ?? 0, false, `${entrada.esperandoNoWhatsapp ?? 0} ${pluralDe(entrada.esperandoNoWhatsapp ?? 0, "conversa", "conversas")} esperando resposta no WhatsApp`),
  };
}

/** "1,2 mil" a partir de mil: o número cabe na pílula sem empurrar o nome. */
export function numeroCurto(n: number) {
  if (n < 1000) return String(n);
  return `${(n / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
}
