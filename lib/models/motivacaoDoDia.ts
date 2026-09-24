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
  type RemovedComplaint,
} from "@/lib/services/reputation.service";
import { respondida } from "@/lib/models/case";

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
  chave: "responder" | "pedir-avaliacao" | "moderacao";
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

  /* ---------- as moderações pedidas e ainda sem decisão ---------- */

  /*
    Moderação aceita tira a reclamação da conta com tudo o que ela
    carregava — a resposta, a nota, o "resolvido" e o "voltaria" (Fase 24,
    "o que move a nota hoje"). Pedida é trabalho feito; acompanhar até o
    portal decidir é o que falta. O efeito é o teto: "se o portal aceitar".
  */
  const pendentes = doPeriodo.filter((c) => c.moderacaoPedidaEm && (!c.moderacaoResultado || c.moderacaoResultado === "pendente"));

  if (pendentes.length > 0) {
    const removidas: RemovedComplaint[] = pendentes.map((c) => ({
      id: c.id,
      answered: respondida(c),
      evaluated: Boolean(c.evaluated) && !c.scoreDisregarded,
      score: c.score ?? 0,
      resolved: c.resolved,
      wouldReturn: c.wouldDoBusiness,
    }));
    const depois = scoreFrom(simulate(base, { ...emptySimulation, removed: removidas }));

    /* Moderação de reclamação que não pesava na nota não é ação para a nota. */
    if (depois.raScore !== atual.raScore) {
      acoes.push({
        chave: "moderacao",
        quantidade: pendentes.length,
        titulo: pendentes.length === 1 ? "Acompanhar a moderação pedida" : `Acompanhar as ${pendentes.length} moderações pedidas`,
        efeito: "se o portal aceitar",
        notaAntes: atual.raScore,
        notaDepois: depois.raScore,
        href: "/meu-dia",
      });
    }
  }

  /* As três que mais mexem na nota, a maior primeiro: o placar da semana usa a primeira como "o próximo passo". */
  return acoes.sort((a, b) => b.notaDepois - b.notaAntes - (a.notaDepois - a.notaAntes)).slice(0, 3);
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

/* ============================================================
   CONQUISTAS DA SEMANA (Fase 19)
============================================================ */

export interface ConquistaDaSemana {
  chave: "avaliacoes" | "respondidas" | "nps-no-prazo" | "revertidos" | "encerrados";
  titulo: string;
  detalhe: string;
  href?: string;
}

/** Segunda-feira da semana de `hoje` (AAAA-MM-DD, dia de Brasília). */
export function inicioDaSemana(hoje: string) {
  const d = new Date(`${hoje}T12:00:00Z`);
  const diaDaSemana = (d.getUTCDay() + 6) % 7; // segunda = 0
  d.setUTCDate(d.getUTCDate() - diaDaSemana);
  return d.toISOString().slice(0, 10);
}

/**
 * O que deu certo de segunda até hoje — só fatos, e só os que existem.
 *
 * "Sem medalha por clique", do roadmap: nada de ponto por ter aberto a
 * tela. Cada linha é um fato do banco com a conta à vista. Onde a base
 * não tem prazo cadastrado (resposta do Reclame Aqui), não se inventa
 * um: vai a espera de verdade, em dias. O "no prazo" só aparece onde o
 * próprio registro guarda o prazo (o 1º contato do NPS).
 */
