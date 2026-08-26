import { Case } from "@/lib/models/case";
import { parseElapsedText } from "@/lib/services/case.mapper";

import {
  bandOf,
  getRange,
  getRawCounts,
  inRange,
  PeriodKey,
  hojeNaOperacao,
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

  const start = range.start || hojeNaOperacao();
  const end = range.end || hojeNaOperacao();

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

/* ============================================================
   DISTRIBUIÇÃO DO TEMPO DE RESPOSTA
============================================================ */

export interface FaixaDeResposta {
  label: string;
  hint: string;
  /** Limite superior em minutos; `Infinity` na última faixa. */
  ate: number;
  quantidade: number;
  /** Percentual do total respondido, 0 a 100. */
  parte: number;
  color: string;
}

/**
 * As faixas, do prazo prometido ao abandono.
 *
 * O corte não é arbitrário: 24 h é o que a operação promete responder,
 * 7 dias é o ponto em que o painel marca a reclamação como vencida, e
 * 15 dias é quando o consumidor já desistiu de esperar e a avaliação
 * vem baixa independentemente do que se escreva.
 */
const FAIXAS: Omit<
  FaixaDeResposta,
  "quantidade" | "parte"
>[] = [
  {
    label: "até 24 h",
    hint: "Dentro do prazo prometido.",
    ate: 1440,
    color: "#22C55E",
  },
  {
    label: "1 a 3 dias",
    hint: "Fora do prazo, mas ainda dentro da paciência do consumidor.",
    ate: 4320,
    color: "#84CC16",
  },
  {
    label: "3 a 7 dias",
    hint: "O consumidor já cobrou pelo menos uma vez.",
    ate: 10080,
    color: "#F59E0B",
  },
  {
    label: "7 a 15 dias",
    hint: "Marcada como vencida no painel do Reclame Aqui.",
    ate: 21600,
    color: "#F97316",
  },
  {
    label: "mais de 15 dias",
    hint: "A avaliação vem baixa mesmo com a resposta certa.",
    ate: Infinity,
    color: "#EF4444",
  },
];

export interface DistribuicaoDeResposta {
  faixas: FaixaDeResposta[];
  /** Quantas reclamações têm tempo medido — a base do percentual. */
  medidas: number;
  /** Respondidas sem tempo registrado; não entram nas faixas. */
  semMedida: number;
  /** O pior tempo da janela, em minutos. */
  pior: number | null;
  /** A mediana, em minutos. */
  mediana: number | null;
}

/**
 * Como os tempos de resposta se distribuem — e não a média deles.
 *
 * A média é o número que a tela mostrava, e ela esconde exatamente o
 * que importa: 100 respostas em 2 h e 5 em 40 dias dão uma média
 * confortável de menos de dois dias, enquanto a experiência real foi
 * cinco consumidores abandonados por mais de um mês. Foi a correção do
 * Isaac sobre o teto — "não é média, mas sim sobre o máximo".
 *
 * A distribuição mostra a cauda. A mediana vem junto porque ela é o
 * "caso típico" honesto: metade foi respondida em menos que isso.
 */
export function getDistribuicaoDeResposta(
  cases: Case[],
  range: { start: string; end: string }
): DistribuicaoDeResposta {

  const naJanela = cases.filter((item) =>
    inRange(item, range.start, range.end)
  );

  const respondidas = naJanela.filter(
    (item) => (item.publicResponse ?? "").trim() !== ""
  );

  const minutos = respondidas
    .map((item) => parseElapsedText(item.responseTime))
    .filter((valor): valor is number => valor !== null)
    .sort((a, b) => a - b);

  const contagem = FAIXAS.map((faixa, i) => {

    const piso = i === 0 ? 0 : FAIXAS[i - 1].ate;

    const quantidade = minutos.filter(
      (valor) => valor > piso && valor <= faixa.ate
    ).length;

    return {
      ...faixa,
      quantidade,
      parte:
        minutos.length === 0
          ? 0
          : (quantidade / minutos.length) * 100,
    };
  });

  return {
    faixas: contagem,
    medidas: minutos.length,
    semMedida: respondidas.length - minutos.length,
    pior:
      minutos.length > 0
        ? minutos[minutos.length - 1]
        : null,
    mediana:
      minutos.length > 0
        ? minutos[Math.floor(minutos.length / 2)]
        : null,
  };
}

/* ============================================================
   CAUSAS AO LONGO DO TEMPO
============================================================ */

export interface SerieDeCausa {
  categoria: string;
  total: number;
  valores: number[];
}

export interface CausasNoTempo {
  labels: string[];
  series: SerieDeCausa[];
  /** Quantas categorias ficaram fora do recorte. */
  outras: number;
}

/**
 * As principais causas, mês a mês.
 *
 * O ranking de causas já existia, e ele responde "qual é o maior
 * problema" — que é a pergunta errada quando a lista muda pouco. A que
 * a operação faz de verdade é "qual está crescendo": uma categoria que
 * dobrou em dois meses merece ação, mesmo em terceiro lugar absoluto.
 *
 * **Só as cinco maiores.** Vinte linhas num gráfico não são vinte
 * leituras, são nenhuma; as demais entram como contagem no rodapé,
 * para ninguém achar que o gráfico é a base inteira.
 */
export function getCausasNoTempo(
  cases: Case[],
  range: { start: string; end: string },
  quantas = 5
): CausasNoTempo {

  const naJanela = cases.filter((item) =>
    inRange(item, range.start, range.end)
  );

  /*
    Os meses tocados pela janela.

     pede um período nomeado, e aqui a janela já veio
    resolvida — o cartão pode estar num período próprio. Deriva-se as
    chaves do próprio intervalo, com a mesma trava de 120 meses.
  */
  const meses: { key: string; label: string }[] = [];

  {
    const [sy, sm] = range.start.split("-").map(Number);
    const fim = range.end.slice(0, 7);

    let cursor = new Date(Date.UTC(sy, sm - 1, 1));

    while (
      cursor.toISOString().slice(0, 7) <= fim &&
      meses.length < 120
    ) {
      const key = cursor.toISOString().slice(0, 7);
      meses.push({ key, label: monthLabel(key) });
      cursor = new Date(
        Date.UTC(
          cursor.getUTCFullYear(),
          cursor.getUTCMonth() + 1,
          1
        )
      );
    }
  }

  const totais = new Map<string, number>();

  for (const item of naJanela) {
    const nome = item.category || "Sem categoria";
    totais.set(nome, (totais.get(nome) ?? 0) + 1);
  }

  const principais = [...totais.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, quantas);

  return {
    labels: meses.map((m) => m.label),
    outras: Math.max(totais.size - principais.length, 0),
    series: principais.map(([categoria, total]) => ({
      categoria,
      total,
      valores: meses.map(
        (mes) =>
          naJanela.filter(
            (item) =>
              (item.category || "Sem categoria") ===
                categoria &&
              monthKey(item.createdAt) === mes.key
          ).length
      ),
    })),
  };
}
