import { respondida, type Case } from "@/lib/models/case";
import { ciclosAte, type Ciclo } from "@/lib/models/ciclo";
import { diaNaOperacao } from "@/lib/services/reputation.service";

/**
 * O Reclame Aqui por ciclo (1.86; reorganizado em 21/10/2026).
 *
 * Duas perguntas diferentes, que a tabela antiga misturava numa linha só:
 *
 * - **das reclamações do ciclo** — as que chegaram nele, com a resposta e
 *   a avaliação de cada uma, mesmo vindas depois. É o que entra na conta da
 *   nota: "recebi uma reclamação não resolvida, está contabilizando para o
 *   mês da avaliação e não pro mês que a reclamação foi criada";
 * - **o movimento do ciclo** — quantas respostas publicamos e quantas
 *   avaliações chegaram naqueles dias, de qualquer reclamação. Só para
 *   saber ("adicione para sabermos quantas avaliações tivemos no mês, mas
 *   estas coisas não entram em cálculo").
 *
 * Avaliação sem data (a carga antiga) não entra no movimento: não há como
 * saber quando foi. Na coorte ela entra, pela reclamação.
 */
export interface DasReclamacoes {
  novas: number;
  respondidas: number;
  semResposta: number;
  avaliadas: number;
  resolvidas: number;
  voltaria: number;
  notaMedia: number | null;
}

export interface MovimentoDoPeriodo {
  respostas: number;
  avaliacoes: number;
  notaMedia: number | null;
}

export interface NumerosDoPeriodo {
  reclamacoes: DasReclamacoes;
  movimento: MovimentoDoPeriodo;
}

export interface NumerosDoCiclo extends NumerosDoPeriodo {
  ciclo: Ciclo;
}

export interface NumerosDoMesPorCiclo extends NumerosDoPeriodo {
  /** "2026-10". */
  mes: string;
  ciclos: NumerosDoCiclo[];
}

const media = (casos: Case[]) => {
  const naNota = casos.filter((c) => !c.scoreDisregarded && c.score != null);
  return naNota.length ? naNota.reduce((s, c) => s + Number(c.score), 0) / naNota.length : null;
};

/** Os números de um intervalo de dias (AAAA-MM-DD, inclusive). */
export function numerosDoPeriodo(casos: Case[], inicio: string, fim: string): NumerosDoPeriodo {
  const dentro = (dia: string | null) => dia !== null && dia >= inicio && dia <= fim;

  const novas = casos.filter((c) => c.createdAt && dentro(diaNaOperacao(c.createdAt)));
  const avaliadas = novas.filter((c) => c.evaluated);
  const avaliacoesNoPeriodo = casos.filter((c) => c.evaluated && c.evaluatedAt && dentro(diaNaOperacao(c.evaluatedAt)));

  return {
    reclamacoes: {
      novas: novas.length,
      respondidas: novas.filter((c) => respondida(c)).length,
      semResposta: novas.filter((c) => !respondida(c)).length,
      avaliadas: avaliadas.length,
      resolvidas: avaliadas.filter((c) => c.resolved).length,
      voltaria: avaliadas.filter((c) => c.wouldDoBusiness).length,
      notaMedia: media(avaliadas),
    },
    movimento: {
      respostas: casos.filter((c) => respondida(c) && c.publicResponseAt && dentro(diaNaOperacao(c.publicResponseAt))).length,
      avaliacoes: avaliacoesNoPeriodo.length,
      notaMedia: media(avaliacoesNoPeriodo),
    },
  };
}

export type NumeroDoCiclo = "novas" | "respondidas" | "semResposta" | "avaliadas" | "resolvidas" | "voltaria" | "respostas" | "avaliacoes";

/** Os casos atrás de cada número — o que a mini janela mostra ao clicar. */
export function casosDoNumero(casos: Case[], inicio: string, fim: string, qual: NumeroDoCiclo): Case[] {
  const dentro = (d?: string | null) => Boolean(d) && diaNaOperacao(d!) >= inicio && diaNaOperacao(d!) <= fim;
  const novas = casos.filter((c) => dentro(c.createdAt));
  switch (qual) {
    case "novas":
      return novas;
    case "respondidas":
      return novas.filter((c) => respondida(c));
    case "semResposta":
      return novas.filter((c) => !respondida(c));
    case "avaliadas":
      return novas.filter((c) => c.evaluated);
    case "resolvidas":
      return novas.filter((c) => c.evaluated && c.resolved);
    case "voltaria":
      return novas.filter((c) => c.evaluated && c.wouldDoBusiness);
    case "respostas":
      return casos.filter((c) => respondida(c) && dentro(c.publicResponseAt));
    case "avaliacoes":
      return casos.filter((c) => c.evaluated && dentro(c.evaluatedAt));
  }
}

export function numerosPorCiclo(casos: Case[], hoje: string, n = 8): NumerosDoCiclo[] {
  return ciclosAte(hoje, n).map((ciclo) => ({ ciclo, ...numerosDoPeriodo(casos, ciclo.inicio, ciclo.fim) }));
}

/**
 * Os ciclos agrupados por mês, do mais novo ao mais antigo, com o total de
 * cada mês: o mês corrente até hoje e os `meses - 1` anteriores inteiros.
 */
export function porCicloNoMes(casos: Case[], hoje: string, meses = 3): NumerosDoMesPorCiclo[] {
  const [ano, mes] = hoje.split("-").map(Number);
  const primeiro = new Date(Date.UTC(ano, mes - meses, 1)).toISOString().slice(0, 7);
  /* Cinco ciclos por mês no máximo; sobra e corta pelo mês. */
  const ciclos = ciclosAte(hoje, meses * 5 + 1).filter((c) => c.inicio.slice(0, 7) >= primeiro);
  const porMes = new Map<string, Ciclo[]>();
  for (const c of ciclos) porMes.set(c.inicio.slice(0, 7), [...(porMes.get(c.inicio.slice(0, 7)) ?? []), c]);

  return [...porMes.entries()].map(([m, doMes]) => {
    const fimDoMes = doMes[0].fim;
    return {
      mes: m,
      ...numerosDoPeriodo(casos, `${m}-01`, fimDoMes < hoje ? fimDoMes : hoje),
      ciclos: doMes.map((ciclo) => ({ ciclo, ...numerosDoPeriodo(casos, ciclo.inicio, ciclo.fim) })),
    };
  });
}
