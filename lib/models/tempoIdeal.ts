import { respondida, type Case } from "@/lib/models/case";
import { diaNaOperacao, RA1000_TARGETS } from "@/lib/services/reputation.service";

/**
 * O tempo ideal e o teto de uma reclamação do Reclame Aqui (1.130).
 *
 * O pedido, de 02/10/2026: "um cálculo que eu entenda qual é o tempo ideal
 * para finalizar um caso do reclame aqui e o teto máximo", e o índice de
 * resposta sem cair de 90%.
 *
 * Nada aqui é número fixo: tudo sai das reclamações da própria base, e
 * muda quando elas mudam. Três perguntas, três contas:
 *
 * 1. **Finalizar** (da abertura à avaliação do consumidor). As avaliadas
 *    são divididas em faixas de dias, e cada faixa é comparada com as três
 *    metas de avaliação do RA1000 — nota do consumidor 7, solução 90%,
 *    voltaria 70%.
 *    - **Ideal:** enquanto cada faixa, desde o primeiro dia, bate as três
 *      metas. A primeira que falha encerra o ideal.
 *    - **Teto:** o primeiro corte a partir do qual **tudo o que finaliza
 *      depois** fica abaixo das três metas ao mesmo tempo — dali em
 *      diante, cada avaliação puxa os três indicadores para baixo.
 * 2. **Pedir a avaliação** (da resposta pública à avaliação): quanto das
 *    avaliações chega até N dias depois da resposta.
 * 3. **Responder** (da abertura à resposta pública): o maior prazo que,
 *    se toda reclamação fosse respondida nele, manteria o índice de
 *    resposta da janela pública em 90% **em todos os dias** dos últimos 12
 *    meses — simulado com as chegadas reais, mês a mês. O pior dia é
 *    sempre o 1º do mês: a janela passa a incluir o mês que acabou de
 *    fechar, com as reclamações dos últimos dias ainda sem resposta.
 *
 * Os dias são corridos, como os prazos do portal. A janela segue a regra
 * provada contra o portal em 01/10/2026 (`indiceRA.ts`): conta a
 * reclamação aberta nela, e a avaliação desconsiderada fica fora da nota.
 *
 * É correlação, não causa: um caso difícil demora mais **e** avalia pior.
 * O que o estudo mostra é onde a nota começa a cair, não que segurar um
 * caso fácil o tornaria difícil.
 */

const DIA = 86_400_000;

export interface Faixa {
  rotulo: string;
  de: number;
  /** Último dia da faixa, inclusive; `null` é "em diante". */
  ate: number | null;
}

export const FAIXAS_DE_FINALIZACAO: Faixa[] = [
  { rotulo: "até 3 dias", de: 0, ate: 3 },
  { rotulo: "4 a 7 dias", de: 4, ate: 7 },
  { rotulo: "8 a 10 dias", de: 8, ate: 10 },
  { rotulo: "11 a 14 dias", de: 11, ate: 14 },
  { rotulo: "15 a 21 dias", de: 15, ate: 21 },
  { rotulo: "22 a 30 dias", de: 22, ate: 30 },
  { rotulo: "31 a 60 dias", de: 31, ate: 60 },
  { rotulo: "mais de 60 dias", de: 61, ate: null },
];

export const FAIXAS_DE_RESPOSTA: Faixa[] = [
  { rotulo: "até 1 dia", de: 0, ate: 1 },
  { rotulo: "2 a 3 dias", de: 2, ate: 3 },
  { rotulo: "4 a 7 dias", de: 4, ate: 7 },
  { rotulo: "8 a 14 dias", de: 8, ate: 14 },
  { rotulo: "15 a 30 dias", de: 15, ate: 30 },
  { rotulo: "mais de 30 dias", de: 31, ate: null },
];

/** Os cortes candidatos a teto, em dias desde a abertura. */
export const CORTES_DO_TETO = [7, 10, 14, 21, 30, 45, 60];

