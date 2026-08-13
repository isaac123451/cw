import { Case } from "@/lib/models/case";
import { CaseMovement } from "@/lib/models/movement";

import { movementsOf } from "@/lib/services/movement.service";

export type TimelineTone =
  | "origem"
  | "andamento"
  | "movimentacao"
  | "retorno"
  | "avaliacao"
  | "encerramento";

export interface TimelineEntry {
  id: string;
  title: string;
  detail: string;
  at: string;
  tone: TimelineTone;
}

export const TIMELINE_TONE: Record<TimelineTone, string> = {
  origem: "bg-violet-500",
  andamento: "bg-sky-500",
  movimentacao: "bg-amber-500",
  retorno: "bg-teal-500",
  avaliacao: "bg-violet-500",
  encerramento: "bg-emerald-600",
};

/**
 * Linha do tempo do caso.
 *
 * Parte do que aparece aqui é derivado do próprio caso (registro,
 * classificação, resposta, avaliação, encerramento) e parte é registro
 * de verdade — as movimentações internas. O merge acontece neste
 * serviço, e não no componente, porque a mesma linha alimenta a aba
 * Histórico da tela cheia e a do drawer.
 */
export function buildTimeline(
  item: Case,
  movements: CaseMovement[] = []
): TimelineEntry[] {

  const entries: TimelineEntry[] = [
    {
      id: "registro",
      title: "Reclamação registrada",
      detail: `Recebida via ${item.source}`,
      at: item.createdAt,
      tone: "origem",
    },
    {
      id: "responsavel",
      title: "Responsável definido",
      detail: item.owner ?? "Sem responsável",
      at: item.createdAt,
      tone: "andamento",
    },
    {
      id: "classificacao",
      title: "Classificada",
      detail: item.subcategory
        ? `${item.category} · ${item.subcategory}`
        : item.category,
      at: item.createdAt,
      tone: "andamento",
    },
  ];

  for (const movement of movementsOf(item.id, movements)) {

    entries.push({
      id: `mov-${movement.id}`,
      title: `Encaminhado para ${movement.destination}`,
      detail: `${movement.reason} · por ${movement.actor}`,
      at: movement.startedAt,
      tone: "movimentacao",
    });

    if (movement.returnedAt) {
      entries.push({
        id: `ret-${movement.id}`,
        title: `Retorno de ${movement.destination}`,
        detail:
          movement.outcome ?? "Retorno registrado.",
        at: movement.returnedAt,
        tone: "retorno",
      });
    }
  }

  if ((item.publicResponse ?? "").trim() !== "") {
    entries.push({
      id: "resposta",
      title: "Resposta pública publicada",
      detail: item.responseTime
        ? `Retorno em ${item.responseTime}`
        : "Publicada no portal",
      at: item.updatedAt ?? item.createdAt,
      tone: "andamento",
    });
  }

  if (item.evaluated) {
    entries.push({
      id: "avaliacao",
      title: "Cliente avaliou",
      detail: `Nota ${item.score ?? 0} · voltaria: ${
        item.wouldDoBusiness ? "sim" : "não"
      }`,
      at:
        item.evaluatedAt ??
        item.updatedAt ??
        item.createdAt,
      tone: "avaliacao",
    });
  }

  if (item.resolved) {
    entries.push({
      id: "encerramento",
      title: "Caso encerrado",
      detail: item.solutionTime
        ? `Solução em ${item.solutionTime}`
        : "Encerrado pela operação",
      at: item.updatedAt ?? item.createdAt,
      tone: "encerramento",
    });
  }

  // Cronológica. Empate mantém a ordem de construção, que é a ordem
  // natural do ciclo — registro antes de classificação, por exemplo.
  return entries.sort((a, b) => a.at.localeCompare(b.at));
}
