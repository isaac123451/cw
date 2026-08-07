import { Case } from "@/lib/models/case";

/**
 * Data de referência da operação. Fixa de propósito: usar `new Date()` em
 * render faria o servidor e o cliente calcularem períodos diferentes,
 * quebrando a hidratação.
 */
export const REFERENCE_DATE = "2026-08-05";

export type PeriodKey = "30d" | "6m" | "12m";

export const periodLabels: Record<PeriodKey, string> = {
  "30d": "30 dias",
  "6m": "6 meses",
  "12m": "12 meses",
};

/**
 * `vigente` = janela que o Reclame Aqui considera hoje (meses fechados).
 * `proximo` = a mesma janela deslocada um mês à frente, que passa a valer
 * quando o mês corrente fechar.
 */
export type PeriodMode = "vigente" | "proximo";

export const periodModeLabels: Record<PeriodMode, string> = {
  vigente: "Período vigente",
  proximo: "Próximo período",
};

const periodMonths: Record<PeriodKey, number> = {
  "30d": 1,
  "6m": 6,
  "12m": 12,
};

function shift(date: string, days: number) {
  const base = new Date(`${date}T00:00:00`);
  base.setDate(base.getDate() + days);
  return base.toISOString().slice(0, 10);
}

/** Primeiro dia do mês, deslocado por `offset` meses. */
function monthStart(date: string, offset: number) {
  const [year, month] = date.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1 + offset, 1));
  return d.toISOString().slice(0, 10);
}

/** Último dia do mês, deslocado por `offset` meses. */
function monthEnd(date: string, offset: number) {
  const [year, month] = date.split("-").map(Number);
  const d = new Date(Date.UTC(year, month + offset, 0));
  return d.toISOString().slice(0, 10);
}

export interface PeriodRange {
  start: string;
  end: string;
  previousStart: string;
  previousEnd: string;
  /** True quando a janela ainda não fechou (mês corrente incluído). */
  partial: boolean;
}

/**
 * O Reclame Aqui apura sobre meses completos. Em 05/08/2026 a janela de
 * 6 meses vigente é 01/02/2026 → 31/07/2026 (julho é o último mês
 * fechado); a próxima será 01/03/2026 → 31/08/2026.
 */
export function getRange(
  period: PeriodKey,
  mode: PeriodMode = "vigente"
): PeriodRange {

  const months = periodMonths[period];

  // Janela vigente termina no último mês fechado; a próxima, no atual.
  const endOffset = mode === "vigente" ? -1 : 0;

  const end = monthEnd(REFERENCE_DATE, endOffset);

  const start = monthStart(
    REFERENCE_DATE,
    endOffset - months + 1
  );

  return {
    start,
    end,
    previousEnd: shift(start, -1),
    previousStart: monthStart(
      REFERENCE_DATE,
      endOffset - months * 2 + 1
    ),
    partial: mode === "proximo",
  };
}

/** Formata a janela como 01/02/2026 – 31/07/2026. */
export function formatRange(start: string, end: string) {
  const br = (iso: string) =>
    iso.split("-").reverse().join("/");

  return `${br(start)} – ${br(end)}`;
}

export function inRange(
  item: Case,
  start: string,
  end: string
) {
  return (
    item.createdAt >= start && item.createdAt <= end
  );
}

export interface ScoreBand {
  label: string;
  range: string;
  color: string;
  min: number;
}

/**
 * Faixas oficiais por nota. O RA1000 **não** é faixa: é um selo que
 * exige as quatro metas simultaneamente — por isso uma nota 8,4 pode
 * ficar só em "Ótimo" enquanto 8,5 alcança o selo.
 */
export const scoreBands: ScoreBand[] = [
  {
    label: "Não recomendada",
    range: "< 5",
    color: "#EF4444",
    min: 0,
  },
  {
    label: "Ruim",
    range: "5 – 5,9",
    color: "#F97316",
    min: 5,
  },
  {
    label: "Regular",
    range: "6 – 6,9",
    color: "#F59E0B",
    min: 6,
  },
  {
    label: "Bom",
    range: "7 – 7,9",
    color: "#3B82F6",
    min: 7,
  },
  {
    label: "Ótimo",
    range: "8 – 10",
    color: "#22C55E",
    min: 8,
  },
];

export const RA1000_BAND: ScoreBand = {
  label: "RA1000",
  range: "Selo",
  color: "#84CC16",
  min: 8,
};

