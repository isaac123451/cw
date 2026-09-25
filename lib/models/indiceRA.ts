import { respondida, type Case } from "@/lib/models/case";
import {
  diaNaOperacao,
  evaluationsToReach,
  getRange,
  getRawCounts,
  hasRA1000,
  inRange,
  RA1000_BAND,
  RA1000_MINIMO_DE_AVALIACOES,
  RA1000_TARGETS,
  scoreFrom,
  type PeriodMode,
  type ReputationSummary,
  type SimulationTarget,
} from "@/lib/services/reputation.service";

/**
 * O índice do Reclame Aqui como o HugMe mostra (Fase 32, 1.75).
 *
 * "Índice atual e prévia do futuro, 6 e 12 meses, régua até o RA1000,
 * nota não arredondada e a evolução dia a dia do mês."
 *
 * - **Atual** é o período vigente: os meses fechados — a nota pública.
 * - **Prévia** é o próximo período: entra o mês corrente e sai o mais
 *   antigo — a nota que o portal vai mostrar na virada do mês.
 * - **Evolução do mês**: como as duas estavam no fim de cada dia do mês,
 *   com o que se sabia naquele dia (a resposta e a avaliação contam do
 *   dia em que aconteceram, não do dia em que se olha).
 */

export type PeriodoDoIndice = "6m" | "12m";

export interface RetratoDoIndice {
  periodo: PeriodoDoIndice;
  modo: PeriodMode;
  inicio: string;
  fim: string;
  resumo: ReputationSummary;
  selo: boolean;
  /** O que falta, indicador por indicador, para o selo RA1000. */
  falta: FaltaParaOSelo;
}

export interface FaltaParaOSelo {
  /** Respostas públicas que faltam para 90% de resposta — ou 0. */
  respostas: number;
  /** Avaliações que faltam para o mínimo de 50 do selo. */
  avaliacoesMinimas: number;
  /** Avaliações nota 10, resolvidas e "voltaria", para o selo inteiro. */
  avaliacoesIdeais: SimulationTarget;
}

/** A reclamação como estava no fim de um dia: sem a resposta e a avaliação que vieram depois. */
export function comoEstavaNoDia(item: Case, dia: string): Case {
  const respondidaAte = respondida(item) && (!item.publicResponseAt || diaNaOperacao(item.publicResponseAt) <= dia);
  /* Avaliação sem data (3 da carga antiga) conta como anterior: é o que o portal já mostrava. */
  const avaliadaAte = Boolean(item.evaluated) && (!item.evaluatedAt || diaNaOperacao(item.evaluatedAt) <= dia);
  if (respondidaAte === respondida(item) && avaliadaAte === Boolean(item.evaluated)) return item;
  return {
    ...item,
    respondida: respondidaAte,
    publicResponse: respondidaAte ? item.publicResponse : "",
    evaluated: avaliadaAte,
    resolved: avaliadaAte ? item.resolved : false,
    wouldDoBusiness: avaliadaAte ? item.wouldDoBusiness : false,
  };
}

function faltaParaOSelo(resumo: ReputationSummary, casos: Case[]): FaltaParaOSelo {
  const raw = getRawCounts(casos);
  /* O mesmo critério do selo: o índice com uma casa, como o portal mostra (89,96% é 90,0%). */
  let respostas = 0;
  while (raw.answered + respostas < raw.received && scoreFrom({ ...raw, answered: raw.answered + respostas }).responseIndex < RA1000_TARGETS.resposta) respostas += 1;
  /*
    As avaliações contam já com as respostas feitas: avaliação não sobe o
    índice de resposta, e sem isto a conta diria "não alcança" quando o que
    falta é responder.
  */
  return {
    respostas,
    avaliacoesMinimas: Math.max(0, RA1000_MINIMO_DE_AVALIACOES - resumo.evaluated),
    avaliacoesIdeais: evaluationsToReach({ ...raw, answered: raw.answered + respostas }, RA1000_BAND, true),
  };
}

/** A janela de 6 ou 12 meses, vigente ou próxima, e a nota dela. */
export function retratoDoIndice(casos: Case[], periodo: PeriodoDoIndice, modo: PeriodMode): RetratoDoIndice {
  const range = getRange(periodo, modo);
  const naJanela = casos.filter((c) => inRange(c, range.start, range.end));
  const resumo = scoreFrom(getRawCounts(naJanela));
  return {
    periodo,
    modo,
    inicio: range.start,
    fim: range.end,
    resumo,
    selo: hasRA1000(resumo),
    falta: faltaParaOSelo(resumo, naJanela),
  };
}

export interface DiaDaEvolucao {
  dia: string;
  /** A nota vigente como estava no fim do dia (os meses fechados, com as avaliações que tinham chegado). */
  atual: number;
  /** A prévia: a janela que termina neste dia. */
  previa: number;
  recebidasNoDia: number;
  respondidasNoDia: number;
  avaliadasNoDia: number;
}

function mais(dia: string, n: number) {
  return new Date(Date.parse(`${dia}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}

function inicioDoMes(dia: string, deslocamento: number) {
  const [a, m] = dia.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1 + deslocamento, 1)).toISOString().slice(0, 10);
}

/**
 * Do dia 1 do mês até hoje, a nota exata de cada dia.
 *
 * A vigente não muda de janela no mês — os meses fechados são os mesmos —,
 * mas muda com as avaliações que chegam de reclamações antigas. A prévia
 * cresce com cada reclamação nova do mês.
 */
export function evolucaoDoMes(casos: Case[], periodo: PeriodoDoIndice, hoje: string): DiaDaEvolucao[] {
  const meses = periodo === "6m" ? 6 : 12;
  const primeiro = inicioDoMes(hoje, 0);
  const vigente = { inicio: inicioDoMes(hoje, -meses), fim: mais(primeiro, -1) };
  const previaInicio = inicioDoMes(hoje, -(meses - 1));

  const dias: DiaDaEvolucao[] = [];
  for (let dia = primeiro; dia <= hoje; dia = mais(dia, 1)) {
    const noDia = casos.map((c) => comoEstavaNoDia(c, dia));
    const atual = scoreFrom(getRawCounts(noDia.filter((c) => inRange(c, vigente.inicio, vigente.fim)))).raScoreExato;
    const previa = scoreFrom(getRawCounts(noDia.filter((c) => inRange(c, previaInicio, dia)))).raScoreExato;
    dias.push({
      dia,
      atual,
      previa,
      recebidasNoDia: casos.filter((c) => diaNaOperacao(c.createdAt) === dia).length,
      respondidasNoDia: casos.filter((c) => respondida(c) && c.publicResponseAt && diaNaOperacao(c.publicResponseAt) === dia).length,
      avaliadasNoDia: casos.filter((c) => c.evaluated && c.evaluatedAt && diaNaOperacao(c.evaluatedAt) === dia).length,
    });
  }
  return dias;
}

/** "8,52897" — cinco casas, vírgula. */
export function notaExata(valor: number) {
  return valor.toFixed(5).replace(".", ",");
}