export function conquistasDaSemana(entrada: {
  casos: Case[];
  nps: NpsResponseView[];
  agora?: Date;
}): { desde: string; conquistas: ConquistaDaSemana[] } {

  const agora = entrada.agora ?? new Date();
  const hoje = diaNaOperacao(agora);
  const desde = inicioDaSemana(hoje);
  const naSemana = (quando?: string | null) => {
    if (!quando) return false;
    const dia = diaNaOperacao(quando);
    return dia >= desde && dia <= hoje;
  };

  const conquistas: ConquistaDaSemana[] = [];

  const avaliadas = entrada.casos.filter((c) => c.evaluated && naSemana(c.evaluatedAt));
  const positivas = avaliadas.filter((c) => c.resolved || (c.score ?? 0) >= 9);
  if (positivas.length > 0) {
    conquistas.push({
      chave: "avaliacoes",
      titulo: `${positivas.length} ${positivas.length === 1 ? "avaliação positiva" : "avaliações positivas"}`,
      detalhe: `de ${avaliadas.length} avaliada(s) no Reclame Aqui`,
      href: "/reclame-aqui",
    });
  }

  const respondidas = entrada.casos.filter((c) => c.source === "Reclame Aqui" && naSemana(c.publicResponseAt));
  if (respondidas.length > 0) {
    const esperas = respondidas
      .map((c) => (new Date(c.publicResponseAt!).getTime() - new Date(c.createdAt).getTime()) / 86_400_000)
      .filter((d) => d >= 0)
      .sort((a, b) => a - b);
    const mediana = esperas.length ? esperas[Math.floor(esperas.length / 2)] : null;
    conquistas.push({
      chave: "respondidas",
      titulo: `${respondidas.length} ${respondidas.length === 1 ? "reclamação respondida" : "reclamações respondidas"}`,
      detalhe:
        mediana === null
          ? "no Reclame Aqui"
          : `${esperas.length === 1 ? "esperou" : "espera mediana de"} ${mediana < 1 ? "menos de 1 dia" : `${Math.round(mediana)} dia(s)`} desde a publicação`,
      href: "/reclame-aqui",
    });
  }

  const contatados = entrada.nps.filter((r) => naSemana(r.firstContactAt));
  const noPrazo = contatados.filter(
    (r) => r.firstContactDueAt && new Date(r.firstContactAt!).getTime() <= new Date(r.firstContactDueAt).getTime()
  );
  if (noPrazo.length > 0) {
    conquistas.push({
      chave: "nps-no-prazo",
      titulo: `${noPrazo.length} ${noPrazo.length === 1 ? "primeiro contato do NPS no prazo" : "primeiros contatos do NPS no prazo"}`,
      detalhe: `de ${contatados.length} feito(s) na semana`,
      href: "/nps",
    });
  }

  const revertidos = entrada.nps.filter(
    (r) => r.score <= 6 && naSemana(r.postContactAt) && (r.resolvedAfter === true || (r.moodAfter ?? 0) >= 4)
  );
  if (revertidos.length > 0) {
    conquistas.push({
      chave: "revertidos",
      titulo: `${revertidos.length} ${revertidos.length === 1 ? "detrator revertido" : "detratores revertidos"}`,
      detalhe: "resolvidos ou satisfeitos depois do contato",
      href: `/nps/${revertidos[0].id}`,
    });
  }

  const encerrados = entrada.nps.filter((r) => naSemana(r.closedAt));
  if (encerrados.length > 0) {
    conquistas.push({
      chave: "encerrados",
      titulo: `${encerrados.length} ${encerrados.length === 1 ? "ciclo de NPS encerrado" : "ciclos de NPS encerrados"}`,
      detalhe: "com a tratativa registrada",
      href: "/nps",
    });
  }

  return { desde, conquistas };
}

/* ============================================================
   O PLACAR DA SEMANA (1.37)
============================================================ */

export type ChaveDoPlacar = "avaliacoes" | "respondidas" | "nps-no-prazo" | "revertidos" | "encerrados";

export interface NumerosDaJanela {
  avaliacoes: number;
  avaliadas: number;
  respondidas: number;
  npsNoPrazo: number;
  npsContatados: number;
  revertidos: number;
  encerrados: number;
}

/** Os números de uma janela de dias (AAAA-MM-DD, dia de Brasília, os dois inclusive). */
export function numerosDaJanela(entrada: { casos: Case[]; nps: NpsResponseView[]; de: string; ate: string }): NumerosDaJanela {
  const dentro = (quando?: string | null) => {
    if (!quando) return false;
    const dia = diaNaOperacao(quando);
    return dia >= entrada.de && dia <= entrada.ate;
  };
  const avaliadas = entrada.casos.filter((c) => c.evaluated && dentro(c.evaluatedAt));
  const contatados = entrada.nps.filter((r) => dentro(r.firstContactAt));
  return {
    avaliacoes: avaliadas.filter((c) => c.resolved || (c.score ?? 0) >= 9).length,
    avaliadas: avaliadas.length,
    respondidas: entrada.casos.filter((c) => c.source === "Reclame Aqui" && dentro(c.publicResponseAt)).length,
    npsNoPrazo: contatados.filter((r) => r.firstContactDueAt && new Date(r.firstContactAt!).getTime() <= new Date(r.firstContactDueAt).getTime()).length,
    npsContatados: contatados.length,
    revertidos: entrada.nps.filter((r) => r.score <= 6 && dentro(r.postContactAt) && (r.resolvedAfter === true || (r.moodAfter ?? 0) >= 4)).length,
    encerrados: entrada.nps.filter((r) => dentro(r.closedAt)).length,
  };
}

