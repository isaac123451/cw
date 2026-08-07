import { Case } from "@/lib/models/case";

import {
  bandOf,
  getRawCounts,
  REFERENCE_DATE,
  scoreFrom,
} from "@/lib/services/reputation.service";

/** Períodos da seção de gráficos — inclui 3 meses, que o resto não usa. */
export type ChartPeriod = "30d" | "3m" | "6m" | "12m";

export const chartPeriodLabels: Record<
  ChartPeriod,
  string
> = {
  "30d": "30 dias",
  "3m": "3 meses",
  "6m": "6 meses",
  "12m": "12 meses",
};

const chartPeriodMonths: Record<ChartPeriod, number> = {
  "30d": 1,
  "3m": 3,
  "6m": 6,
  "12m": 12,
};

function addDays(date: string, days: number) {
  const base = new Date(`${date}T00:00:00Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

function monthKey(date: string) {
  return date.slice(0, 7);
}

const MONTHS = [
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

function monthLabel(key: string) {
  const [year, month] = key.split("-").map(Number);
  return `${MONTHS[month - 1]}/${String(year).slice(2)}`;
}

/** Lista de meses fechados que compõem o período. */
export function monthsIn(
  period: ChartPeriod
): string[] {

  const count = chartPeriodMonths[period];

  const [year, month] = REFERENCE_DATE.split("-").map(
    Number
  );

  const keys: string[] = [];

  // Termina no último mês fechado.
  for (let i = count; i >= 1; i--) {
    const d = new Date(Date.UTC(year, month - 1 - i, 1));
    keys.push(d.toISOString().slice(0, 7));
  }

  return keys;
}

export interface MonthlyIndices {
  key: string;
  label: string;

  received: number;
  answered: number;
  evaluated: number;
  resolved: number;
  notResolved: number;
  wouldReturn: number;
  wouldNotReturn: number;

  responseIndex: number;
  solutionIndex: number;
  wouldReturnIndex: number;
  consumerScore: number;

  raScore: number;
  band: string;
  bandColor: string;

  /** Tempo médio de resposta em dias. */
  responseDays: number;

  /** Janela coberta pelo ponto, no formato DD/MM/AAAA – DD/MM/AAAA. */
  window?: string;
}

function parseMinutes(value?: string): number | null {

  if (!value || value === "-") return null;

  const min = value.match(/^(\d+)\s*min$/);
  if (min) return Number(min[1]);

  const hours = value.match(/^(\d+)\s*h$/);
  if (hours) return Number(hours[1]) * 60;

  const days = value.match(/^(\d+)\s*dias?$/);
  if (days) return Number(days[1]) * 1440;

  return null;
}

function indicesOf(
  key: string,
  items: Case[]
): MonthlyIndices {

  const raw = getRawCounts(items);
  const summary = scoreFrom(raw);
  const band = bandOf(summary.raScore);

  const tempos = items
    .map((item) => parseMinutes(item.responseTime))
    .filter((value): value is number => value !== null);

  return {
    key,
    label: monthLabel(key),

    received: raw.received,
    answered: raw.answered,
    evaluated: raw.evaluated,
    resolved: raw.resolved,
    notResolved: raw.evaluated - raw.resolved,
    wouldReturn: raw.wouldReturn,
    wouldNotReturn: raw.evaluated - raw.wouldReturn,

    responseIndex: summary.responseIndex,
    solutionIndex: summary.solutionIndex,
    wouldReturnIndex: summary.wouldReturnIndex,
    consumerScore: summary.consumerScore,

    raScore: summary.raScore,
    band: band.label,
    bandColor: band.color,

    responseDays:
      tempos.length === 0
        ? 0
        : Math.round(
            (tempos.reduce((s, v) => s + v, 0) /
              tempos.length /
              1440) *
              10
          ) / 10,
  };
}

function windowLabel(startKey: string, endKey: string) {

  const [sy, sm] = startKey.split("-").map(Number);
  const [ey, em] = endKey.split("-").map(Number);

  const first = new Date(Date.UTC(sy, sm - 1, 1));
  const last = new Date(Date.UTC(ey, em, 0));

  const fmt = (d: Date) =>
    d
      .toISOString()
      .slice(0, 10)
      .split("-")
      .reverse()
      .join("/");

  return `${fmt(first)} – ${fmt(last)}`;
}

/** Indicadores calculados para cada mês isoladamente. */
export function getMonthlyIndices(
  cases: Case[],
  period: ChartPeriod
): MonthlyIndices[] {

  return monthsIn(period).map((key) =>
    indicesOf(
      key,
      cases.filter(
        (item) => monthKey(item.createdAt) === key
      )
    )
  );
}

/**
 * Janela móvel: cada ponto usa os 12 meses anteriores àquele mês —
 * é assim que o Reclame Aqui apura a reputação vigente.
 */
export function getRollingIndices(
  cases: Case[],
  period: ChartPeriod,
  window = 12
): MonthlyIndices[] {

  return monthsIn(period).map((key) => {

    const [year, month] = key.split("-").map(Number);

    const start = new Date(
      Date.UTC(year, month - window, 1)
    )
      .toISOString()
      .slice(0, 7);

    const items = cases.filter((item) => {
      const m = monthKey(item.createdAt);
      return m > start && m <= key;
    });

    // A janela começa no mês seguinte ao corte exclusivo.
    const first = new Date(
      Date.UTC(year, month - window, 1)
    )
      .toISOString()
      .slice(0, 7);

    return {
      ...indicesOf(key, items),
      window: windowLabel(first, key),
    };
  });
}

export interface DailyPoint {
  date: string;
  label: string;
  received: number;
  answered: number;
  evaluated: number;
  resolved: number;
}

/** Série diária dos últimos 30 dias, contada a partir da data de referência. */
export function getDailySeries(
  cases: Case[],
  days = 30
): DailyPoint[] {

  const points: DailyPoint[] = [];

  for (let i = days - 1; i >= 0; i--) {

    const date = addDays(REFERENCE_DATE, -i);

    const items = cases.filter(
      (item) => item.createdAt === date
    );

    const [, month, day] = date.split("-");

    points.push({
      date,
      label: `${day}/${MONTHS[Number(month) - 1]}`,
      received: items.length,
      answered: items.filter(
        (item) =>
          (item.publicResponse ?? "").trim() !== ""
      ).length,
      evaluated: items.filter((item) => item.evaluated)
        .length,
      resolved: items.filter((item) => item.resolved)
        .length,
    });
  }

  return points;
}
