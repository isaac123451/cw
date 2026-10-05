import { respondida, type Case } from "@/lib/models/case";
import { categoriaOficial } from "@/lib/models/taxonomia";
import { diaNaOperacao, getRawCounts, RA1000_TARGETS, scoreFrom } from "@/lib/services/reputation.service";

/**
 * O que mais está chegando como reclamação (1.133).
 *
 * O pedido, de 05/10/2026: "adicione em alguma parte do reclame aqui que
 * mostre o que mais está caindo como reclamação". Para cada assunto (a
 * categoria oficial) e cada subcategoria dentro dele:
 *
 * - **Quantas chegaram** no período e a parte do total.
 * - **Quantas costumam chegar** num período do mesmo tamanho — a média dos
 *   três períodos anteriores (30 dias contra os 90 de antes; um ciclo
 *   contra os 21 dias de antes).
 * - **Se está em alta, em queda ou estável.** Com poucos casos, 2 contra 1
 *   é o dobro e não quer dizer nada. A régua é a chance de ver tantas (ou
 *   tão poucas) só por acaso, se o ritmo fosse o de costume (Poisson): em
 *   alta quando essa chance fica abaixo de 10% e chegaram pelo menos 3; em
 *   queda, o espelho, quando o de costume era pelo menos 3.
 * - **O peso na nota:** quanto a nota da janela de 6 meses seria
 *   diferente sem as reclamações do assunto — o que diz qual assunto
 *   custa mais caro, não só qual chega mais.
 */

export type Tendencia = "alta" | "queda" | "estavel" | "novo";

export interface LinhaDoAssunto {
  nome: string;
  recente: number;
  /** Quantas costumam chegar num período do mesmo tamanho. */
  esperado: number;
  /** Parte do total do período, 0–100. */
  parte: number;
  tendencia: Tendencia;
  /** A chance de ver isso só por acaso (0–1); menor é mais forte. */
  chance: number;
  semResposta: number;
  /** Na janela de 6 meses: nota, solução e voltaria das avaliadas do assunto. */
  avaliadas: number;
  nota: number | null;
  solucao: number | null;
  voltaria: number | null;
  /** Nota da janela sem o assunto, menos a nota com ele. Positivo: o assunto puxa a nota para baixo. */
  pesoNaNota: number | null;
  exemplos: { protocolo: string; titulo: string; dia: string }[];
  subcategorias: LinhaDoAssunto[];
}

export interface AssuntosDoPeriodo {
  de: string;
  ate: string;
  dias: number;
  base: { de: string; ate: string };
  total: number;
  totalEsperado: number;
  linhas: LinhaDoAssunto[];
  /** As que estão em alta, da mais forte para a mais fraca — o que pede ação. */
  emAlta: LinhaDoAssunto[];
}

const DIA = 86_400_000;
const somar = (dia: string, n: number) => new Date(Date.parse(`${dia}T00:00:00Z`) + n * DIA).toISOString().slice(0, 10);
const diasEntre = (de: string, ate: string) => Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / DIA) + 1;

/** P(X ≥ k) para X ~ Poisson(λ). */
export function chanceDeAoMenos(k: number, lambda: number) {
  if (k <= 0) return 1;
  let termo = Math.exp(-lambda);
  let acumulado = termo;
  for (let i = 1; i < k; i++) {
    termo *= lambda / i;
    acumulado += termo;
  }
  return Math.max(0, 1 - acumulado);
}

/** P(X ≤ k) para X ~ Poisson(λ). */
export function chanceDeNoMaximo(k: number, lambda: number) {
  let termo = Math.exp(-lambda);
  let acumulado = termo;
  for (let i = 1; i <= k; i++) {
    termo *= lambda / i;
    acumulado += termo;
  }
  return Math.min(1, acumulado);
}

export const CORTE_DA_CHANCE = 0.1;

export function tendenciaDe(recente: number, esperado: number): { tendencia: Tendencia; chance: number } {
  if (esperado === 0) return { tendencia: recente >= 2 ? "novo" : "estavel", chance: recente >= 2 ? 0 : 1 };
  const alta = chanceDeAoMenos(recente, esperado);
  if (recente > esperado && recente >= 3 && alta < CORTE_DA_CHANCE) return { tendencia: "alta", chance: alta };
  const queda = chanceDeNoMaximo(recente, esperado);
  if (recente < esperado && esperado >= 3 && queda < CORTE_DA_CHANCE) return { tendencia: "queda", chance: queda };
  return { tendencia: "estavel", chance: Math.min(alta, queda) };
}

/* "Não classificado" é como a lista mostra a reclamação sem categoria. */
const nomeDoAssunto = (c: Case) => (!c.category || c.category === "Não classificado" ? "Sem categoria" : categoriaOficial(c.category) || "Sem categoria");
const nomeDaSub = (c: Case) => (c.subcategory ?? "").trim() || "Sem subcategoria";

