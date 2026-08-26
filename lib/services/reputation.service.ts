import { Case } from "@/lib/models/case";

/**
 * O fuso da operação. A base inteira é brasileira, e o dia útil de quem
 * usa esta aplicação começa e termina aqui — não em UTC.
 */
const FUSO_DA_OPERACAO = "America/Sao_Paulo";

/**
 * `en-CA` é o atalho para `AAAA-MM-DD` sem montar a string à mão.
 *
 * Criado uma vez: `Intl.DateTimeFormat` é caro de instanciar, e esta
 * função é chamada em laço sobre centenas de casos.
 */
const FORMATO_DO_DIA = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSO_DA_OPERACAO,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * O dia de hoje na operação, em `AAAA-MM-DD`.
 *
 * **Isto já foi uma constante** — `REFERENCE_DATE = "2026-08-10"` — e o
 * motivo alegado era hidratação: `new Date()` no render faria servidor e
 * navegador calcularem períodos diferentes. O motivo era real, a solução
 * não: congelar a data não corrige a divergência, só a esconde atrás de
 * um erro pior. A aplicação inteira parou no dia 10 — prazo de SLA,
 * agenda, gráficos, alertas, "hoje" na extensão. Em 25/08 o painel ainda
 * dizia que faltavam quinze dias para vencer o que já tinha vencido.
 *
 * A divergência de hidratação vinha do **fuso**, não do relógio: um
 * servidor em UTC e um navegador em UTC−3 discordam sobre que dia é,
 * entre 21h e meia-noite. Fixando o fuso nos dois lados, os dois
 * calculam a mesma data de parede e a hidratação fecha. Sobra só a
 * virada de meia-noite no meio de um render — uma janela de
 * milissegundos que se corrige no próximo.
 *
 * É função, e não constante calculada na carga do módulo, de propósito:
 * um servidor de pé há três dias serviria a data de anteontem. Quem
 * recebe `today` por parâmetro deve usar `hojeNaOperacao()` como
 * **valor padrão** — que reavalia a cada chamada — e nunca guardar o
 * resultado num módulo.
 */
export function hojeNaOperacao(): string {
  return FORMATO_DO_DIA.format(new Date());
}

export type PeriodKey =
  | "30d"
  | "3m"
  | "6m"
  | "12m"
  | "custom";

export const periodLabels: Record<PeriodKey, string> = {
  "30d": "30 dias",
  "3m": "3 meses",
  "6m": "6 meses",
  "12m": "12 meses",
  custom: "Personalizado",
};

/**
 * Só 6m e 12m são janelas oficiais do Reclame Aqui — são elas que
 * reproduzem a nota do painel. As demais servem para análise interna.
 */
export const OFFICIAL_PERIODS: PeriodKey[] = ["6m", "12m"];

export interface CustomRange {
  start: string;
  end: string;
}

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
  "3m": 3,
  "6m": 6,
  "12m": 12,
  custom: 0,
};