export function bandOf(score: number): ScoreBand {
  return (
    [...scoreBands]
      .reverse()
      .find((band) => score >= band.min) ??
    scoreBands[0]
  );
}

/** O selo exige nota na faixa Ótimo **e** as quatro metas atingidas. */
export function hasRA1000(
  summary: ReputationSummary
): boolean {
  return (
    summary.raScore >= 8 &&
    summary.responseIndex >= RA1000_TARGETS.resposta &&
    summary.consumerScore >= RA1000_TARGETS.consumidor &&
    summary.solutionIndex >= RA1000_TARGETS.solucao &&
    summary.wouldReturnIndex >=
      RA1000_TARGETS["novos-negocios"]
  );
}

/** Faixa exibida: troca por RA1000 quando o selo é alcançado. */
export function displayBand(
  summary: ReputationSummary
): ScoreBand {
  return hasRA1000(summary)
    ? RA1000_BAND
    : bandOf(summary.raScore);
}

export interface ReputationSummary {
  received: number;
  answered: number;
  unanswered: number;
  evaluated: number;
  resolved: number;
  wouldReturn: number;

  responseIndex: number;
  solutionIndex: number;
  consumerScore: number;
  wouldReturnIndex: number;
  evaluationRate: number;

  /** Tempo médio até a primeira resposta, em minutos. */
  responseMinutes: number;

  raScore: number;

  /** Memória de cálculo da nota, para auditoria na tela. */
  breakdown: ScoreComponent[];

  /** Nenhum indicador tinha base suficiente para calcular a nota. */
  scoreUnavailable: boolean;
}

export interface ScoreComponent {
  key:
    | "resposta"
    | "consumidor"
    | "solucao"
    | "novos-negocios";

  label: string;

  /** Valor do indicador na escala original (% ou nota 0–10). */
  value: number;

  unit: "%" | "nota";

  /** Meta pública do selo RA1000. */
  target: number;

  /** Peso nominal antes da renormalização. */
  weight: number;

  /** Peso efetivo aplicado (0 quando o indicador não tem base). */
  effectiveWeight: number;

  /** Quantos casos sustentam o indicador. */
  base: number;

  /** Contribuição em pontos na nota final. */
  contribution: number;
}

/**
 * Fórmula oficial do Reclame Aqui:
 *
 *   AR = ((IR × 2) + (MA × 10 × 3) + (IS × 3) + (IN × 2)) / 100
 *
 * Pesos 2/3/3/2 sobre 10. A média das avaliações (0–10) é multiplicada
 * por 10 para entrar na mesma escala dos índices percentuais.
 *
 * Conferido contra o painel do Hugme em duas janelas:
 *   6 meses  → 8,52897 → 8,5
 *   12 meses → 8,42553 → 8,4
 */
export const SCORE_WEIGHTS = {
  resposta: 0.2,
  consumidor: 0.3,
  solucao: 0.3,
  "novos-negocios": 0.2,
} as const;

export const RA1000_TARGETS = {
  resposta: 90,
  consumidor: 7,
  solucao: 90,
  "novos-negocios": 70,
} as const;

function pct(part: number, total: number) {
  return total === 0
    ? 0
    : Math.round((part / total) * 1000) / 10;
}

/**
 * Formata número no padrão pt-BR. Inteiros saem sem casas decimais
 * ("50"), quebrados usam vírgula ("64,3").
 */
export function ptBR(value: number, decimals = 1) {
  const fixed = Number.isInteger(value)
    ? String(value)
    : value.toFixed(decimals);

  return fixed.replace(".", ",");
}

/**
 * Contagens cruas que sustentam a nota. Separadas do cálculo para que a
 * calculadora possa somar cenários hipotéticos sem tocar na base real.
 */
export interface ReputationRaw {
  received: number;
  answered: number;
  /** Soma dos tempos de resposta em minutos, para a média. */
  responseMinutesSum: number;
  responseSamples: number;
  evaluated: number;
  /** Soma das notas recebidas, usada para recalcular a média. */
  scoreSum: number;
  resolved: number;
  wouldReturn: number;
}

