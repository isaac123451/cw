import { Case } from "@/lib/models/case";

import {
  bandOf,
  getRange,
  getRawCounts,
  inRange,
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
 * Meses tocados pelo período.
 *
 * Derivado do mesmo `getRange` que calcula a nota, de propósito: havia
 * duas contas de período em paralelo aqui e em `reputation.service`, e
 * elas divergiam — "30 dias" desenhava o mês fechado anterior enquanto a
 * nota passou a considerar os 30 dias corridos. Uma fonte só evita a
 * volta desse tipo de divergência em qualquer filtro.
 */
export function monthsIn(
  period: ChartPeriod,
  custom?: { start: string; end: string }
): string[] {

  const range = getRange(period, "vigente", custom);

  const keys: string[] = [];

  const [sy, sm] = range.start.split("-").map(Number);
  const endKey = range.end.slice(0, 7);

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

  const range = getRange(period, "vigente", custom);

  /**
   * Recorta pelo intervalo, não só pelo mês.
   *
   * Em janela que começa ou termina no meio do mês — "30 dias" e o
   * intervalo personalizado —, contar o mês inteiro somaria dias fora do
   * período e o gráfico deixaria de bater com a nota da tela.
   */
  return monthsIn(period, custom).map((key) =>
    indicesOf(
      key,
      cases.filter(
        (item) =>
          monthKey(item.createdAt) === key &&
          inRange(item, range.start, range.end)
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

export type Granularity = "dia" | "semana" | "mes";

/** Masculino: acompanham "Movimento" no título do cartão. */
export const granularityLabels: Record<
  Granularity,
  string
> = {
  dia: "diário",
  semana: "semanal",
  mes: "mensal",
};

/**
 * O passo do eixo muda com o tamanho da janela.
 *
 * Desenhar 365 pontos diários num gráfico dessa largura não é leitura, é
 * ruído: as linhas viram serrilha e o eixo fica ilegível. Agrupar mantém
 * a forma da curva com um número de pontos que cabe na tela.
 */
function granularityFor(days: number): Granularity {
  if (days <= 60) return "dia";
  if (days <= 210) return "semana";
  return "mes";
}

function daysBetween(start: string, end: string) {
  return (
    Math.round(
      (Date.parse(`${end}T00:00:00Z`) -
        Date.parse(`${start}T00:00:00Z`)) /
        86400000
    ) + 1
  );
}

export interface TimeSeries {
  granularity: Granularity;
  points: DailyPoint[];
}

/**
 * Série temporal da janela escolhida, agrupada por dia, semana ou mês
 * conforme o tamanho dela.
 *
 * Diferente dos gráficos mensais, inclui o mês corrente ainda aberto —
 * é a leitura que mostra o que está acontecendo agora.
 */
export function getTimeSeries(
  cases: Case[],
  range: { start: string; end: string }
): TimeSeries {

  const start = range.start || REFERENCE_DATE;
  const end = range.end || REFERENCE_DATE;

  const total = Math.max(daysBetween(start, end), 1);

  const granularity = granularityFor(total);

  const passo =
    granularity === "dia"
      ? 1
      : granularity === "semana"
      ? 7
      : 0;

  /** Início de cada balde, do mais antigo ao mais recente. */
  const inicios: string[] = [];

  if (granularity === "mes") {

    const [ey, em] = end.split("-").map(Number);
    const [sy, sm] = start.split("-").map(Number);

    let cursor = new Date(Date.UTC(sy, sm - 1, 1));
    const limite = new Date(Date.UTC(ey, em - 1, 1));

    while (cursor <= limite && inicios.length < 120) {
      inicios.push(
        cursor.toISOString().slice(0, 10)
      );
      cursor = new Date(
        Date.UTC(
          cursor.getUTCFullYear(),
          cursor.getUTCMonth() + 1,
          1
        )
      );
    }

  } else {

    // Ancorado no fim: o último balde termina hoje, sem sobra parcial.
    for (let i = total - 1; i >= 0; i -= passo) {
      inicios.push(addDays(end, -i));
    }
  }

  const points = inicios.map((inicio, index) => {

    const proximo = inicios[index + 1];

    const fim = proximo
      ? addDays(proximo, -1)
      : end;

    const items = cases.filter(
      (item) =>
        item.createdAt >= inicio &&
        item.createdAt <= fim &&
        item.createdAt >= start
    );

    const [ano, mes, dia] = inicio.split("-");

    const label =
      granularity === "mes"
        ? `${MONTHS[Number(mes) - 1]}/${ano.slice(2)}`
        : `${dia}/${MONTHS[Number(mes) - 1]}`;

    return {
      date: inicio,
      label,
      received: items.length,
      answered: items.filter(
        (item) =>
          (item.publicResponse ?? "").trim() !== ""
      ).length,
      evaluated: items.filter((item) => item.evaluated)
        .length,
      resolved: items.filter((item) => item.resolved)
        .length,
    };
  });

  return { granularity, points };
}
