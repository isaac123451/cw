import { Case } from "@/lib/models/case";
import { Establishment } from "@/lib/models/establishment";
import { ImpactRecord } from "@/lib/models/impact";

import {
  isOpen,
  isReclameAqui,
  isSocial,
} from "@/lib/services/case.service";

import { getReputation } from "@/lib/services/reputation.service";

export interface EstablishmentStats {
  total: number;
  open: number;
  resolved: number;
  churnRisk: number;

  reclameAqui: number;
  social: number;

  /** Nota RA calculada só com as reclamações deste estabelecimento. */
  raScore: number;
  responseIndex: number;

  averageScore: number;

  /** Resultado financeiro líquido atribuído a este estabelecimento. */
  impact: number;
  impactCount: number;

  topCategory?: string;
  lastCase?: string;
}

/** Casos vinculados a um estabelecimento. */
export function casesOf(
  cases: Case[],
  establishmentId: string
) {
  return cases
    .filter(
      (item) => item.establishmentId === establishmentId
    )
    .sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt)
    );
}

/** Registros de impacto vinculados a um estabelecimento. */
export function impactsOf(
  records: ImpactRecord[],
  establishmentId: string
) {
  return records.filter(
    (item) => item.establishmentId === establishmentId
  );
}

export function buildStats(
  cases: Case[],
  records: ImpactRecord[]
): EstablishmentStats {

  const scored = cases.filter(
    (item) => typeof item.score === "number"
  );

  const averageScore =
    scored.length === 0
      ? 0
      : scored.reduce(
          (sum, item) => sum + (item.score ?? 0),
          0
        ) / scored.length;

  const categories = new Map<string, number>();

  for (const item of cases) {
    categories.set(
      item.category,
      (categories.get(item.category) ?? 0) + 1
    );
  }

  const reputation = getReputation(
    cases.filter(isReclameAqui)
  );

  const sorted = [...cases].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );

  return {
    total: cases.length,
    open: cases.filter(isOpen).length,
    resolved: cases.filter((item) => item.resolved).length,
    churnRisk: cases.filter((item) => item.churnRisk)
      .length,

    reclameAqui: cases.filter(isReclameAqui).length,
    social: cases.filter(isSocial).length,

    raScore: reputation.raScore,
    responseIndex: reputation.responseIndex,

    averageScore: Math.round(averageScore * 10) / 10,

    impact: records.reduce(
      (sum, item) => sum + item.amount,
      0
    ),
    impactCount: records.length,

    topCategory: [...categories.entries()].sort(
      (a, b) => b[1] - a[1]
    )[0]?.[0],

    lastCase: sorted[0]?.createdAt,
  };
}

/** Resumo por estabelecimento, já pronto para a listagem. */
export function summarize(
  establishments: Establishment[],
  cases: Case[],
  records: ImpactRecord[]
) {
  return establishments.map((item) => ({
    establishment: item,
    stats: buildStats(
      casesOf(cases, item.id),
      impactsOf(records, item.id)
    ),
  }));
}