/** Faixa com menos avaliadas que isto não decide nada — é ruído. */
export const MINIMO_POR_FAIXA = 5;
/** O grupo "depois do corte" precisa de pelo menos isto para virar teto. */
export const MINIMO_DO_TETO = 10;

/** Os marcos da curva "avaliou até N dias depois da resposta". */
export const DIAS_DA_AVALIACAO = [0, 1, 2, 3, 7, 14, 20, 30, 60];

/**
 * Resposta com menos tempo que isto ainda não teve a chance de ser
 * avaliada — fica fora da taxa de avaliação, senão as recentes a
 * puxariam para baixo só por serem recentes.
 */
export const MATURIDADE_DA_RESPOSTA = 30;

/** O mais longo prazo de resposta que a simulação testa. */
export const PRAZO_MAXIMO_SIMULADO = 30;

export type PeriodoDoEstudo = "12m" | "tudo";

export interface Desfecho {
  /** Avaliações que contam para a nota (sem as desconsideradas). */
  avaliadas: number;
  nota: number | null;
  solucao: number | null;
  voltaria: number | null;
  /** Cada meta do RA1000, batida ou não; `null` sem avaliação. */
  metas: { nota: boolean; solucao: boolean; voltaria: boolean } | null;
  /** Quantas das três metas o grupo bate. */
  batidas: number;
}

export interface FaixaComDesfecho extends Faixa {
  /** Reclamações na faixa (na resposta, todas; na finalização, as avaliadas). */
  casos: number;
  desfecho: Desfecho;
  /** Só na resposta: avaliadas ÷ respondidas há 30 dias ou mais. */
  taxaDeAvaliacao?: number | null;
  maduras?: number;
  /** A faixa tem amostra para decidir alguma coisa. */
  decide: boolean;
}

export interface Zona {
  rotulo: string;
  de: number;
  ate: number | null;
  desfecho: Desfecho;
  /** Parte das finalizadas que caiu nesta zona, 0–100. */
  parte: number;
}

export interface EstudoDoTempo {
  periodo: PeriodoDoEstudo;
  desde: string | null;
  finalizacao: {
    amostra: number;
    mediana: number | null;
    p80: number | null;
    faixas: FaixaComDesfecho[];
    /** Último dia do tempo ideal; `null` se nem a primeira faixa bate as metas. */
    ideal: number | null;
    /** O corte depois do qual tudo fica abaixo das três metas; `null` se não há. */
    teto: number | null;
    zonas: Zona[];
  };
  avaliacao: {
    amostra: number;
    mediana: number | null;
    acumulado: { dias: number; parte: number }[];
    /** Parte das avaliações que chegou mais de 30 dias depois da resposta. */
    depoisDe30: number | null;
  };
  resposta: {
    amostra: number;
    mediana: number | null;
    p80: number | null;
    faixas: FaixaComDesfecho[];
    simulacao: SimulacaoDaResposta;
  };
}

export interface SimulacaoDaResposta {
  /** O maior prazo (dias) que segura 90% em todos os dias; `null` se nem 1 dia segura. */
  prazo: number | null;
  /** O pior índice do ano com esse prazo, e em que dia. */
  piorComPrazo: { indice: number; dia: string } | null;
  /** Um dia a mais: o pior índice e o dia — é o que mostra onde quebra. */
  piorComUmDiaAMais: { indice: number; dia: string } | null;
  inicio: string;
  fim: string;
}

export interface Folga {
  inicio: string;
  fim: string;
  recebidas: number;
  respondidas: number;
  semResposta: number;
  /** O máximo de sem resposta com o índice ainda em 90% (como o portal arredonda). */
  maximoSemResposta: number;
  /** Positiva: quantas ainda podem ficar sem resposta. Negativa: quantas responder para voltar a 90%. */
  folga: number;
}

/* ============================================================
   DATAS
============================================================ */

