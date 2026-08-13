import { Case } from "@/lib/models/case";

import {
  bandOf,
  getRawCounts,
  PeriodKey,
  REFERENCE_DATE,
  scoreFrom,
} from "@/lib/services/reputation.service";

/**
 * Os gráficos usam o mesmo PeriodKey do resto da aplicação — antes havia
 * um tipo separado aqui, e as duas listas de período divergiam.
 */
export type ChartPeriod = PeriodKey;

export { periodLabels as chartPeriodLabels } from "@/lib/services/reputation.service";

const chartPeriodMonths: Record<string, number> = {
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

/**
 * Lista de meses que compõem o período.
 *
 * Nas faixas fixas termina no último mês fechado, que é como o Reclame
 * Aqui apura. No intervalo personalizado percorre os meses tocados pelas
 * datas escolhidas.
 */
export function monthsIn(
  period: ChartPeriod,
  custom?: { start: string; end: string }
): string[] {

  const keys: string[] = [];

  if (period === "custom") {

    if (!custom) return keys;

    // O input de data devolve string vazia quando é limpo. Sem esta
    // defesa, "".split("-") viraria Date.UTC(NaN) e o toISOString abaixo
    // derrubava a tela inteira. Mesmo fallback do getRange.
    const start = custom.start || REFERENCE_DATE;
    const end = custom.end || REFERENCE_DATE;

    const [sy, sm] = start.split("-").map(Number);
    const endKey = end.slice(0, 7);

    let cursor = new Date(Date.UTC(sy, sm - 1, 1));

    // Trava de segurança: intervalos absurdos não travam a tela.
    while (
      cursor.toISOString().slice(0, 7) <= endKey &&
      keys.length < 120
    ) {
      keys.push(cursor.toISOString().slice(0, 7));
      cursor = new Date(
        Date.UTC(
          cursor.getUTCFullYear(),
          cursor.getUTCMonth() + 1,
          1
        )
      );
    }

    return keys;
  }

  const count = chartPeriodMonths[period] ?? 12;

  const [year, month] = REFERENCE_DATE.split("-").map(
    Number
  );

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
  period: ChartPeriod,
  custom?: { start: string; end: string }
): MonthlyIndices[] {

  return monthsIn(period, custom).map((key) =>
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
  window = 12,
  custom?: { start: string; end: string }
): MonthlyIndices[] {

  return monthsIn(period, custom).map((key) => {

    const [year, month] = key.split("-").map(Number);

    /**
     * Primeiro mês da janela, inclusive.
     *
     * `month` vem 1-based da chave e `Date.UTC` espera 0-based, e essa
     * diferença de um já está embutida: para "2026-07" com janela de 12,
     * `Date.UTC(2026, -5, 1)` dá agosto/2025 — exatamente o início da
     * janela oficial de 12 meses.
     */
    const first = new Date(
      Date.UTC(year, month - window, 1)
    )
      .toISOString()
      .slice(0, 7);

    /**
     * Comparação inclusiva nas duas pontas.
     *
     * Com `>` o primeiro mês ficava de fora e toda janela contava um mês
     * a menos: a de 12 meses somava 197 reclamações onde a nota oficial
     * conta 212, e o gráfico divergia do painel do Reclame Aqui.
     */
    const items = cases.filter((item) => {
      const m = monthKey(item.createdAt);
      return m >= first && m <= key;
    });

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

/**
 * Série diária da janela informada.
 *
 * Sem `range`, usa os últimos 30 dias a partir da data de referência —
 * era o comportamento fixo anterior, que ignorava o período escolhido
 * na tela.
 */
export function getDailySeries(
  cases: Case[],
  range?: { start: string; end: string }
): DailyPoint[] {

  const end = range?.end ?? REFERENCE_DATE;

  const days = range
    ? Math.min(
        Math.round(
          (Date.parse(`${range.end}T00:00:00Z`) -
            Date.parse(`${range.start}T00:00:00Z`)) /
            86400000
        ) + 1,
        // Acima disso a leitura diária vira ruído — e o eixo fica ilegível.
        180
      )
    : 30;

  const points: DailyPoint[] = [];

  for (let i = Math.max(days, 1) - 1; i >= 0; i--) {

    const date = addDays(end, -i);

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
