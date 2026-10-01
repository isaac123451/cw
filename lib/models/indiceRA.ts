import { respondida, type Case } from "@/lib/models/case";
import { cicloAnterior, cicloDe, type Ciclo } from "@/lib/models/ciclo";
import {
  contasDoMes,
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
 * - **Evolução**: como as duas estavam no fim de cada dia, ciclo ou mês,
 *   com o que se sabia naquele dia (a resposta e a avaliação contam do
 *   dia em que aconteceram, não do dia em que se olha).
 *
 * **Quem entra na janela é a reclamação aberta nela** — e a avaliação dela
 * vale a partir do dia em que chegou. É a regra do portal, provada em
 * 01/10/2026 contra o painel oficial lido pela extensão: nos 6 meses, 72
 * avaliadas, solução 95,8%, voltaria 83,3%, nota do consumidor 8,49 e nota
 * 8,9, iguais nas cinco. Contar a avaliação pela data em que foi feita
 * daria 81 avaliadas e 7,91 — longe do portal. Por isso a data da
 * avaliação decide **quando** ela muda a nota, e a data da reclamação
 * decide **em que janela** ela está.
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

/**
 * A reclamação com a resposta como estava em `diaResposta` e a avaliação
 * como estava em `diaAvaliacao` (1.118).
 *
 * Separadas para medir o que cada uma somou num período: a nota no fim
 * dele, menos a mesma conta com as respostas (ou as avaliações) paradas no
 * dia anterior.
 */
export function estadoEm(item: Case, diaResposta: string, diaAvaliacao: string): Case {
  const respondidaAte = respondida(item) && (!item.publicResponseAt || diaNaOperacao(item.publicResponseAt) <= diaResposta);
  /* Avaliação sem data (3 da carga antiga) conta como anterior: é o que o portal já mostrava. */
  const avaliadaAte = Boolean(item.evaluated) && (!item.evaluatedAt || diaNaOperacao(item.evaluatedAt) <= diaAvaliacao);
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

/** A reclamação como estava no fim de um dia: sem a resposta e a avaliação que vieram depois. */
export function comoEstavaNoDia(item: Case, dia: string): Case {
  return estadoEm(item, dia, dia);
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

function mais(dia: string, n: number) {
  return new Date(Date.parse(`${dia}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}

function inicioDoMes(dia: string, deslocamento: number) {
  const [a, m] = dia.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1 + deslocamento, 1)).toISOString().slice(0, 10);
}

/** "8,5290" — a nota detalhada, com quatro casas (1.110: "pode ser somente 4 dígitos após a vírgula"). */
export function notaExata(valor: number) {
  return valor.toFixed(4).replace(".", ",");
}

/* ============================================================
   EVOLUÇÃO — POR DIA, CICLO OU MÊS (1.118)
============================================================ */

/**
 * Pedido de 01/10/2026: "eu gostava quando aparecia na parte dos índices
 * como foi cada dia e o quanto aumentou quando eu respondia reclamação,
 * pode fazer algo melhorado que tenha a possibilidade de ver por dia,
 * ciclo, mês". A evolução era só do mês corrente — no dia 1º ela tinha um
 * ponto, e parecia ter sumido.
 */
export type EscalaDaEvolucao = "dia" | "ciclo" | "mes";

/** Quantos períodos cada escala mostra de uma vez. */
export const PERIODOS_POR_ESCALA: Record<EscalaDaEvolucao, number> = { dia: 31, ciclo: 10, mes: 12 };

export interface PeriodoDaEvolucao {
  chave: string;
  /** "05/09", "8 a 14/09", "set/26" */
  rotulo: string;
  inicio: string;
  /** O último dia contado — hoje, se o período está em curso. */
  fim: string;
  emCurso: boolean;
}

export interface PontoDaEvolucao extends PeriodoDaEvolucao {
  /** A nota que o portal mostra no fim do período: os meses fechados, como estavam naquele dia. */
  atual: number;
  /** A janela que termina no fim do período, com o mês em curso — a que vem na virada. */
  previa: number;
  /** Quanto cada uma andou desde o fim do período anterior. */
  variacaoAtual: number;
  variacaoPrevia: number;
  /**
   * O que as respostas publicadas no período somaram à prévia: a nota no
   * fim dele, menos a mesma conta com as respostas paradas no dia anterior.
   */
  efeitoDasRespostas: number;
  /** O mesmo, para as avaliações que chegaram no período. */
  efeitoDasAvaliacoes: number;
  /** Reclamações abertas no período. */
  recebidas: number;
  /** Respostas públicas publicadas no período (pela data da resposta). */
  respondidas: number;
  /** Avaliações feitas no período (pela data da avaliação), inclusive as desconsideradas — como o portal conta. */
  avaliadas: number;
  /** Média das notas das avaliações feitas no período (sem as desconsideradas). */
  notaDasAvaliacoes: number | null;
  resolvidas: number;
  voltaria: number;
  /**
   * Só no mês: a nota do mês pela conta única (`contasDoMes`, 1.121) — a
   * mesma dos Gráficos, do Analytics e da extensão — e quantas das
   * reclamações abertas nele seguem sem resposta.
   */
  doMes?: { nota: number | null; semResposta: number };
  /**
   * O período tem um dia 1º: a janela trocou de meses — sai o mais antigo,
   * entra o novo. Explica a nota que anda sem resposta nem avaliação (em
   * 01/10/2026, +0,1877 na prévia sem nada feito no dia).
   */
  virada: boolean;
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function nomeDoMes(dia: string) {
  return `${MESES[Number(dia.slice(5, 7)) - 1]}/${dia.slice(2, 4)}`;
}

function cicloSeguinte(c: Ciclo): Ciclo {
  return cicloDe(mais(c.fim, 1));
}

/**
 * Os períodos de uma tela da evolução, do mais antigo ao mais novo,
 * terminando no período que contém `ancora` e nunca passando de hoje.
 *
 * - dia: os 31 dias até `ancora` — corridos, e não o mês do calendário:
 *   no dia 1º o mês teria um ponto só, que foi o "sumiu" do pedido;
 * - ciclo: os 10 ciclos até o de `ancora`;
 * - mês: os 12 meses até o de `ancora`.
 */
export function periodosDaEvolucao(escala: EscalaDaEvolucao, ancora: string, hoje: string): PeriodoDaEvolucao[] {
  const alvo = ancora > hoje ? hoje : ancora;
  const lista: PeriodoDaEvolucao[] = [];
  const empurrar = (chave: string, rotulo: string, inicio: string, fimCheio: string) => {
    if (inicio > hoje) return;
    lista.push({ chave, rotulo, inicio, fim: fimCheio > hoje ? hoje : fimCheio, emCurso: fimCheio >= hoje });
  };

  if (escala === "dia") {
    for (let d = mais(alvo, -(PERIODOS_POR_ESCALA.dia - 1)); d <= alvo; d = mais(d, 1)) empurrar(d, `${d.slice(8)}/${d.slice(5, 7)}`, d, d);
    return lista;
  }

  if (escala === "ciclo") {
    let c = cicloDe(alvo);
    for (let i = 1; i < PERIODOS_POR_ESCALA.ciclo; i += 1) c = cicloAnterior(c);
    for (let i = 0; i < PERIODOS_POR_ESCALA.ciclo; i += 1) {
      empurrar(c.id, c.rotulo, c.inicio, c.fim);
      c = cicloSeguinte(c);
    }
    return lista;
  }

  for (let i = PERIODOS_POR_ESCALA.mes - 1; i >= 0; i -= 1) {
    const inicio = inicioDoMes(alvo, -i);
    empurrar(inicio.slice(0, 7), nomeDoMes(inicio), inicio, mais(inicioDoMes(alvo, -i + 1), -1));
  }
  return lista;
}

/** A âncora de uma tela antes ou depois: os 31 dias, os 10 ciclos ou os 12 meses vizinhos. */
export function ancoraVizinha(escala: EscalaDaEvolucao, ancora: string, passo: -1 | 1): string {
  if (escala === "dia") return mais(ancora, passo * PERIODOS_POR_ESCALA.dia);
  if (escala === "ciclo") {
    let c = cicloDe(ancora);
    for (let i = 0; i < PERIODOS_POR_ESCALA.ciclo; i += 1) c = passo < 0 ? cicloAnterior(c) : cicloSeguinte(c);
    return passo < 0 ? c.fim : c.inicio;
  }
  return passo < 0 ? mais(inicioDoMes(ancora, -(PERIODOS_POR_ESCALA.mes - 1)), -1) : inicioDoMes(ancora, PERIODOS_POR_ESCALA.mes);
}

function notaDe(lista: Case[], diaResposta: string, diaAvaliacao: string) {
  return scoreFrom(getRawCounts(lista.map((c) => estadoEm(c, diaResposta, diaAvaliacao)))).raScoreExato;
}

/** As duas notas como estavam no fim de `dia`. */
function notasNoDia(casos: Case[], meses: number, dia: string) {
  const vigente = casos.filter((c) => inRange(c, inicioDoMes(dia, -meses), mais(inicioDoMes(dia, 0), -1)));
  const janela = casos.filter((c) => inRange(c, inicioDoMes(dia, -(meses - 1)), dia));
  return { atual: notaDe(vigente, dia, dia), previa: notaDe(janela, dia, dia), janela };
}

function noPeriodo(valor: string | undefined, inicio: string, fim: string) {
  if (!valor) return false;
  const dia = diaNaOperacao(valor);
  return dia >= inicio && dia <= fim;
}

/**
 * A evolução da nota numa escala: cada ponto é o fim de um período, com as
 * duas notas como estavam naquele dia, quanto andaram, o que as respostas
 * e as avaliações do período somaram, e o que aconteceu nele — cada coisa
 * pela data em que aconteceu (a avaliação, no dia em que foi avaliada).
 */
export function evolucaoDoIndice(
  casos: Case[],
  periodo: PeriodoDoIndice,
  escala: EscalaDaEvolucao,
  ancora: string,
  hoje: string
): PontoDaEvolucao[] {
  const meses = periodo === "6m" ? 6 : 12;
  const periodos = periodosDaEvolucao(escala, ancora, hoje);
  if (periodos.length === 0) return [];

  let anterior = notasNoDia(casos, meses, mais(periodos[0].inicio, -1));

  return periodos.map((p) => {
    const agora = notasNoDia(casos, meses, p.fim);
    const vespera = mais(p.inicio, -1);
    const avaliadasNoPeriodo = casos.filter((c) => c.evaluated && noPeriodo(c.evaluatedAt, p.inicio, p.fim));
    const valem = avaliadasNoPeriodo.filter((c) => !c.scoreDisregarded);

    const ponto: PontoDaEvolucao = {
      ...p,
      atual: agora.atual,
      previa: agora.previa,
      variacaoAtual: agora.atual - anterior.atual,
      variacaoPrevia: agora.previa - anterior.previa,
      efeitoDasRespostas: agora.previa - notaDe(agora.janela, vespera, p.fim),
      efeitoDasAvaliacoes: agora.previa - notaDe(agora.janela, p.fim, vespera),
      recebidas: casos.filter((c) => noPeriodo(c.createdAt, p.inicio, p.fim)).length,
      respondidas: casos.filter((c) => respondida(c) && noPeriodo(c.publicResponseAt, p.inicio, p.fim)).length,
      avaliadas: avaliadasNoPeriodo.length,
      notaDasAvaliacoes: valem.length ? valem.reduce((s, c) => s + (c.score ?? 0), 0) / valem.length : null,
      resolvidas: valem.filter((c) => c.resolved).length,
      voltaria: valem.filter((c) => c.wouldDoBusiness).length,
      virada: p.inicio.slice(8) === "01",
    };

    if (escala === "mes") {
      const raw = contasDoMes(casos, p.inicio.slice(0, 7));
      ponto.doMes = {
        nota: raw.received > 0 || raw.evaluated > 0 ? scoreFrom(raw).raScoreExato : null,
        semResposta: raw.received - raw.answered,
      };
    }

    anterior = agora;
    return ponto;
  });
}