export function somarDias(dia: string, n: number) {
  return new Date(Date.parse(`${dia}T00:00:00Z`) + n * DIA).toISOString().slice(0, 10);
}

function inicioDoMes(dia: string, deslocamento: number) {
  const [a, m] = dia.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1 + deslocamento, 1)).toISOString().slice(0, 10);
}

/** Dias corridos de `de` até `ate` (AAAA-MM-DD). */
export function diasEntre(de: string, ate: string) {
  return Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / DIA);
}

/** A janela pública vigente num dia: os 6 meses fechados antes do mês dele. */
export function janelaVigenteNoDia(dia: string) {
  return { inicio: inicioDoMes(dia, -6), fim: somarDias(inicioDoMes(dia, 0), -1) };
}

export function inicioDoEstudo(hoje: string, periodo: PeriodoDoEstudo) {
  return periodo === "12m" ? inicioDoMes(hoje, -12) : null;
}

function percentil(ordenados: number[], p: number): number | null {
  if (ordenados.length === 0) return null;
  const pos = (ordenados.length - 1) * p;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return ordenados[lo] + (ordenados[hi] - ordenados[lo]) * (pos - lo);
}

/** Uma casa decimal, como o portal mostra as porcentagens. */
function porcento(parte: number, total: number) {
  return total === 0 ? 0 : Math.round((parte / total) * 1000) / 10;
}

function dentro(f: Faixa, d: number) {
  return d >= f.de && (f.ate === null || d <= f.ate);
}

/* ============================================================
   DESFECHO DE UM GRUPO
============================================================ */

function contaParaNota(c: Case) {
  return Boolean(c.evaluated) && !c.scoreDisregarded && typeof c.score === "number";
}

/** Nota, solução e voltaria de um grupo, contra as metas do RA1000. */
export function desfechoDe(casos: Case[]): Desfecho {
  const k = casos.filter(contaParaNota);
  if (k.length === 0) return { avaliadas: 0, nota: null, solucao: null, voltaria: null, metas: null, batidas: 0 };
  const nota = Math.round((k.reduce((s, c) => s + (c.score ?? 0), 0) / k.length) * 100) / 100;
  const solucao = porcento(k.filter((c) => c.resolved).length, k.length);
  const voltaria = porcento(k.filter((c) => c.wouldDoBusiness).length, k.length);
  const metas = {
    nota: nota >= RA1000_TARGETS.consumidor,
    solucao: solucao >= RA1000_TARGETS.solucao,
    voltaria: voltaria >= RA1000_TARGETS["novos-negocios"],
  };
  return { avaliadas: k.length, nota, solucao, voltaria, metas, batidas: Number(metas.nota) + Number(metas.solucao) + Number(metas.voltaria) };
}

/* ============================================================
   OS TEMPOS DE CADA RECLAMAÇÃO
============================================================ */

function diaDaResposta(c: Case) {
  return respondida(c) && c.publicResponseAt ? diaNaOperacao(c.publicResponseAt) : null;
}

function diaDaAvaliacao(c: Case) {
  return c.evaluated && c.evaluatedAt ? diaNaOperacao(c.evaluatedAt) : null;
}

/* ============================================================
   O ESTUDO
============================================================ */

