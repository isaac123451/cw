import { Case } from "@/lib/models/case";
import {
  isOpen,
  isReclameAqui,
  isSocial,
} from "@/lib/services/case.service";

export type Sentiment =
  | "Promotor"
  | "Neutro"
  | "Detrator";

export interface CustomerJourney {
  company: string;

  customers: string[];

  cases: Case[];

  total: number;

  open: number;

  resolved: number;

  averageScore: number;

  sentiment: Sentiment;

  churnRisk: boolean;

  /** Mais de um caso registrado para a mesma empresa. */
  recurring: boolean;

  lastInteraction: string;

  /** Quantos casos vieram de cada frente. */
  reclameAqui: number;
  social: number;

  /** Etapa sugerida pelos dados, antes de qualquer ajuste manual. */
  suggestedStage: string;
}

/**
 * Deduz a etapa do ciclo de vida a partir do comportamento do cliente.
 * É só uma sugestão: a operação pode arrastar o card para outra etapa.
 */
function suggestStage(input: {
  churnRisk: boolean;
  averageScore: number;
  total: number;
  resolved: number;
  wouldReturn: boolean;
}): string {

  if (input.churnRisk) return "Em risco";

  if (input.total === 1 && input.resolved === 0) {
    return "Primeiro contato";
  }

  if (input.averageScore >= 8 && input.wouldReturn) {
    return "Promotor";
  }

  if (
    input.resolved > 0 &&
    input.resolved === input.total
  ) {
    return "Recuperado";
  }

  return "Em acompanhamento";
}

function sentimentOf(score: number): Sentiment {
  if (score >= 7) return "Promotor";
  if (score >= 5) return "Neutro";
  return "Detrator";
}

export function buildJourneys(
  cases: Case[]
): CustomerJourney[] {

  const map = new Map<string, Case[]>();

  for (const item of cases) {
    map.set(item.company, [
      ...(map.get(item.company) ?? []),
      item,
    ]);
  }

  return [...map.entries()]
    .map(([company, items]) => {

      const sorted = [...items].sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt)
      );

      const scored = items.filter(
        (item) => typeof item.score === "number"
      );

      const averageScore =
        scored.length === 0
          ? 0
          : scored.reduce(
              (sum, item) => sum + (item.score ?? 0),
              0
            ) / scored.length;

      const churnRisk = items.some(
        (item) => item.churnRisk
      );

      const resolved = items.filter(
        (item) => item.resolved
      ).length;

      const score = Math.round(averageScore * 10) / 10;

      return {
        company,

        customers: [
          ...new Set(items.map((item) => item.customer)),
        ],

        cases: sorted,

        total: items.length,

        open: items.filter(isOpen).length,

        resolved,

        averageScore: score,

        sentiment: sentimentOf(averageScore),

        churnRisk,

        recurring: items.length > 1,

        lastInteraction:
          sorted[0]?.lastInteraction ??
          sorted[0]?.createdAt ??
          "-",

        reclameAqui: items.filter(isReclameAqui).length,

        social: items.filter(isSocial).length,

        suggestedStage: suggestStage({
          churnRisk,
          averageScore: score,
          total: items.length,
          resolved,
          wouldReturn: items.some(
            (item) => item.wouldDoBusiness
          ),
        }),
      };
    })
    .sort((a, b) => {

      if (a.churnRisk !== b.churnRisk) {
        return a.churnRisk ? -1 : 1;
      }

      return b.total - a.total;
    });
}
