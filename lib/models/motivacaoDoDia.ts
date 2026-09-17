import type { Case } from "@/lib/models/case";
import type { NpsResponseView } from "@/lib/models/nps";

import {
  diaNaOperacao,
  emptySimulation,
  getRange,
  getRawCounts,
  hasRA1000,
  inRange,
  pendingAnswers,
  scoreFrom,
  simulate,
} from "@/lib/services/reputation.service";

import { filaDeAvaliacao } from "@/lib/models/cadencia";

/**
 * O que faz a tela pagar o tempo gasto nela (roadmap, "Para dar vontade
 * de usar").
 *
 * O Isaac: relaxa quando a ferramenta não devolve nada. Então o Meu dia
 * passa a dizer duas coisas que só uma conta sabe:
 *
 * 1. **o que cada ação move na nota** — "responder as 3 sem resposta
 *    leva o índice de resposta de 91,6% a 94%, e a nota de 8,7 a 8,8";
 * 2. **o que já deu certo hoje** — a avaliação positiva que chegou, o
 *    detrator que voltou satisfeito, o selo mantido, o dia sem prazo
 *    estourado.
 *
 * **Nenhuma conta nova.** A nota sai de `scoreFrom` e `simulate`, as
 * mesmas da calculadora e da fila de avaliação; a janela é a vigente de
 * seis meses, a que o portal mostra. Uma projeção que discorda da
 * calculadora ensina a desconfiar das duas.
 */

export interface AcaoQueMoveANota {
  chave: "responder" | "pedir-avaliacao";
  quantidade: number;
  titulo: string;
  /** "índice de resposta 91,6% → 94%". */
  efeito: string;
  notaAntes: number;
  notaDepois: number;
  href: string;
}

const um = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function oQueMoveANota(casos: Case[], agora = new Date()): AcaoQueMoveANota[] {

  const janela = getRange("6m", "vigente");
  const doPeriodo = casos.filter((c) => c.source === "Reclame Aqui" && inRange(c, janela.start, janela.end));

  if (doPeriodo.length === 0) return [];

  const base = getRawCounts(doPeriodo);
  const atual = scoreFrom(base);

  if (atual.scoreUnavailable) return [];

  const acoes: AcaoQueMoveANota[] = [];

  /* ---------- responder o que está sem resposta ---------- */

  const semResposta = pendingAnswers(base);

  if (semResposta > 0) {
    const depois = scoreFrom(simulate(base, { ...emptySimulation, answerPending: semResposta }));

    acoes.push({
      chave: "responder",
      quantidade: semResposta,
      titulo: `Responder as ${semResposta} sem resposta pública`,
      efeito: `índice de resposta ${um(atual.responseIndex)}% → ${um(depois.responseIndex)}%`,
      notaAntes: atual.raScore,
      notaDepois: depois.raScore,
      href: "/reclame-aqui?situacao=sem-resposta",
    });
  }

  /* ---------- pedir a avaliação de quem está na vez ---------- */

  /*
    A fila é a de **todas** as reclamações do Reclame Aqui — o mesmo número
    da tela Pedir avaliação e do aviso ao lado. Para a nota, só contam as
    da janela vigente: avaliação de reclamação fora dela não entra na
    conta que o portal publica. É a mesma leitura da fila de avaliação.
  */
  const fila = filaDeAvaliacao(casos.filter((c) => c.source === "Reclame Aqui"), agora);
  const naVez = fila.hoje.length;
  const naVezNaJanela = fila.hoje.filter((x) => inRange(x.item, janela.start, janela.end)).length;

  if (naVez > 0) {
    /*
      "Se avaliarem com 10", e a tela diz isso: é o teto do que o pedido
      pode render, não uma promessa. É a mesma leitura da fila de
      avaliação, para os dois números baterem.
    */
    const depois = scoreFrom(simulate(base, { ...emptySimulation, ratings: { 10: naVezNaJanela } }));

    acoes.push({
      chave: "pedir-avaliacao",
      quantidade: naVez,
      titulo: `Pedir avaliação às ${naVez} da vez`,
      efeito: "se avaliarem com 10",
      notaAntes: atual.raScore,
      notaDepois: depois.raScore,
      href: "/reclame-aqui/avaliacoes",
    });
  }

  return acoes;
}

export interface ConquistaDoDia {
  chave: "avaliacao-positiva" | "detrator-revertido" | "selo-mantido" | "sem-prazo-estourado";
  titulo: string;
  detalhe: string;
  href?: string;
}

/**
 * O que já deu certo hoje — só o que o banco confirma.
 *
 * Nada de medalha por clicar: cada conquista é um fato do dia de
 * Brasília, com o link para ver de onde veio.
 */
export function conquistasDoDia(entrada: {
  casos: Case[];
  nps: NpsResponseView[];
  prazosEstourados: number;
  agora?: Date;
}): ConquistaDoDia[] {

  const agora = entrada.agora ?? new Date();
  const hoje = diaNaOperacao(agora);
  const conquistas: ConquistaDoDia[] = [];

  /* Avaliação positiva que chegou hoje no Reclame Aqui. */
  const positivas = entrada.casos.filter(
    (c) =>
      c.evaluated &&
      c.evaluatedAt &&
      diaNaOperacao(c.evaluatedAt) === hoje &&
      (c.resolved || (c.score ?? 0) >= 9)
  );

  if (positivas.length > 0) {
    conquistas.push({
      chave: "avaliacao-positiva",
      titulo: positivas.length === 1 ? "Avaliação positiva hoje" : `${positivas.length} avaliações positivas hoje`,
      detalhe: positivas
        .slice(0, 2)
        .map((c) => `${c.protocol}${c.score != null ? ` · nota ${c.score}` : ""}`)
        .join(" · "),
      href: "/reclame-aqui",
    });
  }

  /* Detrator que, depois do contato de hoje, ficou resolvido ou satisfeito. */
  const revertidos = entrada.nps.filter(
    (r) =>
      r.score <= 6 &&
      r.postContactAt &&
      diaNaOperacao(r.postContactAt) === hoje &&
      (r.resolvedAfter === true || (r.moodAfter ?? 0) >= 4)
  );

  if (revertidos.length > 0) {
    conquistas.push({
      chave: "detrator-revertido",
      titulo: revertidos.length === 1 ? "Detrator revertido" : `${revertidos.length} detratores revertidos`,
      detalhe: "voltaram satisfeitos depois do contato de hoje",
      href: `/nps/${revertidos[0].id}`,
    });
  }

  /* O selo RA1000 na janela que o portal mostra agora. */
  const janela = getRange("6m", "vigente");
  const doPeriodo = entrada.casos.filter((c) => c.source === "Reclame Aqui" && inRange(c, janela.start, janela.end));

  if (doPeriodo.length > 0) {
    const reputacao = scoreFrom(getRawCounts(doPeriodo));
    if (hasRA1000(reputacao)) {
      conquistas.push({
        chave: "selo-mantido",
        titulo: "Selo RA1000 mantido",
        detalhe: `nota ${um(reputacao.raScore)} na janela vigente`,
        href: "/relatorio",
      });
    }
  }

  if (entrada.prazosEstourados === 0) {
    conquistas.push({
      chave: "sem-prazo-estourado",
      titulo: "Nenhum prazo estourado",
      detalhe: "casos e ciclos de NPS dentro do relógio do documento",
    });
  }

  return conquistas;
}