export function estudoDoTempo(casos: Case[], hoje: string, periodo: PeriodoDoEstudo): EstudoDoTempo {
  const desde = inicioDoEstudo(hoje, periodo);
  const doPeriodo = desde ? casos.filter((c) => c.createdAt >= desde) : casos;

  /* 1. Finalizar: da abertura à avaliação. */
  const finalizadas = doPeriodo
    .filter(contaParaNota)
    .map((c) => ({ c, d: diaDaAvaliacao(c) ? diasEntre(c.createdAt, diaDaAvaliacao(c)!) : null }))
    .filter((x): x is { c: Case; d: number } => x.d !== null && x.d >= 0);
  const ordF = finalizadas.map((x) => x.d).sort((a, b) => a - b);

  const faixasF: FaixaComDesfecho[] = FAIXAS_DE_FINALIZACAO.map((f) => {
    const grupo = finalizadas.filter((x) => dentro(f, x.d)).map((x) => x.c);
    return { ...f, casos: grupo.length, desfecho: desfechoDe(grupo), decide: grupo.length >= MINIMO_POR_FAIXA };
  });

  let ideal: number | null = null;
  for (const f of faixasF) {
    if (!f.decide) continue;
    if (f.desfecho.batidas < 3 || f.ate === null) break;
    ideal = f.ate;
  }

  let teto: number | null = null;
  for (const corte of CORTES_DO_TETO) {
    if (ideal !== null && corte < ideal) continue;
    const depois = finalizadas.filter((x) => x.d > corte).map((x) => x.c);
    const d = desfechoDe(depois);
    if (d.avaliadas >= MINIMO_DO_TETO && d.batidas === 0) {
      teto = corte;
      break;
    }
  }

  const total = finalizadas.length;
  const zona = (rotulo: string, de: number, ate: number | null): Zona => {
    const grupo = finalizadas.filter((x) => x.d >= de && (ate === null || x.d <= ate)).map((x) => x.c);
    return { rotulo, de, ate, desfecho: desfechoDe(grupo), parte: porcento(grupo.length, total) };
  };
  const zonas: Zona[] = [];
  if (ideal !== null) zonas.push(zona(`até ${ideal} dias`, 0, ideal));
  if (teto !== null) {
    const de = ideal === null ? 0 : ideal + 1;
    if (teto >= de) zonas.push(zona(`${de} a ${teto} dias`, de, teto));
    zonas.push(zona(`mais de ${teto} dias`, teto + 1, null));
  } else if (ideal !== null) {
    zonas.push(zona(`mais de ${ideal} dias`, ideal + 1, null));
  }

  /* 2. Pedir a avaliação: da resposta à avaliação. */
  const respostaAvaliacao = doPeriodo
    .filter((c) => c.evaluated)
    .map((c) => {
      const r = diaDaResposta(c);
      const a = diaDaAvaliacao(c);
      return r && a ? diasEntre(r, a) : null;
    })
    .filter((d): d is number => d !== null && d >= 0);
  const ordRA = respostaAvaliacao.slice().sort((a, b) => a - b);

  /* 3. Responder: da abertura à resposta pública. */
  const respondidas = doPeriodo
    .map((c) => ({ c, r: diaDaResposta(c) }))
    .filter((x): x is { c: Case; r: string } => x.r !== null)
    .map((x) => ({ c: x.c, r: x.r, d: diasEntre(x.c.createdAt, x.r) }))
    .filter((x) => x.d >= 0);
  const ordR = respondidas.map((x) => x.d).sort((a, b) => a - b);
  const faixasR: FaixaComDesfecho[] = FAIXAS_DE_RESPOSTA.map((f) => {
    const grupo = respondidas.filter((x) => dentro(f, x.d));
    const maduras = grupo.filter((x) => diasEntre(x.r, hoje) >= MATURIDADE_DA_RESPOSTA);
    return {
      ...f,
      casos: grupo.length,
      desfecho: desfechoDe(grupo.map((x) => x.c)),
      maduras: maduras.length,
      taxaDeAvaliacao: maduras.length ? porcento(maduras.filter((x) => x.c.evaluated).length, maduras.length) : null,
      decide: grupo.length >= MINIMO_POR_FAIXA,
    };
  });

  return {
    periodo,
    desde,
    finalizacao: { amostra: total, mediana: percentil(ordF, 0.5), p80: percentil(ordF, 0.8), faixas: faixasF, ideal, teto, zonas },
    avaliacao: {
      amostra: ordRA.length,
      mediana: percentil(ordRA, 0.5),
      acumulado: DIAS_DA_AVALIACAO.map((n) => ({ dias: n, parte: porcento(ordRA.filter((d) => d <= n).length, ordRA.length) })),
      depoisDe30: ordRA.length ? porcento(ordRA.filter((d) => d > 30).length, ordRA.length) : null,
    },
    resposta: {
      amostra: respondidas.length,
      mediana: percentil(ordR, 0.5),
      p80: percentil(ordR, 0.8),
      faixas: faixasR,
      /* A simulação usa a base inteira: a janela de outubro/2025 começa em abril/2025. */
      simulacao: simularPrazoDeResposta(casos, hoje),
    },
  };
}