/** "45min", "6h", "12 dias" → minutos. */
export function parseElapsed(
  value?: string
): number | null {

  if (!value || value === "-") return null;

  const minutes = value.match(/^(\d+)\s*min$/);
  if (minutes) return Number(minutes[1]);

  const hours = value.match(/^(\d+)\s*h$/);
  if (hours) return Number(hours[1]) * 60;

  const days = value.match(/^(\d+)\s*dias?$/);
  if (days) return Number(days[1]) * 1440;

  return null;
}

/** Minutos → "19 dias e 17 horas", como o painel do Reclame Aqui. */
export function formatElapsed(minutes: number) {

  if (minutes <= 0) return "—";

  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);

  if (days === 0) {
    return hours === 0
      ? `${Math.round(minutes)} minutos`
      : `${hours} ${hours === 1 ? "hora" : "horas"}`;
  }

  const parteDias = `${days} ${
    days === 1 ? "dia" : "dias"
  }`;

  return hours === 0
    ? parteDias
    : `${parteDias} e ${hours} ${
        hours === 1 ? "hora" : "horas"
      }`;
}

export function getRawCounts(
  cases: Case[]
): ReputationRaw {

  const evaluatedCases = cases.filter(
    (item) => item.evaluated
  );

  const tempos = cases
    .map((item) => parseElapsed(item.responseTime))
    .filter((value): value is number => value !== null);

  return {
    received: cases.length,

    responseMinutesSum: tempos.reduce(
      (sum, value) => sum + value,
      0
    ),

    responseSamples: tempos.length,

    answered: cases.filter(
      (item) => (item.publicResponse ?? "").trim() !== ""
    ).length,

    evaluated: evaluatedCases.length,

    scoreSum: evaluatedCases.reduce(
      (sum, item) => sum + (item.score ?? 0),
      0
    ),

    resolved: evaluatedCases.filter(
      (item) => item.resolved
    ).length,

    wouldReturn: evaluatedCases.filter(
      (item) => item.wouldDoBusiness
    ).length,
  };
}

export function getReputation(
  cases: Case[]
): ReputationSummary {
  return scoreFrom(getRawCounts(cases));
}

/** Calcula a nota e a memória de cálculo a partir das contagens. */
export function scoreFrom(
  raw: ReputationRaw
): ReputationSummary {

  const {
    received,
    answered,
    evaluated,
    scoreSum,
    resolved,
    wouldReturn,
  } = raw;

  const consumerScore =
    evaluated === 0
      ? 0
      : Math.round((scoreSum / evaluated) * 100) / 100;

  const responseIndex = pct(answered, received);
  const solutionIndex = pct(resolved, evaluated);
  const wouldReturnIndex = pct(wouldReturn, evaluated);

  /**
   * Cada indicador declara a base que o sustenta. Indicador sem base
   * (ex.: nenhuma avaliação ainda) é excluído do cálculo em vez de
   * entrar como zero — senão a nota afundaria por falta de dado, e não
   * por desempenho ruim.
   */
  const parts: Omit<
    ScoreComponent,
    "effectiveWeight" | "contribution"
  >[] = [
    {
      key: "resposta",
      label: "Índice de resposta",
      value: responseIndex,
      unit: "%",
      target: RA1000_TARGETS.resposta,
      weight: SCORE_WEIGHTS.resposta,
      base: received,
    },
    {
      key: "consumidor",
      label: "Nota do consumidor",
      value: consumerScore,
      unit: "nota",
      target: RA1000_TARGETS.consumidor,
      weight: SCORE_WEIGHTS.consumidor,
      base: evaluated,
    },
    {
      key: "solucao",
      label: "Índice de solução",
      value: solutionIndex,
      unit: "%",
      target: RA1000_TARGETS.solucao,
      weight: SCORE_WEIGHTS.solucao,
      base: evaluated,
    },
    {
      key: "novos-negocios",
      label: "Voltariam a fazer negócio",
      value: wouldReturnIndex,
      unit: "%",
      target: RA1000_TARGETS["novos-negocios"],
      weight: SCORE_WEIGHTS["novos-negocios"],
      base: evaluated,
    },
  ];

  const withBase = parts.filter((item) => item.base > 0);

  const totalWeight = withBase.reduce(
    (sum, item) => sum + item.weight,
    0
  );

  /** Soma sem arredondamento intermediário — só o total é truncado. */
  let exactTotal = 0;

  const breakdown: ScoreComponent[] = parts.map((item) => {

    const effectiveWeight =
      item.base === 0 || totalWeight === 0
        ? 0
        : item.weight / totalWeight;

    // Tudo normalizado para a escala 0–10 antes de ponderar.
    const normalized =
      item.unit === "%" ? item.value / 10 : item.value;

    const exact = normalized * effectiveWeight;

    exactTotal += exact;

    return {
      ...item,
      effectiveWeight,
      contribution: Math.round(exact * 100) / 100,
    };
  });

  const raScore = Math.round(exactTotal * 10) / 10;

  return {
    received,
    answered,
    unanswered: received - answered,
    evaluated,
    resolved,
    wouldReturn,

    responseIndex,
    solutionIndex,
    consumerScore,
    wouldReturnIndex,
    evaluationRate: pct(evaluated, received),

    responseMinutes:
      raw.responseSamples === 0
        ? 0
        : Math.round(
            raw.responseMinutesSum / raw.responseSamples
          ),

    raScore,
    breakdown,
    scoreUnavailable: withBase.length === 0,
  };
}