function desfechoDa(janela: Case[]) {
  const k = janela.filter((c) => c.evaluated && !c.scoreDisregarded && typeof c.score === "number");
  if (!k.length) return { avaliadas: 0, nota: null, solucao: null, voltaria: null };
  return {
    avaliadas: k.length,
    nota: Math.round((k.reduce((s, c) => s + (c.score ?? 0), 0) / k.length) * 100) / 100,
    solucao: Math.round((k.filter((c) => c.resolved).length / k.length) * 1000) / 10,
    voltaria: Math.round((k.filter((c) => c.wouldDoBusiness).length / k.length) * 1000) / 10,
  };
}

/**
 * Os assuntos de um período, contra os três períodos anteriores do mesmo
 * tamanho. `janela6m` é a janela de 6 meses da nota (a vigente), onde se
 * medem o desfecho e o peso na nota.
 */
export function assuntosDoPeriodo(casos: Case[], de: string, ate: string, janela6m: { inicio: string; fim: string }): AssuntosDoPeriodo {
  const dias = diasEntre(de, ate);
  const base = { de: somar(de, -3 * dias), ate: somar(de, -1) };
  const dia = (c: Case) => diaNaOperacao(c.createdAt);
  const noPeriodo = casos.filter((c) => dia(c) >= de && dia(c) <= ate);
  const naBase = casos.filter((c) => dia(c) >= base.de && dia(c) <= base.ate);
  const naJanela = casos.filter((c) => c.createdAt >= janela6m.inicio && c.createdAt <= janela6m.fim);
  const notaDaJanela = scoreFrom(getRawCounts(naJanela)).raScoreExato;

  const linha = (nome: string, doPeriodo: Case[], daBase: Case[], daJanela: Case[], comSub: boolean): LinhaDoAssunto => {
    const esperado = Math.round((daBase.length / 3) * 10) / 10;
    const { tendencia, chance } = tendenciaDe(doPeriodo.length, daBase.length / 3);
    const semEle = naJanela.filter((c) => !daJanela.includes(c));
    const pesoNaNota = daJanela.length && semEle.length ? Math.round((scoreFrom(getRawCounts(semEle)).raScoreExato - notaDaJanela) * 1000) / 1000 : null;
    const subs = comSub
      ? [...new Set([...doPeriodo, ...daBase].map(nomeDaSub))].map((s) =>
          linha(
            s,
            doPeriodo.filter((c) => nomeDaSub(c) === s),
            daBase.filter((c) => nomeDaSub(c) === s),
            daJanela.filter((c) => nomeDaSub(c) === s),
            false
          )
        )
      : [];
    return {
      nome,
      recente: doPeriodo.length,
      esperado,
      parte: noPeriodo.length ? Math.round((doPeriodo.length / noPeriodo.length) * 1000) / 10 : 0,
      tendencia,
      chance,
      semResposta: doPeriodo.filter((c) => !respondida(c)).length,
      ...desfechoDa(daJanela),
      pesoNaNota,
      exemplos: [...doPeriodo]
        .sort((a, b) => dia(b).localeCompare(dia(a)))
        .slice(0, 3)
        .map((c) => ({ protocolo: c.protocol, titulo: c.title, dia: dia(c) })),
      subcategorias: subs.filter((s) => s.recente > 0 || s.esperado >= 1).sort((a, b) => b.recente - a.recente || b.esperado - a.esperado).slice(0, 6),
    };
  };

  const nomes = [...new Set([...noPeriodo, ...naBase].map(nomeDoAssunto))];
  const linhas = nomes
    .map((n) => linha(n, noPeriodo.filter((c) => nomeDoAssunto(c) === n), naBase.filter((c) => nomeDoAssunto(c) === n), naJanela.filter((c) => nomeDoAssunto(c) === n), true))
    .sort((a, b) => b.recente - a.recente || b.esperado - a.esperado);

  const emAlta = linhas
    .flatMap((l) => [l, ...l.subcategorias.filter((s) => s.tendencia === "alta" || s.tendencia === "novo").map((s) => ({ ...s, nome: `${l.nome} › ${s.nome}` }))])
    .filter((l) => l.tendencia === "alta" || l.tendencia === "novo")
    .sort((a, b) => a.chance - b.chance || b.recente - a.recente);

  return {
    de,
    ate,
    dias,
    base,
    total: noPeriodo.length,
    totalEsperado: Math.round((naBase.length / 3) * 10) / 10,
    linhas,
    emAlta,
  };
}

/** O assunto abaixo de alguma meta de avaliação do selo, para a tela marcar. */
export function abaixoDaMeta(l: Pick<LinhaDoAssunto, "nota" | "solucao" | "voltaria" | "avaliadas">) {
  if (l.avaliadas < 5) return false;
  return (l.nota ?? 10) < RA1000_TARGETS.consumidor || (l.solucao ?? 100) < RA1000_TARGETS.solucao || (l.voltaria ?? 100) < RA1000_TARGETS["novos-negocios"];
}
