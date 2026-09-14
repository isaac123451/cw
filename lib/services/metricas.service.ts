import type { PrismaClient } from "@prisma/client";

import { Case, respondida } from "@/lib/models/case";

import {
  diaNaOperacao,
  getRawCounts,
  hasRA1000,
  scoreFrom,
} from "@/lib/services/reputation.service";
import { isReclameAqui } from "@/lib/services/case.service";
import { cicloAnterior, cicloDe } from "@/lib/models/ciclo";

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
  /** Resolvidas pelo consumidor no ciclo do dia (1–7, 8–14…), até aquele dia. */
  resolvidasCiclo: number;
  /** Ciclos seguidos com o selo RA1000 na aba de 6 meses, contando o do dia. */
  ciclosComSelo: number;
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

/**
 * O que era verdade num dia, para uma reclamação.
 *
 * Uma reclamação respondida em setembro **não estava respondida** em
 * agosto. Reaproveitar o estado de hoje para medir ontem produziria um
 * histórico em que todo dia parece tão bom quanto o mais recente — e é
 * exatamente o erro que gravar por dia existe para evitar.
 */
function comoEstavaEm(caso: Case, ate: string): Case {

  /*
    `respondida()`, e não o texto da resposta.

    A carga da lista não traz o texto — traz o fato `respondida`, para
    não carregar centenas de respostas longas. Olhar o texto fazia duas
    coisas erradas ao mesmo tempo (auditoria de 13/09/2026): "respondidas
    do mês" saía sempre 0 na planilha automática, e o fato `respondida`,
    que ficava intacto no objeto, contava no índice de resposta de um dia
    passado a reclamação respondida só depois dele.
  */
  const respondeu =
    respondida(caso) &&
    Boolean(caso.publicResponseAt) &&
    dia(caso.publicResponseAt!) <= ate;

  const avaliou =
    Boolean(caso.evaluated) &&
    Boolean(caso.evaluatedAt) &&
    dia(caso.evaluatedAt!) <= ate;

  return {
    ...caso,

    respondida: respondeu,
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

/** As reclamações do Reclame Aqui como estavam num dia — só as que já existiam. */
function comoEstavamEm(cases: Case[], data: string) {
  return cases
    .filter((c) => dia(c.createdAt) <= data)
    .map((c) => comoEstavaEm(c, data));
}

/**
 * A janela de uma aba do portal num dia, em meses fechados.
 *
 * O Reclame Aqui apura sobre meses completos (ver `getRange`, conferido
 * contra o HugMe): num dia de setembro, a aba vigente de 6 meses é março
 * a agosto; a **próxima**, que vira vigente no dia 1º, é abril a
 * setembro — e é nela que o que se faz hoje conta. O histórico diário
 * usava seis meses "rolando até o dia", que não é aba nenhuma do portal
 * (Fase 5, 13/09/2026).
 */
export function janelaDaAba(data: string, meses: 6 | 12, modo: "vigente" | "proximo" = "vigente") {
  const [ano, mes] = data.split("-").map(Number);
  const fimOffset = modo === "vigente" ? -1 : 0;
  const inicio = new Date(Date.UTC(ano, mes - 1 + fimOffset - meses + 1, 1)).toISOString().slice(0, 10);
  const fim = new Date(Date.UTC(ano, mes + fimOffset, 0)).toISOString().slice(0, 10);
  return { inicio, fim };
}

/** O resumo da aba vigente de seis meses, como estava num dia. */
function resumoDaJanela(existiam: Case[], data: string) {
  const { inicio, fim } = janelaDaAba(data, 6);
  return scoreFrom(
    getRawCounts(existiam.filter((c) => dia(c.createdAt) >= inicio && dia(c.createdAt) <= fim))
  );
}

/**
 * Uma aba do portal (6 ou 12 meses, vigente ou próxima) como estava num
 * dia — só Reclame Aqui, com o que já tinha sido respondido e avaliado
 * até ali. É o que o relatório do ciclo lê.
 */
export function abaEm(cases: Case[], data: string, meses: 6 | 12, modo: "vigente" | "proximo" = "vigente") {
  const existiam = comoEstavamEm(cases.filter(isReclameAqui), data);
  const janela = janelaDaAba(data, meses, modo);
  const casos = existiam.filter((c) => dia(c.createdAt) >= janela.inicio && dia(c.createdAt) <= janela.fim);
  const raw = getRawCounts(casos);
  return { casos, raw, resumo: scoreFrom(raw), janela };
}

/**
 * Quantos ciclos seguidos com o selo RA1000, contando o do dia.
 *
 * "Ciclos com o selo ativo: número acumulado de ciclos que mantemos o
 * selo" — mantemos, então a conta para no primeiro ciclo sem selo. Cada
 * ciclo anterior é julgado pelo seu último dia, na aba de seis meses (a
 * mesma da nota da planilha). `selos` guarda o que já foi medido: o
 * histórico inteiro mede cada fim de ciclo uma vez só.
 */
function ciclosSeguidosComSelo(ra: Case[], data: string, selos: Map<string, boolean>) {
  const seloEm = (d: string) => {
    const guardado = selos.get(d);
    if (guardado !== undefined) return guardado;
    const tem = hasRA1000(resumoDaJanela(comoEstavamEm(ra, d), d));
    selos.set(d, tem);
    return tem;
  };

  if (!seloEm(data)) return 0;

  const primeira = ra.reduce((min, c) => (dia(c.createdAt) < min ? dia(c.createdAt) : min), data);
  let seguidos = 1;
  let c = cicloAnterior(cicloDe(data));
  while (c.fim >= primeira && seguidos < 500 && seloEm(c.fim)) {
    seguidos += 1;
    c = cicloAnterior(c);
  }
  return seguidos;
}

/**
 * Mede um dia a partir da base.
 *
 * `cases` pode vir com a base inteira: aqui entram só as do Reclame
 * Aqui. Os atendimentos das redes sociais chegavam junto — três casos,
 * dois deles de teste — e entravam na nota, no tempo e nas entrantes do
 * mês como se fossem reclamações (achado na Fase 5, 13/09/2026).
 *
 * `selos` é opcional: quem mede muitos dias seguidos passa o mesmo mapa,
 * e cada fim de ciclo é julgado uma vez só.
 */
export function medirDia(
  cases: Case[],
  impactos: {
    date: Date;
    wouldHaveChurned: boolean | null;
  }[],
  data: string,
  selos: Map<string, boolean> = new Map()
): MetricasDoDia {

  const ra = cases.filter(isReclameAqui);

  /* Só o que já existia naquele dia. */
  const existiam = comoEstavamEm(ra, data);

  /* ---- as do mês corrente, que é como a planilha conta ---- */

  const doMes = existiam.filter(
    (c) => dia(c.createdAt) >= inicioDoMes(data)
  );

  const respondidas = doMes.filter((c) => respondida(c)).length;

  /* ---- a nota, na aba vigente de seis meses naquele dia ---- */

  const s = resumoDaJanela(existiam, data);

  /* ---- resolvidas no ciclo: avaliadas como resolvidas entre o início do ciclo e o dia ---- */

  const ciclo = cicloDe(data);
  const resolvidasCiclo = existiam.filter(
    (c) =>
      c.evaluated &&
      c.resolved &&
      Boolean(c.evaluatedAt) &&
      dia(c.evaluatedAt!) >= ciclo.inicio &&
      dia(c.evaluatedAt!) <= data
  ).length;

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

    resolvidasCiclo,
    ciclosComSelo: ciclosSeguidosComSelo(ra, data, selos),

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
    resolvidasCiclo: m.resolvidasCiclo,
    ciclosComSelo: m.ciclosComSelo,
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