/** Dias corridos de "30 dias" — não é janela de mês fechado. */
const ROLLING_DAYS = 30;

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
  mode: PeriodMode = "vigente",
  custom?: CustomRange
): PeriodRange {

  // Intervalo livre: a comparação é a janela de mesma duração
  // imediatamente anterior, para o delta continuar fazendo sentido.
  if (period === "custom") {

    // `||` e não `??`: o input de data devolve string vazia quando é
    // limpo, e "" passaria pelo `??` até virar Invalid Date no shift().
    const start = custom?.start || hojeNaOperacao();
    const end = custom?.end || hojeNaOperacao();

    const dias =
      Math.round(
        (Date.parse(`${end}T00:00:00Z`) -
          Date.parse(`${start}T00:00:00Z`)) /
          86400000
      ) + 1;

    const previousEnd = shift(start, -1);

    return {
      start,
      end,
      previousStart: shift(
        previousEnd,
        -Math.max(dias - 1, 0)
      ),
      previousEnd,
      partial: end >= hojeNaOperacao(),
    };
  }

  /**
   * "30 dias" é janela de dias corridos, terminando hoje — e não o mês
   * fechado anterior.
   *
   * Tratá-la como 1 mês fechado escondia o mês corrente inteiro: em
   * 10/08/2026 a tela mostrava 01/07–31/07 (15 reclamações, nota 8,6)
   * enquanto os 30 dias reais eram 12/07–10/08 (17 reclamações, nota
   * 7,4). Meses fechados são a regra de apuração do Reclame Aqui, que
   * vale para 6m e 12m; "30 dias" é leitura operacional interna, e aí o
   * que importa é o que aconteceu agora.
   */
  if (period === "30d") {

    const end = hojeNaOperacao();
    const start = shift(end, -(ROLLING_DAYS - 1));

    const previousEnd = shift(start, -1);

    return {
      start,
      end,
      previousStart: shift(
        previousEnd,
        -(ROLLING_DAYS - 1)
      ),
      previousEnd,
      partial: true,
    };
  }

  const months = periodMonths[period];

  // Janela vigente termina no último mês fechado; a próxima, no atual.
  const endOffset = mode === "vigente" ? -1 : 0;

  const end = monthEnd(hojeNaOperacao(), endOffset);

  const start = monthStart(
    hojeNaOperacao(),
    endOffset - months + 1
  );

  return {
    start,
    end,
    previousEnd: shift(start, -1),
    previousStart: monthStart(
      hojeNaOperacao(),
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

/**
 * Avaliação que entra no cálculo da nota.
 *
 * A marcada como desconsiderada fica de fora — é o que o próprio
 * Reclame Aqui faz com as avaliações que invalida, e contá-la faria a
 * nota daqui divergir do painel. O caso segue visível na tela, com a
 * nota e o aviso: sai do cálculo, não da vista.
 */
function contaParaNota(item: Case) {
  return Boolean(item.evaluated) && !item.scoreDisregarded;
}

export function getRawCounts(
  cases: Case[]
): ReputationRaw {

  const evaluatedCases = cases.filter(contaParaNota);

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

/**
 * Uma avaliação do Reclame Aqui é sempre uma unidade com três respostas:
 * a nota (0–10), se o consumidor voltaria a fazer negócio e se considera
 * o caso resolvido. O cenário reproduz as três — derivar tudo da nota
 * amarraria indicadores que, na prática, andam separados.
 */
export interface SimulationInput {
  /**
   * Reclamações que **já estão na base** sem resposta e passam a ser
   * respondidas. Não altera o total recebido — só move de "sem resposta"
   * para "respondida". Responder todas as pendentes leva o índice de
   * resposta a 100%.
   */
  answerPending: number;

  /** Reclamações **novas** que já nascem respondidas. */
  addAnswered: number;

  /** Reclamações **novas** que ficarão sem resposta. */
  addUnanswered: number;

  /** Quantidade de novas avaliações por nota (0 a 10). */
  ratings: Record<number, number>;

  /**
   * Quantas das novas avaliações contam como resolvidas.
   * `null` acompanha as notas (≥ 7); um número fixa o valor à mão.
   */
  resolved: number | null;

  /** Mesma regra do `resolved`, para "voltaria a fazer negócio". */
  wouldReturn: number | null;

  /** Reclamações moderadas/excluídas pelo portal, uma a uma. */
  removed: RemovedComplaint[];
}

/**
 * Reclamação retirada da base, descrita pelo que ela carregava.
 *
 * Contar só "quantas foram removidas" não serve: uma reclamação leva
 * embora a resposta, a avaliação, a nota e os dois indicadores. Remover
 * uma nota 1 tem que melhorar a nota do consumidor — que é justamente o
 * motivo de pedir moderação —, e um contador simples não sabe fazer
 * isso.
 */
export interface RemovedComplaint {
  id: string;
  answered: boolean;
  evaluated: boolean;
  /** Só vale quando `evaluated`. */
  score: number;
  resolved: boolean;
  wouldReturn: boolean;
}

export function emptyRemoval(id: string): RemovedComplaint {
  return {
    id,
    answered: true,
    evaluated: true,
    score: 1,
    resolved: false,
    wouldReturn: false,
  };
}

export const emptySimulation: SimulationInput = {
  answerPending: 0,
  addAnswered: 0,
  addUnanswered: 0,
  ratings: {},
  resolved: null,
  wouldReturn: null,
  removed: [],
};

/** Quantas reclamações da base ainda não têm resposta pública. */
export function pendingAnswers(base: ReputationRaw) {
  return Math.max(base.received - base.answered, 0);
}

/**
 * Quantas reclamações do período ainda podem receber avaliação.
 *
 * **Uma avaliação pertence a uma reclamação.** Não existe avaliação
 * solta no Reclame Aqui: o consumidor avalia o atendimento de um caso
 * que ele abriu. Logo o número de avaliadas nunca passa o de recebidas,
 * e o que dá para conquistar num período é, no máximo, o que ainda está
 * sem avaliação.
 *
 * Sem esse teto a calculadora aceitava 200 avaliações nota 10 sobre 129
 * reclamações e prometia nota 9,5 — medido na base real em 23/08. Era o
 * pior tipo de erro que uma calculadora pode ter: ela não travava nem
 * avisava, respondia com um número redondo e convincente para um plano
 * que não tem como acontecer.
 */
export function pendingEvaluations(base: ReputationRaw) {
  return Math.max(base.received - base.evaluated, 0);
}

export function totalRatings(
  ratings: Record<number, number>
) {
  return Object.values(ratings).reduce(
    (sum, value) => sum + (value || 0),
    0
  );
}

/**
 * Nota a partir da qual o consumidor entra como promotor. Serve de
 * palpite inicial para "resolvidas" e "voltariam" quando o cenário não
 * define os dois à mão.
 */
export const PROMOTER_SCORE = 7;

export function positiveRatings(
  ratings: Record<number, number>
) {
  return Object.entries(ratings).reduce(
    (sum, [nota, qtd]) =>
      sum +
      (Number(nota) >= PROMOTER_SCORE ? qtd || 0 : 0),
    0
  );
}

/**
 * Resolve os dois indicadores do cenário: o valor definido à mão, ou o
 * palpite pelas notas. Nunca passa do total de avaliações — mais
 * resolvidas do que avaliações jogaria o índice acima de 100%.
 */
export function resolveIndicators(
  input: SimulationInput
) {

  const total = totalRatings(input.ratings);
  const positivas = positiveRatings(input.ratings);

  const limitar = (valor: number | null) =>
    Math.min(Math.max(valor ?? positivas, 0), total);

  return {
    total,
    resolved: limitar(input.resolved),
    wouldReturn: limitar(input.wouldReturn),
  };
}

/**
 * Aplica um cenário hipotético sobre as contagens reais.
 * Diferente da calculadora do Hugme, funciona sobre qualquer janela —
 * inclusive a do próximo período, ainda não fechada.
 */
/**
 * Nenhum campo do cenário aceita número negativo.
 *
 * "Menos vinte avaliações nota 3" não quer dizer nada — e produzia
 * resultado pior do que um erro: as vinte saíam de `evaluated` mas
 * sessenta pontos saíam de `scoreSum`, e a média do consumidor subia
 * para **18,97**, entregando uma nota final de 12,7 numa escala que vai
 * até 10.
 *
 * A tela já travava dois dos campos em zero; `answerPending`,
 * `addAnswered' e `addUnanswered` passavam direto, e `min={0}` no
 * HTML é dica de validação, não trava — digitar "-50" grava -50. A
 * defesa fica aqui porque este é o ponto por onde todo mundo passa.
 */
function saneia(input: SimulationInput): SimulationInput {

  const naoNegativo = (valor: number) =>
    Number.isFinite(valor) ? Math.max(valor, 0) : 0;

  const ratings: Record<number, number> = {};

  for (const [nota, qtd] of Object.entries(
    input.ratings
  )) {
    ratings[Number(nota)] = naoNegativo(qtd || 0);
  }

  return {
    ...input,
    answerPending: naoNegativo(input.answerPending),
    addAnswered: naoNegativo(input.addAnswered),
    addUnanswered: naoNegativo(input.addUnanswered),
    ratings,
    resolved:
      input.resolved === null
        ? null
        : naoNegativo(input.resolved),
    wouldReturn:
      input.wouldReturn === null
        ? null
        : naoNegativo(input.wouldReturn),
  };
}

export function simulate(
  base: ReputationRaw,
  entrada: SimulationInput
): ReputationRaw {

  const input = saneia(entrada);

  const novasAvaliacoes = totalRatings(input.ratings);

  const somaNotas = Object.entries(input.ratings).reduce(
    (sum, [nota, qtd]) =>
      sum + Number(nota) * (qtd || 0),
    0
  );

  const indicadores = resolveIndicators(input);

  // Cada remoção leva embora tudo o que aquela reclamação sustentava.
  const removidas = input.removed.slice(
    0,
    base.received
  );

  const conta = (
    filtro: (item: RemovedComplaint) => boolean
  ) => removidas.filter(filtro).length;

  const removidasAvaliadas = removidas.filter(
    (item) => item.evaluated
  );

  const notasRemovidas = removidasAvaliadas.reduce(
    (sum, item) => sum + item.score,
    0
  );

  // Não dá para responder mais do que o que está pendente.
  const respondidasAgora = Math.min(
    Math.max(input.answerPending, 0),
    pendingAnswers(base)
  );

  /** Nenhuma contagem pode ficar negativa se o cenário exagerar. */
  const naoNegativo = (valor: number) =>
    Math.max(valor, 0);

  const received = naoNegativo(
    base.received +
      input.addAnswered +
      input.addUnanswered -
      removidas.length
  );

  /**
   * O teto corta a avaliação inteira — contagem **e** nota.
   *
   * Uma primeira versão limitou só `evaluated` e deixou `scoreSum`
   * passar inteiro. Foi pior do que o defeito original: com 200 notas
   * 10 sobre 129 reclamações, o denominador parava em 129 e o
   * numerador seguia até 2.610, dando média 20,2 e **nota final 12,9**
   * numa escala que vai até 10. O bug estava na tela, não no teste — a
   * conferência olhava só a contagem, e por isso passou.
   *
   * O corte mantém a proporção entre as notas digitadas. É o que a
   * pessoa quis dizer: quem pede 200 avaliações nota 10 e só tem 51
   * vagas está pedindo 51 avaliações nota 10, não 51 avaliações de
   * nota qualquer.
   */
  const avaliadasDaBase = naoNegativo(
    base.evaluated - removidasAvaliadas.length
  );

  /** Quantas avaliações novas ainda cabem no cenário. */
  const espaco = naoNegativo(
    received - avaliadasDaBase
  );

  const aceitas = Math.min(novasAvaliacoes, espaco);

  /**
   * A soma acompanha o corte pelo mesmo fator, preservando a média do
   * que foi digitado. Cortar por nota — as mais altas primeiro, ou as
   * mais baixas — mudaria a média e responderia outra pergunta.
   */
  const fatorDoCorte =
    novasAvaliacoes === 0
      ? 1
      : aceitas / novasAvaliacoes;

  const somaAceita = somaNotas * fatorDoCorte;

  const evaluated = avaliadasDaBase + aceitas;

  return {
    received,

    // O cenário não altera o tempo de resposta já apurado.
    responseMinutesSum: base.responseMinutesSum,
    responseSamples: base.responseSamples,

    answered: Math.min(
      naoNegativo(
        base.answered +
          respondidasAgora +
          input.addAnswered -
          conta((item) => item.answered)
      ),
      received
    ),

    evaluated,

    scoreSum: naoNegativo(
      base.scoreSum + somaAceita - notasRemovidas
    ),

    /**
     * Os dois indicadores derivados encolhem pelo mesmo fator.
     *
     * Sem isto, pedir 251 avaliações nota 10 num teto de 51 rendia 251
     * "resolvidas" — que o `Math.min` abaixo depois grudava no total,
     * levando o índice de solução a 100% e a nota a 9,5 em vez de 9,1.
     * O excedente descartado continuava mexendo na nota por uma porta
     * lateral, e a diferença de 0,4 é grande num número que vai de 0 a
     * 10.
     */
    resolved: Math.min(
      naoNegativo(
        base.resolved +
          indicadores.resolved * fatorDoCorte -
          conta(
            (item) => item.evaluated && item.resolved
          )
      ),
      evaluated
    ),

    wouldReturn: Math.min(
      naoNegativo(
        base.wouldReturn +
          indicadores.wouldReturn * fatorDoCorte -
          conta(
            (item) =>
              item.evaluated && item.wouldReturn
          )
      ),
      evaluated
    ),
  };
}

export interface SimulationTarget {
  band: ScoreBand;
  /** Avaliações nota 10, resolvidas e favoráveis, para bater a meta. */
  needed: number;
  reachable: boolean;
  projected: number;
  /**
   * Por que não dá, quando não dá.
   *
   * "Não alcançável" sem motivo manda a pessoa adivinhar. São duas
   * situações diferentes e com saída diferente: ou acabaram as
   * reclamações sem avaliação do período (`sem-avaliacoes`), e aí só o
   * tempo traz mais; ou há espaço de sobra e mesmo com tudo nota 10 a
   * nota não chega (`teto-da-nota`), e aí o caminho é o índice de
   * resposta.
   */
  reason?: "sem-avaliacoes" | "teto-da-nota";
  /** Quantas avaliações ainda cabem no período. */
  ceiling?: number;
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

  /**
   * A busca para onde acabam as reclamações sem avaliação.
   *
   * Antes ela subia até 2000 sem olhar para a base, e devolvia um
   * número que `simulate` — depois do teto — não consegue reproduzir.
   * Os dois caminhos existem na mesma tela: a pessoa lê "faltam N" de
   * um e digita N no outro. Discordarem é a tela mentindo para si
   * mesma.
   */
  const teto = pendingEvaluations(base);

  const maximo = Math.min(limit, teto);

  let raw = base;

  for (let n = 1; n <= maximo; n++) {

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
        ceiling: teto,
      };
    }
  }

  return {
    band: target,
    needed: maximo,
    reachable: false,
    projected: scoreFrom(raw).raScore,
    reason:
      teto <= limit ? "sem-avaliacoes" : "teto-da-nota",
    ceiling: teto,
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

    return item.createdAt < shift(hojeNaOperacao(), -7);
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

/**
 * Preto ou branco sobre uma cor, pelo que se lê melhor.
 *
 * As faixas da nota são cores de sinalização — vermelho para o pior,
 * verde-limão para o selo — e a etiqueta escrevia sempre em branco. Nas
 * duas faixas claras isso dava **1,98:1**: "RA1000" em branco sobre
 * limão é quase invisível, e sempre foi, nos dois temas. Não era defeito
 * do escuro; era defeito que o escuro fez aparecer numa auditoria.
 *
 * O corte é a luminância relativa da WCAG. Acima de 0,45 a cor é clara o
 * bastante para pedir texto escuro; abaixo, texto claro. É o mesmo
 * cálculo que decide contraste, aplicado uma vez em vez de escolhido a
 * olho para cada cor.
 */
export function textoSobre(cor: string) {

  const hex = cor.replace("#", "");

  const canal = (i: number) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928
      ? v / 12.92
      : Math.pow((v + 0.055) / 1.055, 2.4);
  };

  const luminancia =
    0.2126 * canal(0) +
    0.7152 * canal(2) +
    0.0722 * canal(4);

  return luminancia > 0.45 ? "#18181B" : "#FFFFFF";
}