function menosDias(dia: string, dias: number) {
  return new Date(Date.parse(`${dia}T12:00:00Z`) - dias * 86_400_000).toISOString().slice(0, 10);
}

export interface PlacarDaSemana {
  desde: string;
  hoje: string;
  agora: NumerosDaJanela;
  /** A semana passada até o mesmo dia da semana — a comparação justa numa quarta. */
  antes: NumerosDaJanela;
}

/**
 * A semana contra a semana passada, até o mesmo dia.
 *
 * O Isaac: "parte de conquistas nunca vi". O cartão existia, com texto
 * corrido no canto de uma fileira de três. O placar põe os números no
 * topo, com a comparação — "3 avaliações positivas, 1 a mais que na
 * semana passada até quarta" diz se o trabalho está andando.
 */
export function placarDaSemana(entrada: { casos: Case[]; nps: NpsResponseView[]; agora?: Date }): PlacarDaSemana {
  const hoje = diaNaOperacao(entrada.agora ?? new Date());
  const desde = inicioDaSemana(hoje);
  return {
    desde,
    hoje,
    agora: numerosDaJanela({ casos: entrada.casos, nps: entrada.nps, de: desde, ate: hoje }),
    antes: numerosDaJanela({ casos: entrada.casos, nps: entrada.nps, de: menosDias(desde, 7), ate: menosDias(hoje, 7) }),
  };
}

const NOME_DO_DIA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

/** O resumo da semana para colar no Slack — só o que aconteceu, com a comparação. */
export function textoDoResumoDaSemana(p: PlacarDaSemana, extra: { sequencia?: number; nota?: string } = {}) {
  const dia = NOME_DO_DIA[new Date(`${p.hoje}T12:00:00Z`).getUTCDay()];
  const comparar = (agora: number, antes: number) => (agora === antes ? "igual à semana passada" : agora > antes ? `${agora - antes} a mais que na semana passada` : `${antes - agora} a menos que na semana passada`);
  const p2 = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
  const linhas = [
    `*Reputação — semana de ${p.desde.split("-").reverse().slice(0, 2).join("/")} até ${dia}*`,
    p.agora.avaliacoes || p.antes.avaliacoes ? `• ${p2(p.agora.avaliacoes, "avaliação positiva", "avaliações positivas")} no Reclame Aqui, de ${p2(p.agora.avaliadas, "avaliada", "avaliadas")} (${comparar(p.agora.avaliacoes, p.antes.avaliacoes)})` : null,
    p.agora.respondidas || p.antes.respondidas ? `• ${p2(p.agora.respondidas, "reclamação respondida", "reclamações respondidas")} (${comparar(p.agora.respondidas, p.antes.respondidas)})` : null,
    p.agora.npsContatados ? `• NPS: ${p.agora.npsNoPrazo} de ${p2(p.agora.npsContatados, "primeiro contato", "primeiros contatos")} no prazo` : null,
    p.agora.revertidos ? `• ${p2(p.agora.revertidos, "detrator revertido", "detratores revertidos")}` : null,
    p.agora.encerrados || p.antes.encerrados ? `• ${p2(p.agora.encerrados, "ciclo de NPS encerrado", "ciclos de NPS encerrados")} (${comparar(p.agora.encerrados, p.antes.encerrados)})` : null,
    extra.sequencia ? `• ${p2(extra.sequencia, "dia útil", "dias úteis")} seguidos com a rotina inteira` : null,
    extra.nota ? `• Nota do Reclame Aqui: ${extra.nota}` : null,
  ].filter((l): l is string => Boolean(l));
  return linhas.length > 1 ? linhas.join("\n") : `${linhas[0]}\n• Nada fechado ainda nesta semana.`;
}