/* ============================================================
   CALCULADORA DE REPUTAÇÃO
============================================================ */

export interface SimulationInput {
  /** Novas reclamações que serão respondidas. */
  addAnswered: number;

  /** Novas reclamações que ficarão sem resposta. */
  addUnanswered: number;

  /** Quantidade de novas avaliações por nota (0 a 10). */
  ratings: Record<number, number>;

  wouldReturn: number;
  wouldNotReturn: number;

  resolved: number;
  notResolved: number;

  /** Reclamações removidas da base (moderadas/excluídas). */
  removeComplaints: number;
}

export const emptySimulation: SimulationInput = {
  addAnswered: 0,
  addUnanswered: 0,
  ratings: {},
  wouldReturn: 0,
  wouldNotReturn: 0,
  resolved: 0,
  notResolved: 0,
  removeComplaints: 0,
};

export function totalRatings(
  ratings: Record<number, number>
) {
  return Object.values(ratings).reduce(
    (sum, value) => sum + (value || 0),
    0
  );
}

/**
 * Aplica um cenário hipotético sobre as contagens reais.
 * Diferente da calculadora do Hugme, funciona sobre qualquer janela —
 * inclusive a do próximo período, ainda não fechada.
 */
export function simulate(
  base: ReputationRaw,
  input: SimulationInput
): ReputationRaw {

  const novasAvaliacoes = totalRatings(input.ratings);

  const somaNotas = Object.entries(input.ratings).reduce(
    (sum, [nota, qtd]) =>
      sum + Number(nota) * (qtd || 0),
    0
  );

  // Remoção não pode levar a base abaixo de zero.
  const removidas = Math.min(
    input.removeComplaints,
    base.received
  );

  return {
    received:
      base.received +
      input.addAnswered +
      input.addUnanswered -
      removidas,

    // O cenário não altera o tempo de resposta já apurado.
    responseMinutesSum: base.responseMinutesSum,
    responseSamples: base.responseSamples,

    answered: base.answered + input.addAnswered,

    evaluated: base.evaluated + novasAvaliacoes,

    scoreSum: base.scoreSum + somaNotas,

    resolved: base.resolved + input.resolved,

    wouldReturn: base.wouldReturn + input.wouldReturn,
  };
}

export interface SimulationTarget {
  band: ScoreBand;
  /** Avaliações nota 10, resolvidas e favoráveis, para bater a meta. */
  needed: number;
  reachable: boolean;
  projected: number;
}

/**
 * Quantas avaliações positivas faltam para alcançar a faixa desejada.
 * Busca incremental — o peso de cada avaliação muda conforme a base
 * cresce, então não há fórmula fechada.
 */
export function evaluationsToReach(
  base: ReputationRaw,
  target: ScoreBand,
  /** RA1000 exige também as quatro metas, não só a nota. */
  requireSeal = false,
  limit = 2000
): SimulationTarget {

  const reached = (raw: ReputationRaw) => {
    const summary = scoreFrom(raw);

    return requireSeal
      ? hasRA1000(summary)
      : summary.raScore >= target.min;
  };

  if (reached(base)) {
    return {
      band: target,
      needed: 0,
      reachable: true,
      projected: scoreFrom(base).raScore,
    };
  }

  let raw = base;

  for (let n = 1; n <= limit; n++) {

    // Avaliação ideal: nota 10, resolvida e favorável.
    raw = {
      ...raw,
      evaluated: raw.evaluated + 1,
      scoreSum: raw.scoreSum + 10,
      resolved: raw.resolved + 1,
      wouldReturn: raw.wouldReturn + 1,
    };

    if (reached(raw)) {
      return {
        band: target,
        needed: n,
        reachable: true,
        projected: scoreFrom(raw).raScore,
      };
    }
  }

  return {
    band: target,
    needed: limit,
    reachable: false,
    projected: scoreFrom(raw).raScore,
  };
}

