import type { PrismaClient } from "@prisma/client";

import { Case } from "@/lib/models/case";

import {
  diaNaOperacao,
  getRawCounts,
  scoreFrom,
} from "@/lib/services/reputation.service";

/**
 * O retrato de cada dia, gravado no dia.
 *
 * **Por que isto precisa ser gravado.** A nota do Reclame Aqui é
 * sempre calculada sobre a janela vigente de seis meses. Ela responde
 * "como estamos agora" — e não "como estávamos em 12 de agosto".
 * Perguntar hoje qual era a nota naquele dia dá resposta errada: a
 * janela andou, reclamações entraram nela e saíram dela.
 *
 * A planilha que a operação mantinha à mão resolvia isso do jeito
 * certo, anotando o número do dia no dia. Este serviço é essa planilha
 * preenchida sozinha.
 *
 * **Reconstruir o passado é possível, mas só até certo ponto.** Com
 * `publicResponseAt` e `evaluatedAt` no banco dá para perguntar "o que
 * era verdade em tal dia": quais reclamações já existiam, quais já
 * tinham resposta, quais já tinham sido avaliadas. É o que
 * `medirDia` faz, e é o que permite preencher o histórico de uma vez.
 *
 * O que **não** dá para reconstruir é o que o portal sabe e não conta:
 * visualizações da página, selo ativo, reclamações desativadas pela
 * moderação. Esses campos ficam nulos, e nulo aqui quer dizer "não
 * sei" — nunca zero. Um zero inventado num histórico vira um gráfico
 * com um buraco que parece queda.
 */

export interface MetricasDoDia {
  dia: string;

  entrantes: number;
  notaReputacao: number;
  respondidas: number;
  naoRespondidas: number;
  notaConsumidor: number;
  voltariam: number;
  resolvidasPct: number;
  tempoMedioHoras: number;
  churn: number;
  retidos: number;
}

/**
 * `AAAA-MM-DD` no fuso da operacao, nunca em UTC.
 *
 * Cortar o ISO em dez caracteres parece equivalente e nao e´: Sao Paulo
 * esta tres horas atras de UTC, entao tudo que acontece depois das 21h
 * cai no dia seguinte pelo corte ingenuo. Num historico diario isso
 * desloca a reclamacao um dia inteiro — e foi o que fez a reconstrucao
 * discordar da planilha da operacao a partir do dia 5.
 */
function dia(valor: string | Date) {
  return diaNaOperacao(valor);
}

/** O primeiro dia do mês a que a data pertence. */
function inicioDoMes(data: string) {
  return `${data.slice(0, 7)}-01`;
}

/** A data de N meses antes, no mesmo dia. */
function mesesAntes(data: string, meses: number) {

  const d = new Date(`${data}T00:00:00Z`);

  d.setUTCMonth(d.getUTCMonth() - meses);

  return d.toISOString().slice(0, 10);
}

/**
 * O que era verdade num dia, para uma reclamação.
 *
 * Uma reclamação respondida em setembro **não estava respondida** em
 * agosto. Reaproveitar o estado de hoje para medir ontem produziria um
 * histórico em que todo dia parece tão bom quanto o mais recente — e é
 * exatamente o erro que gravar por dia existe para evitar.
 */
function comoEstavaEm(caso: Case, ate: string): Case {

  const respondeu =
    Boolean(caso.publicResponse?.trim()) &&
    Boolean(caso.publicResponseAt) &&
    dia(caso.publicResponseAt!) <= ate;

  const avaliou =
    Boolean(caso.evaluated) &&
    Boolean(caso.evaluatedAt) &&
    dia(caso.evaluatedAt!) <= ate;

  return {
    ...caso,

    publicResponse: respondeu
      ? caso.publicResponse
      : "",

    evaluated: avaliou,

    /* Sem avaliação naquele dia, o que dela derivava também não valia. */
    score: avaliou ? caso.score : undefined,
    resolved: avaliou ? caso.resolved : false,
    wouldDoBusiness: avaliou
      ? caso.wouldDoBusiness
      : false,
  };
}

/**
 * Mede um dia a partir da base.
 *
 * `cases` são **todas** as reclamações; o recorte acontece aqui, para
 * a mesma leitura servir a trezentos dias sem trezentas consultas.
 */
export function medirDia(
  cases: Case[],
  impactos: {
    date: Date;
    wouldHaveChurned: boolean | null;
  }[],
  data: string
): MetricasDoDia {

  /* Só o que já existia naquele dia. */
  const existiam = cases
    .filter((c) => dia(c.createdAt) <= data)
    .map((c) => comoEstavaEm(c, data));

  /* ---- as do mês corrente, que é como a planilha conta ---- */

  const doMes = existiam.filter(
    (c) => dia(c.createdAt) >= inicioDoMes(data)
  );

  const respondidas = doMes.filter((c) =>
    Boolean(c.publicResponse?.trim())
  ).length;

  /* ---- a nota, na janela de seis meses que terminava ali ---- */

  const desde = mesesAntes(data, 6);

  const naJanela = existiam.filter(
    (c) =>
      dia(c.createdAt) >= desde &&
      dia(c.createdAt) <= data
  );

  const s = scoreFrom(getRawCounts(naJanela));

  /* ---- impacto: churn e retenção até aquele dia ---- */

  const impactosAte = impactos.filter(
    (i) => dia(i.date) <= data
  );

  return {
    dia: data,

    entrantes: doMes.length,
    respondidas,
    naoRespondidas: doMes.length - respondidas,

    notaReputacao: s.raScore,
    notaConsumidor: s.consumerScore,
    voltariam: s.wouldReturnIndex,
    resolvidasPct: s.solutionIndex,

    /*
      Em horas, e não no texto "16,16" da planilha.

      Guardar número deixa somar, comparar e desenhar gráfico; o texto
      obriga a reinterpretar depois, e é onde a vírgula decimal vira
      milhar em alguma tela.
    */
    tempoMedioHoras:
      Math.round((s.responseMinutes / 60) * 100) / 100,

    churn: existiam.filter((c) => c.churnRisk).length,

    retidos: impactosAte.filter(
      (i) => i.wouldHaveChurned === true
    ).length,
  };
}

/** Todos os dias de um intervalo, inclusive as pontas. */
export function diasEntre(de: string, ate: string) {

  const saida: string[] = [];

  const atual = new Date(`${de}T00:00:00Z`);
  const fim = new Date(`${ate}T00:00:00Z`);

  while (atual <= fim) {
    saida.push(atual.toISOString().slice(0, 10));
    atual.setUTCDate(atual.getUTCDate() + 1);
  }

  return saida;
}

/**
 * Grava — ou regrava — o dia.
 *
 * Regravar é seguro por construção: os campos automáticos são
 * recalculados e os manuais ficam intocados. Quem preencheu
 * visualizações do RA à mão não perde o número porque a rotina rodou
 * de novo.
 */
export async function gravarDia(
  prisma: PrismaClient,
  m: MetricasDoDia
) {

  const automaticos = {
    entrantes: m.entrantes,
    notaReputacao: m.notaReputacao,
    respondidas: m.respondidas,
    naoRespondidas: m.naoRespondidas,
    notaConsumidor: m.notaConsumidor,
    voltariam: m.voltariam,
    resolvidasPct: m.resolvidasPct,
    tempoMedioHoras: m.tempoMedioHoras,
    churn: m.churn,
    retidos: m.retidos,
    medidoEm: new Date(),
  };

  await prisma.metricaDiaria.upsert({
    where: { dia: m.dia },
    update: automaticos,
    create: { dia: m.dia, ...automaticos },
  });
}