/* ============================================================
   O PRAZO DE RESPOSTA QUE SEGURA 90%
============================================================ */

/**
 * Se toda reclamação fosse respondida em exatamente `prazo` dias, o pior
 * índice de resposta da janela pública nos últimos 12 meses.
 *
 * "Exatamente" é o pior caso de "em até": responder antes só melhora.
 */
function piorIndice(janelas: { dia: string; abertas: string[] }[], prazo: number) {
  let pior: { indice: number; dia: string } | null = null;
  for (const j of janelas) {
    if (j.abertas.length === 0) continue;
    let sem = 0;
    for (const aberta of j.abertas) if (somarDias(aberta, prazo) > j.dia) sem += 1;
    const indice = porcento(j.abertas.length - sem, j.abertas.length);
    if (!pior || indice < pior.indice) pior = { indice, dia: j.dia };
  }
  return pior;
}

export function simularPrazoDeResposta(casos: Case[], hoje: string, meta: number = RA1000_TARGETS.resposta): SimulacaoDaResposta {
  const inicio = inicioDoMes(hoje, -12);
  const fim = somarDias(hoje, -1);
  const aberturas = casos.map((c) => c.createdAt).sort();

  /* A janela de cada dia, montada uma vez. */
  const janelas: { dia: string; abertas: string[] }[] = [];
  for (let dia = inicio; dia <= fim; dia = somarDias(dia, 1)) {
    const j = janelaVigenteNoDia(dia);
    janelas.push({ dia, abertas: aberturas.filter((a) => a >= j.inicio && a <= j.fim) });
  }

  let prazo: number | null = null;
  let piorComPrazo: SimulacaoDaResposta["piorComPrazo"] = null;
  let piorComUmDiaAMais: SimulacaoDaResposta["piorComUmDiaAMais"] = null;
  /* Mais dias, mais sem resposta em todo dia: a primeira quebra encerra a busca. */
  for (let t = 1; t <= PRAZO_MAXIMO_SIMULADO; t += 1) {
    const pior = piorIndice(janelas, t);
    if (pior && pior.indice < meta) {
      piorComUmDiaAMais = pior;
      break;
    }
    prazo = t;
    piorComPrazo = pior;
  }
  return { prazo, piorComPrazo, piorComUmDiaAMais, inicio, fim };
}

/* ============================================================
   A FOLGA DE HOJE
============================================================ */

/** Quantas ainda podem ficar sem resposta numa janela — ou quantas responder. */
export function folgaDaJanela(casos: Case[], inicio: string, fim: string, meta: number = RA1000_TARGETS.resposta): Folga {
  const naJanela = casos.filter((c) => c.createdAt >= inicio && c.createdAt <= fim);
  const recebidas = naJanela.length;
  const respondidasN = naJanela.filter((c) => respondida(c)).length;
  let maximoSemResposta = 0;
  while (maximoSemResposta < recebidas && porcento(recebidas - (maximoSemResposta + 1), recebidas) >= meta) maximoSemResposta += 1;
  const semResposta = recebidas - respondidasN;
  return { inicio, fim, recebidas, respondidas: respondidasN, semResposta, maximoSemResposta, folga: maximoSemResposta - semResposta };
}