export interface RankingRow {
  label: string;
  value: number;
  percent: number;
  /** Variação percentual contra o período anterior. `null` = sem base. */
  variation: number | null;
}

export function getRanking(
  current: Case[],
  previous: Case[],
  field: "category" | "subcategory"
): RankingRow[] {

  const count = (list: Case[]) => {
    const map = new Map<string, number>();

    for (const item of list) {
      const key =
        (item[field] ?? "").trim() ||
        "Não informado";

      map.set(key, (map.get(key) ?? 0) + 1);
    }

    return map;
  };

  const now = count(current);
  const before = count(previous);

  const total = current.length;

  return [...now.entries()]
    .map(([label, value]) => {

      const past = before.get(label) ?? 0;

      return {
        label,
        value,
        percent: pct(value, total),
        variation:
          past === 0
            ? null
            : Math.round(
                ((value - past) / past) * 100
              ),
      };
    })
    .sort((a, b) => b.value - a.value);
}

export interface RatingBucket {
  label: string;
  value: number;
  percent: number;
  color: string;
}

export function getRatingDistribution(
  cases: Case[]
): RatingBucket[] {

  const evaluated = cases.filter(
    (item) => item.evaluated
  );

  const buckets = [
    { label: "0-2", min: 0, max: 2, color: "#EF4444" },
    { label: "3-4", min: 3, max: 4, color: "#F97316" },
    { label: "5-6", min: 5, max: 6, color: "#F59E0B" },
    { label: "7-8", min: 7, max: 8, color: "#22C55E" },
    { label: "9-10", min: 9, max: 10, color: "#16A34A" },
  ];

  return buckets.map((bucket) => {

    const value = evaluated.filter((item) => {
      const score = item.score ?? 0;
      return (
        score >= bucket.min && score <= bucket.max
      );
    }).length;

    return {
      label: bucket.label,
      value,
      percent: pct(value, evaluated.length),
      color: bucket.color,
    };
  });
}

export interface MonthlyReputation {
  label: string;
  received: number;
  score: number;
}

export function getReputationTrend(
  cases: Case[]
): MonthlyReputation[] {

  const months = new Map<string, Case[]>();

  for (const item of cases) {
    const key = item.createdAt.slice(0, 7);
    months.set(key, [
      ...(months.get(key) ?? []),
      item,
    ]);
  }

  const names = [
    "jan",
    "fev",
    "mar",
    "abr",
    "mai",
    "jun",
    "jul",
    "ago",
    "set",
    "out",
    "nov",
    "dez",
  ];

  return [...months.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, items]) => ({
      label: `${
        names[Number(month.slice(5, 7)) - 1]
      }/${month.slice(2, 4)}`,
      received: items.length,
      score: getReputation(items).raScore,
    }));
}

export interface BacklogAlert {
  count: number;
  label: string;
  hint: string;
  tone: "danger" | "warning" | "info";
}

export function getBacklog(
  cases: Case[]
): BacklogAlert[] {

  const unanswered = cases.filter(
    (item) => (item.publicResponse ?? "").trim() === ""
  ).length;

  const stale = cases.filter((item) => {
    if ((item.publicResponse ?? "").trim() !== "")
      return false;

    return item.createdAt < shift(REFERENCE_DATE, -7);
  }).length;

  const awaitingRating = cases.filter(
    (item) =>
      (item.publicResponse ?? "").trim() !== "" &&
      !item.evaluated
  ).length;

  return [
    {
      count: unanswered,
      label: "sem resposta",
      hint: "Ação imediata",
      tone: "danger",
    },
    {
      count: stale,
      label: "com mais de 7 dias",
      hint: "Risco de SLA",
      tone: "warning",
    },
    {
      count: awaitingRating,
      label: "aguardando avaliação",
      hint: "Impacto na nota",
      tone: "info",
    },
  ];
}
