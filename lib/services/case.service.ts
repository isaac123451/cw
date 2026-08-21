import { Case } from "@/lib/models/case";

export interface Distribution {
  label: string;
  value: number;
  percent: number;
}

export interface CaseMetrics {
  total: number;
  open: number;
  critical: number;
  resolved: number;
  churnRisk: number;
  companies: number;
  averageScore: number;
  solutionRate: number;
  wouldDoBusinessRate: number;
  openWithoutOwner: number;
}

/**
 * Estados que **não** dependem mais de ação da operação.
 *
 * A lista é de exclusão, e não de inclusão, de propósito: o fluxo é
 * configurável em "Configurar fluxo", e com lista de inclusão qualquer
 * etapa nova criada pela operação deixaria de contar como aberta — o
 * caso sumiria silenciosamente do indicador "na fila".
 *
 * "Aguardando avaliação" entra aqui porque já foi respondido: a bola
 * está com o consumidor. "Resolvido" e "Não resolvido" são os dois
 * estados terminais do ciclo real do Reclame Aqui.
 */
const CLOSED_STATUS = [
  "Aguardando avaliação",
  "Resolvido",
  "Não resolvido",
];

export const RECLAME_AQUI = "Reclame Aqui";

/**
 * Canais que alimentam o módulo Redes Sociais. Hoje só o Instagram
 * recebe demanda; outros canais entram aqui quando forem ativados.
 */
export const SOCIAL_SOURCES = [
  "Instagram",
  "Facebook",
  "WhatsApp",
  "ManyChat",
];

export type Channel = "reclame-aqui" | "social" | "all";

export function isReclameAqui(item: Case) {
  return item.source === RECLAME_AQUI;
}

export function isSocial(item: Case) {
  return SOCIAL_SOURCES.includes(item.source);
}

/** Recorta a base pelo canal de origem. Cada módulo enxerga só o que é seu. */
export function byChannel(
  cases: Case[],
  channel: Channel
) {
  if (channel === "reclame-aqui") {
    return cases.filter(isReclameAqui);
  }

  if (channel === "social") {
    return cases.filter(isSocial);
  }

  return cases;
}

export function isOpen(item: Case) {
  return !CLOSED_STATUS.includes(item.status);
}

function rate(part: number, total: number) {
  return total === 0
    ? 0
    : Math.round((part / total) * 100);
}

export function getMetrics(cases: Case[]): CaseMetrics {

  const total = cases.length;

  const resolved = cases.filter(
    (item) => item.resolved
  ).length;

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

  return {
    total,

    open: cases.filter(isOpen).length,

    critical: cases.filter(
      (item) => item.priority === "Crítica"
    ).length,

    resolved,

    churnRisk: cases.filter(
      (item) => item.churnRisk
    ).length,

    companies: new Set(
      cases.map((item) => item.company)
    ).size,

    averageScore:
      Math.round(averageScore * 10) / 10,

    solutionRate: rate(resolved, total),

    wouldDoBusinessRate: rate(
      cases.filter((item) => item.wouldDoBusiness).length,
      total
    ),

    openWithoutOwner: cases.filter(
      (item) => isOpen(item) && !item.owner
    ).length,
  };
}

/**
 * Agrupa os casos por um campo e devolve a distribuição ordenada
 * do maior para o menor, já com o percentual calculado.
 */
export function groupBy(
  cases: Case[],
  field: keyof Case
): Distribution[] {

  const counters = new Map<string, number>();

  for (const item of cases) {

    const raw = item[field];

    const label =
      typeof raw === "string" && raw.trim() !== ""
        ? raw
        : "Não informado";

    counters.set(
      label,
      (counters.get(label) ?? 0) + 1
    );

  }

  return [...counters.entries()]
    .map(([label, value]) => ({
      label,
      value,
      percent: rate(value, cases.length),
    }))
    .sort((a, b) => b.value - a.value);
}

/**
 * Evolução mensal a partir de createdAt (formato YYYY-MM-DD),
 * usada nos gráficos de tendência do Dashboard e do Analytics.
 */
export function getMonthlyTrend(cases: Case[]) {

  const months = new Map<
    string,
    { total: number; resolved: number }
  >();

  for (const item of cases) {

    const month = item.createdAt.slice(0, 7);

    const current =
      months.get(month) ??
      { total: 0, resolved: 0 };

    months.set(month, {
      total: current.total + 1,
      resolved:
        current.resolved + (item.resolved ? 1 : 0),
    });

  }

  return [...months.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => ({
      month,
      label: formatMonth(month),
      ...data,
    }));
}

function formatMonth(month: string) {

  const names = [
    "Jan",
    "Fev",
    "Mar",
    "Abr",
    "Mai",
    "Jun",
    "Jul",
    "Ago",
    "Set",
    "Out",
    "Nov",
    "Dez",
  ];

  const index = Number(month.slice(5, 7)) - 1;

  return `${names[index] ?? month} ${month.slice(2, 4)}`;
}

export function getCriticalCases(cases: Case[]) {
  return cases
    .filter(
      (item) =>
        isOpen(item) &&
        (item.priority === "Crítica" || item.churnRisk)
    )
    .sort((a, b) =>
      b.updatedAt && a.updatedAt
        ? b.updatedAt.localeCompare(a.updatedAt)
        : 0
    );
}

export function getRecentCases(
  cases: Case[],
  limit = 6
) {
  return [...cases]
    .sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt)
    )
    .slice(0, limit);
}
