import { respondida, type Case } from "@/lib/models/case";
import { cicloPorId, type Ciclo } from "@/lib/models/ciclo";
import { comoEstavaNoDia } from "@/lib/models/indiceRA";
import { mesDe, preverReclamacoes, primeiroDia, somarMeses, ultimoDia, type MesISO, type PrevisaoDeReclamacoes } from "@/lib/models/previsaoDeReclamacoes";
import { diaNaOperacao, RA1000_TARGETS, scoreFrom, type ReputationRaw, type ReputationSummary } from "@/lib/services/reputation.service";

/**
 * O plano de ação do Reclame Aqui (1.133).
 *
 * O pedido, de 05/10/2026: "adicionar as métricas que quero alcançar — o
 * número ou até mesmo a nota de reputação", "prever … a quantidade de
 * reclamações", "o que preciso fazer não somente no mês, mas para os
 * próximos", "margens que temos de levar como não resolvidas", "verificar
 * metas por ciclo". E: "seja muito analítico".
 *
 * **A meta de um mês é a da janela que fecha nele.** A nota que o portal
 * mostra em novembro é a de maio a outubro; a meta de outubro é essa
 * janela, no fim de outubro — a mesma "prévia" da tela Índice.
 *
 * Três contas, nesta ordem:
 *
 * 1. **Se continuar como está.** A janela no fim do mês, com o que já
 *    existe mais o que deve acontecer até lá, no ritmo dos últimos meses:
 *    as reclamações previstas, a chance de cada uma em aberto ser
 *    respondida e avaliada até o fim do mês (pela idade dela — uma
 *    reclamação de 3 dias tem muito mais chance de ser avaliada amanhã que
 *    uma de 3 meses), e a nota, a solução e o voltaria das avaliações
 *    recentes.
 * 2. **O que a meta exige.** Cada métrica vira número de coisas: respostas
 *    a fazer, avaliações a conseguir, quantas podem vir não resolvidas ou
 *    sem "voltaria", a nota mínima das novas. A nota de reputação, que é
 *    combinação, vira o que falta além das métricas — e quanto vale, em
 *    nota, cada resposta e cada avaliação.
 * 3. **O ciclo.** O plano do mês repartido pelos ciclos (1–7, 8–14, 15–21,
 *    22–28, 29–fim) pelo número de dias, contra o que de fato aconteceu em
 *    cada um. Para o mês corrente, as metas do ciclo saem do plano como ele
 *    era no primeiro dia — meta que muda todo dia não se verifica.
 *
 * A projeção é testada contra os meses que já passaram (`testarProjecao`):
 * o plano como estaria no 1º dia de cada mês, contra a nota do fim dele.
 */

export interface MetaDoMes {
  mes: MesISO;
  nota?: number | null;
  resposta?: number | null;
  consumidor?: number | null;
  solucao?: number | null;
  voltaria?: number | null;
  avaliacoes?: number | null;
  recebidasPrevistas?: number | null;
  observacao?: string | null;
}

export type ChaveDaMeta = "nota" | "resposta" | "consumidor" | "solucao" | "voltaria" | "avaliacoes";

export const ROTULO_DA_META: Record<ChaveDaMeta, string> = {
  nota: "Nota de reputação",
  resposta: "Respondidas",
  consumidor: "Nota do consumidor",
  solucao: "Solução",
  voltaria: "Voltaria",
  avaliacoes: "Avaliações",
};

export function temMeta(m: MetaDoMes | undefined): boolean {
  return Boolean(m && (["nota", "resposta", "consumidor", "solucao", "voltaria", "avaliacoes"] as const).some((k) => m[k] != null));
}

/* ============================================================
   DIAS
============================================================ */

const DIA = 86_400_000;
const dias = (de: string, ate: string) => Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / DIA);
const somarDias = (dia: string, n: number) => new Date(Date.parse(`${dia}T00:00:00Z`) + n * DIA).toISOString().slice(0, 10);

export function janelaDoMes(mes: MesISO) {
  return { inicio: primeiroDia(somarMeses(mes, -5)), fim: ultimoDia(mes) };
}

/* ============================================================
   1. PREMISSAS — o ritmo dos últimos meses
============================================================ */

export const MAX_DIAS = 400;

export interface Premissas {
  /** Parte das reclamações avaliadas até d dias depois de abertas (índice = d). */
  avaliadaAte: number[];
  /** Parte das reclamações respondidas até d dias depois de abertas. */
  respondidaAte: number[];
  /** Das avaliações dos últimos 6 meses: nota média, e as partes resolvidas e com "voltaria" (0–1). */
  notaDasNovas: number;
  solucaoDasNovas: number;
  voltariaDasNovas: number;
  avaliacoesNaAmostra: number;
  reclamacoesNaAmostra: number;
}

/**
 * Parte com o evento até d dias, só entre as reclamações que já tiveram d
 * dias para isso (as recentes ficam fora das contas longas, senão puxariam
 * para baixo só por serem recentes). Nunca diminui com d.
 */
function curva(casos: Case[], hoje: string, quando: (c: Case) => string | null): number[] {
  const itens = casos.map((c) => {
    const ev = quando(c);
    return { idade: dias(c.createdAt, hoje), atraso: ev ? Math.max(0, dias(c.createdAt, ev)) : Infinity };
  });
  const saida: number[] = [];
  let anterior = 0;
  for (let d = 0; d <= MAX_DIAS; d++) {
    const base = itens.filter((i) => i.idade >= d);
    let v = anterior;
    if (base.length >= 10) v = Math.max(anterior, base.filter((i) => i.atraso <= d).length / base.length);
    saida.push(v);
    anterior = v;
  }
  return saida;
}

const noIndice = (curva: number[], d: number) => curva[Math.max(0, Math.min(MAX_DIAS, Math.round(d)))];

/** Quantos dias para trás entram nas curvas e na qualidade das avaliações. */
export interface JanelasDasPremissas {
  curvas: number;
  qualidade: number;
}

export const JANELAS_PADRAO: JanelasDasPremissas = { curvas: 365, qualidade: 182 };

export function calcularPremissas(casos: Case[], hoje: string, janelas: JanelasDasPremissas = JANELAS_PADRAO): Premissas {
  const umAno = somarDias(hoje, -janelas.curvas);
  const amostra = casos.filter((c) => c.createdAt >= umAno && c.createdAt <= hoje);
  const seisMeses = somarDias(hoje, -janelas.qualidade);
  const avaliacoes = casos.filter((c) => c.evaluated && !c.scoreDisregarded && typeof c.score === "number" && c.evaluatedAt && diaNaOperacao(c.evaluatedAt) >= seisMeses && diaNaOperacao(c.evaluatedAt) <= hoje);
  const n = avaliacoes.length;
  return {
    avaliadaAte: curva(amostra, hoje, (c) => (c.evaluated && c.evaluatedAt ? diaNaOperacao(c.evaluatedAt) : null)),
    respondidaAte: curva(amostra, hoje, (c) => (respondida(c) ? (c.publicResponseAt ? diaNaOperacao(c.publicResponseAt) : c.createdAt) : null)),
    notaDasNovas: n ? avaliacoes.reduce((s, c) => s + (c.score ?? 0), 0) / n : 7,
    solucaoDasNovas: n ? avaliacoes.filter((c) => c.resolved).length / n : 0.8,
    voltariaDasNovas: n ? avaliacoes.filter((c) => c.wouldDoBusiness).length / n : 0.7,
    avaliacoesNaAmostra: n,
    reclamacoesNaAmostra: amostra.length,
  };
}

/** A chance de acontecer entre a idade `de` e a idade `ate`, para quem ainda não aconteceu na idade `de`. */
function chanceCondicional(c: number[], de: number, ate: number) {
  const ja = noIndice(c, de);
  if (ja >= 1) return 0;
  return Math.max(0, (noIndice(c, ate) - ja) / (1 - ja));
}

/* ============================================================
   2. A PROJEÇÃO DA JANELA NO FIM DO MÊS
============================================================ */

const VAZIO: ReputationRaw = { received: 0, answered: 0, responseMinutesSum: 0, responseSamples: 0, evaluated: 0, scoreSum: 0, resolved: 0, wouldReturn: 0 };

function contar(casos: Case[]): ReputationRaw {
  const raw = { ...VAZIO };
  for (const c of casos) {
    raw.received += 1;
    if (respondida(c)) raw.answered += 1;
    if (c.evaluated && !c.scoreDisregarded) {
      raw.evaluated += 1;
      raw.scoreSum += c.score ?? 0;
      if (c.resolved) raw.resolved += 1;
      if (c.wouldDoBusiness) raw.wouldReturn += 1;
    }
  }
  return raw;
}

export interface Projecao {
  mes: MesISO;
  janela: { inicio: string; fim: string };
  /** A janela com o que já existe hoje — sem nada projetado. */
  conhecido: ReputationRaw;
  /** Com o que deve acontecer até o fim do mês. Pode ter fração: é valor esperado. */
  raw: ReputationRaw;
  resumo: ReputationSummary;
  /** O que a projeção acrescenta. */
  novas: { reclamacoes: number; respostas: number; avaliacoes: number };
  /** Reclamações da janela respondidas e ainda sem avaliação: é delas que sai a avaliação pedida. */
  respondidasSemAvaliacao: number;
  semRespostaAgora: number;
  /** As reclamações abertas no próprio mês: as que já chegaram e o total esperado até o fim dele. */
  doMes: { chegaram: number; esperadas: number };
}

/**
 * A janela de `mes` no último dia dele, vista de `hoje` (que precisa ser
 * anterior ou igual ao fim do mês).
 */
export function projetarJanela(casos: Case[], hoje: string, mes: MesISO, previsao: PrevisaoDeReclamacoes, premissas: Premissas, ateDia?: string): Projecao {
  const janela = janelaDoMes(mes);
  /* `ateDia`: a mesma janela num dia antes do fim — o fim do mês anterior, para medir o que acontece dentro do mês. */
  const fim = ateDia ?? janela.fim;
  const conhecidos = casos.filter((c) => c.createdAt >= janela.inicio && c.createdAt <= fim && c.createdAt <= hoje);
  const conhecido = contar(conhecidos);

  /* O que já existe: a chance de cada uma em aberto ser respondida e avaliada até o fim do mês. */
  let respostas = 0;
  let avaliacoes = 0;
  for (const c of conhecidos) {
    const idade = dias(c.createdAt, hoje);
    const idadeNoFim = dias(c.createdAt, fim);
    if (!respondida(c)) respostas += chanceCondicional(premissas.respondidaAte, idade, idadeNoFim);
    if (!c.evaluated) avaliacoes += chanceCondicional(premissas.avaliadaAte, idade, idadeNoFim);
  }

  /* As que ainda vão chegar, espalhadas pelos dias que faltam de cada mês. */
  let reclamacoes = 0;
  let doProprioMes = 0;
  const mesAtual = mesDe(hoje);
  for (let m = mesAtual; m <= mesDe(fim); m = somarMeses(m, 1)) {
    if (m < mesDe(janela.inicio)) continue;
    const prev = previsao.proximos.find((p) => p.mes === m);
    if (!prev) continue;
    const de = m === mesAtual ? somarDias(hoje, 1) : primeiroDia(m);
    const ate = ultimoDia(m);
    const diasDoTrecho = dias(de, ate) + 1;
    if (diasDoTrecho <= 0) continue;
    const quantas = m === mesAtual ? Math.max(0, prev.usado - previsao.atual.ateHoje) : prev.usado;
    if (quantas <= 0) continue;
    let r = 0;
    let a = 0;
    for (let d = 0; d < diasDoTrecho; d++) {
      const abertaEm = somarDias(de, d);
      r += noIndice(premissas.respondidaAte, dias(abertaEm, fim));
      a += noIndice(premissas.avaliadaAte, dias(abertaEm, fim));
    }
    reclamacoes += quantas;
    if (m === mes) doProprioMes += quantas;
    respostas += (quantas * r) / diasDoTrecho;
    avaliacoes += (quantas * a) / diasDoTrecho;
  }

  const raw: ReputationRaw = {
    ...conhecido,
    received: conhecido.received + reclamacoes,
    answered: conhecido.answered + respostas,
    evaluated: conhecido.evaluated + avaliacoes,
    scoreSum: conhecido.scoreSum + avaliacoes * premissas.notaDasNovas,
    resolved: conhecido.resolved + avaliacoes * premissas.solucaoDasNovas,
    wouldReturn: conhecido.wouldReturn + avaliacoes * premissas.voltariaDasNovas,
  };

  return {
    mes,
    janela,
    conhecido,
    raw,
    resumo: scoreFrom(raw),
    novas: { reclamacoes, respostas, avaliacoes },
    respondidasSemAvaliacao: conhecidos.filter((c) => respondida(c) && !c.evaluated).length,
    semRespostaAgora: conhecidos.filter((c) => !respondida(c)).length,
    doMes: (() => {
      const chegaram = conhecidos.filter((c) => mesDe(c.createdAt) === mes).length;
      return { chegaram, esperadas: chegaram + doProprioMes };
    })(),
  };
}

/* ============================================================
   3. O QUE A META EXIGE
============================================================ */

/** A porcentagem como o portal arredonda: uma casa. */
const pct = (parte: number, total: number) => (total > 0 ? Math.round((parte / total) * 1000) / 10 : 0);

/** Quantas falhas cabem num total sem a porcentagem cair abaixo do alvo. */
export function falhasQueCabem(total: number, alvo: number) {
  let x = 0;
  while (x < total && pct(total - (x + 1), total) >= alvo) x += 1;
  return total > 0 && pct(total, total) >= alvo ? x : 0;
}

export interface Exigencia {
  meta: number;
  /** O que a projeção dá, se nada mudar. */
  projetado: number;
  noCaminho: boolean;
  alcancavel: boolean;
}

export interface PlanoDoMes {
  mes: MesISO;
  janela: { inicio: string; fim: string };
  meta?: MetaDoMes;
  projecao: Projecao;
  /** As contas inteiras do plano (arredondadas). */
  previstas: number;
  avaliacoesNoPlano: number;
  respostas: { aFazer: number; semRespostaAgora: number; novasPrevistas: number; podemFicarSem: number; exigencia?: Exigencia };
  avaliacoes: { previstas: number; necessarias: number; pedirDe: number; exigencia?: Exigencia };
  consumidor?: Exigencia & { notaMinimaDasNovas: number | null; avaliacoesNota10AMais: number };
  solucao?: Exigencia & { margemDeNaoResolvidas: number; jaNaoResolvidas: number; resolvidasAMais: number };
  voltaria?: Exigencia & { margemDeNaoVoltaria: number; jaNaoVoltaria: number; voltariaAMais: number };
  reputacao: {
    projetada: number;
    exigencia?: Exigencia & { comAsMetricas: number; avaliacoesPerfeitasAMais: number; respostasAMais: number };
    /** Quanto cada coisa move a nota da janela. */
    valor: { resposta: number; avaliacaoPerfeita: number; avaliacaoRuim: number };
  };
  /**
   * O que cabe ao próprio mês — a diferença entre a janela no fim dele e no
   * fim do mês anterior (no mês corrente, de hoje até o fim). É o que se
   * reparte pelos ciclos: o acumulado de hoje até março não é trabalho de
   * março.
   */
  noMes: { chegam: number; respostas: number; avaliacoes: number; naoResolvidas: number | null };
  status: "sem-meta" | "no-caminho" | "precisa-de-acao" | "fora-de-alcance";
  ciclos: CicloDoPlano[];
}

const PERFEITA = { nota: 10, resolvida: true, voltaria: true };
const RUIM = { nota: 2, resolvida: false, voltaria: false };

function comAvaliacoes(raw: ReputationRaw, n: number, a: { nota: number; resolvida: boolean; voltaria: boolean }): ReputationRaw {
  return { ...raw, evaluated: raw.evaluated + n, scoreSum: raw.scoreSum + n * a.nota, resolved: raw.resolved + (a.resolvida ? n : 0), wouldReturn: raw.wouldReturn + (a.voltaria ? n : 0) };
}

const exata = (raw: ReputationRaw) => scoreFrom(raw).raScoreExato;

/**
 * O plano de um mês: a projeção, o que cada meta exige e o ciclo.
 *
 * `inicioDoMes` é o plano como estava no primeiro dia — de onde saem as
 * metas de cada ciclo do mês corrente. Quem chama passa; aqui não se
 * reconstrói o passado (ver `planoNoInicioDoMes`).
 */
export function planoDoMes(casos: Case[], hoje: string, mes: MesISO, meta: MetaDoMes | undefined, previsao: PrevisaoDeReclamacoes, premissas: Premissas, inicioDoMes?: PlanoDoMes): PlanoDoMes {
  const projecao = projetarJanela(casos, hoje, mes, previsao, premissas);
  const k = projecao.conhecido;
  const p = projecao.resumo;

  const previstas = Math.round(projecao.raw.received);
  const novasPrevistas = previstas - k.received;

  /* Respostas: o alvo, ou os 90% do selo para dizer a margem mesmo sem meta. */
  const alvoResposta = meta?.resposta ?? RA1000_TARGETS.resposta;
  const podemFicarSem = falhasQueCabem(previstas, alvoResposta);
  const aFazer = Math.max(0, previstas - podemFicarSem - k.answered);
  const respostasNoPlano = Math.max(Math.round(projecao.raw.answered), previstas - podemFicarSem);

  /* Avaliações: as previstas pelo ritmo; a meta de quantidade puxa para cima. */
  const previstasAval = Math.round(projecao.novas.avaliacoes);
  const necessarias = meta?.avaliacoes != null ? Math.max(0, meta.avaliacoes - k.evaluated) : 0;
  const novas = Math.max(previstasAval, necessarias);
  const total = k.evaluated + novas;

  const plano: PlanoDoMes = {
    mes,
    janela: projecao.janela,
    meta,
    projecao,
    previstas,
    avaliacoesNoPlano: novas,
    respostas: {
      aFazer,
      semRespostaAgora: projecao.semRespostaAgora,
      novasPrevistas,
      podemFicarSem,
      exigencia:
        meta?.resposta != null
          ? { meta: meta.resposta, projetado: p.responseIndex, noCaminho: p.responseIndex >= meta.resposta, alcancavel: true }
          : undefined,
    },
    avaliacoes: {
      previstas: previstasAval,
      necessarias,
      pedirDe: projecao.respondidasSemAvaliacao,
      exigencia:
        meta?.avaliacoes != null
          ? { meta: meta.avaliacoes, projetado: Math.round(projecao.raw.evaluated), noCaminho: Math.round(projecao.raw.evaluated) >= meta.avaliacoes, alcancavel: true }
          : undefined,
    },
    reputacao: { projetada: p.raScoreExato, valor: { resposta: 0, avaliacaoPerfeita: 0, avaliacaoRuim: 0 } },
    noMes: { chegam: projecao.doMes.esperadas, respostas: 0, avaliacoes: 0, naoResolvidas: null },
    status: "sem-meta",
    ciclos: [],
  };

  /* Nota do consumidor: a média mínima das novas. */
  if (meta?.consumidor != null) {
    const alvo = meta.consumidor;
    let minima: number | null = novas > 0 ? (alvo * total - k.scoreSum) / novas : null;
    let aMais = 0;
    /* Sem avaliação nova prevista, ou nem com todas nota 10: quantas nota 10 a mais. */
    const media = (extra: number) => (total + extra > 0 ? (k.scoreSum + 10 * (novas + extra)) / (total + extra) : 0);
    if ((minima !== null && minima > 10) || (novas === 0 && (total === 0 || k.scoreSum / total < alvo))) {
      while (aMais < 500 && media(aMais) < alvo) aMais += 1;
      if (minima !== null) minima = 10;
    }
    plano.consumidor = {
      meta: alvo,
      projetado: p.consumerScore,
      noCaminho: p.consumerScore >= alvo,
      alcancavel: aMais < 500,
      notaMinimaDasNovas: minima === null ? null : Math.max(0, Math.ceil(minima * 10) / 10),
      avaliacoesNota10AMais: aMais,
    };
  }

  /* Solução e voltaria: quantas das novas podem vir "não". */
  const margem = (alvo: number, sim: number) => {
    const naoJa = k.evaluated - sim;
    let margemNova = falhasQueCabem(total, alvo) - naoJa;
    let aMais = 0;
    if (margemNova < 0) {
      while (aMais < 500 && falhasQueCabem(total + aMais, alvo) < naoJa) aMais += 1;
      margemNova = 0;
    }
    return { margemNova: Math.min(margemNova, novas), naoJa, aMais };
  };
  if (meta?.solucao != null) {
    const m = margem(meta.solucao, k.resolved);
    plano.solucao = { meta: meta.solucao, projetado: p.solutionIndex, noCaminho: p.solutionIndex >= meta.solucao, alcancavel: m.aMais < 500, margemDeNaoResolvidas: m.margemNova, jaNaoResolvidas: m.naoJa, resolvidasAMais: m.aMais };
  }
  if (meta?.voltaria != null) {
    const m = margem(meta.voltaria, k.wouldReturn);
    plano.voltaria = { meta: meta.voltaria, projetado: p.wouldReturnIndex, noCaminho: p.wouldReturnIndex >= meta.voltaria, alcancavel: m.aMais < 500, margemDeNaoVoltaria: m.margemNova, jaNaoVoltaria: m.naoJa, voltariaAMais: m.aMais };
  }

  /*
    A janela "cumprindo as metas": respostas no alvo, as novas avaliações
    com a qualidade mínima de cada métrica (ou a de costume, se for maior).
  */
  const qual = {
    nota: Math.max(premissas.notaDasNovas, plano.consumidor?.notaMinimaDasNovas ?? 0),
    resolvidas: Math.max(premissas.solucaoDasNovas * novas, plano.solucao ? novas - plano.solucao.margemDeNaoResolvidas : 0),
    voltaria: Math.max(premissas.voltariaDasNovas * novas, plano.voltaria ? novas - plano.voltaria.margemDeNaoVoltaria : 0),
  };
  const comMetas: ReputationRaw = {
    ...k,
    received: previstas,
    answered: respostasNoPlano,
    evaluated: total,
    scoreSum: k.scoreSum + qual.nota * novas,
    resolved: k.resolved + qual.resolvidas,
    wouldReturn: k.wouldReturn + qual.voltaria,
  };
  const base = exata(comMetas);
  plano.reputacao.valor = {
    resposta: comMetas.answered < comMetas.received ? exata({ ...comMetas, answered: comMetas.answered + 1 }) - base : 0,
    avaliacaoPerfeita: exata(comAvaliacoes(comMetas, 1, PERFEITA)) - base,
    avaliacaoRuim: exata(comAvaliacoes(comMetas, 1, RUIM)) - base,
  };

  if (meta?.nota != null) {
    const alvo = meta.nota;
    /* Primeiro as respostas que ainda cabem; depois avaliações perfeitas, até o que existe para avaliar. */
    let raw = comMetas;
    let respostasAMais = 0;
    while (exata(raw) < alvo && raw.answered < raw.received) {
      raw = { ...raw, answered: raw.answered + 1 };
      respostasAMais += 1;
    }
    const pool = Math.max(0, Math.floor(raw.answered - raw.evaluated));
    let perfeitas = 0;
    while (exata(raw) < alvo && perfeitas < pool) {
      raw = comAvaliacoes(raw, 1, PERFEITA);
      perfeitas += 1;
    }
    plano.reputacao.exigencia = {
      meta: alvo,
      projetado: p.raScoreExato,
      noCaminho: p.raScoreExato >= alvo,
      alcancavel: exata(raw) >= alvo,
      comAsMetricas: base,
      avaliacoesPerfeitasAMais: perfeitas,
      respostasAMais,
    };
  }

  /* O que cabe ao mês: o projetado entre o fim do mês anterior (ou hoje) e o fim dele, mais o que a meta pede além. */
  const antes = mes > mesDe(hoje) ? projetarJanela(casos, hoje, mes, previsao, premissas, ultimoDia(somarMeses(mes, -1))).raw : k;
  const avaliacoesNoMes = Math.max(0, projecao.raw.evaluated - antes.evaluated + Math.max(0, novas - projecao.novas.avaliacoes));
  plano.noMes = {
    chegam: projecao.doMes.esperadas,
    respostas: Math.max(0, Math.round(projecao.raw.answered - antes.answered + Math.max(0, respostasNoPlano - projecao.raw.answered))),
    avaliacoes: Math.round(avaliacoesNoMes),
    naoResolvidas: plano.solucao ? Math.floor(plano.solucao.margemDeNaoResolvidas * (novas > 0 ? Math.min(1, avaliacoesNoMes / novas) : 0)) : null,
  };

  const exigencias = [plano.respostas.exigencia, plano.avaliacoes.exigencia, plano.consumidor, plano.solucao, plano.voltaria, plano.reputacao.exigencia].filter((e): e is Exigencia => Boolean(e));
  plano.status = exigencias.length === 0 ? "sem-meta" : exigencias.every((e) => e.noCaminho) ? "no-caminho" : exigencias.every((e) => e.alcancavel) ? "precisa-de-acao" : "fora-de-alcance";

  plano.ciclos = ciclosDoMes(casos, hoje, mes, inicioDoMes ?? plano);
  return plano;
}

/* ============================================================
   4. OS CICLOS
============================================================ */

export interface CicloDoPlano {
  ciclo: Ciclo;
  dias: number;
  quando: "passado" | "atual" | "futuro";
  meta: { recebidas: number; respostas: number; avaliacoes: number; naoResolvidas: number | null };
  feito: { recebidas: number; respostas: number; avaliacoes: number; naoResolvidas: number };
}

export function ciclosDe(mes: MesISO): Ciclo[] {
  return [1, 2, 3, 4, 5].map((n) => cicloPorId(`${mes}-c${n}`)).filter((c): c is Ciclo => c !== null);
}

/** Reparte um total pelos pesos, com inteiros que somam o total (maior resto). */
export function repartir(total: number, pesos: number[]): number[] {
  const soma = pesos.reduce((s, p) => s + p, 0);
  if (soma === 0 || total <= 0) return pesos.map(() => 0);
  const brutos = pesos.map((p) => (total * p) / soma);
  const inteiros = brutos.map(Math.floor);
  let falta = Math.round(total) - inteiros.reduce((s, x) => s + x, 0);
  const ordem = brutos.map((b, i) => ({ i, resto: b - Math.floor(b) })).sort((a, b) => b.resto - a.resto);
  for (const o of ordem) {
    if (falta <= 0) break;
    inteiros[o.i] += 1;
    falta -= 1;
  }
  return inteiros;
}

/** Os ciclos do mês: as metas saem de `base` (o plano do 1º dia, no mês corrente e nos fechados); o feito, de `casos`. */
export function ciclosDoMes(casos: Case[], hoje: string, mes: MesISO, base: PlanoDoMes): CicloDoPlano[] {
  const lista = ciclosDe(mes);
  const pesos = lista.map((c) => dias(c.inicio, c.fim) + 1);
  const recebidas = repartir(base.noMes.chegam, pesos);
  const respostas = repartir(base.noMes.respostas, pesos);
  const avaliacoes = repartir(base.noMes.avaliacoes, pesos);
  const naoResolvidas = base.noMes.naoResolvidas !== null ? repartir(base.noMes.naoResolvidas, pesos) : null;
  const dia = (iso?: string | null) => (iso ? diaNaOperacao(iso) : null);
  const no = (c: Ciclo, d: string | null) => Boolean(d) && d! >= c.inicio && d! <= c.fim;
  return lista.map((c, i) => ({
    ciclo: c,
    dias: pesos[i],
    quando: c.fim < hoje ? "passado" : c.inicio > hoje ? "futuro" : "atual",
    meta: { recebidas: recebidas[i], respostas: respostas[i], avaliacoes: avaliacoes[i], naoResolvidas: naoResolvidas ? naoResolvidas[i] : null },
    feito: {
      recebidas: casos.filter((x) => no(c, x.createdAt)).length,
      respostas: casos.filter((x) => respondida(x) && no(c, dia(x.publicResponseAt))).length,
      avaliacoes: casos.filter((x) => x.evaluated && !x.scoreDisregarded && no(c, dia(x.evaluatedAt))).length,
      naoResolvidas: casos.filter((x) => x.evaluated && !x.scoreDisregarded && !x.resolved && no(c, dia(x.evaluatedAt))).length,
    },
  }));
}

/* ============================================================
   5. O PASSADO E O PLANO NO PRIMEIRO DIA
============================================================ */

/** As reclamações como estavam no fim de `dia`: sem as que chegaram depois, sem respostas e avaliações posteriores. */
export function casosNoDia(casos: Case[], dia: string): Case[] {
  return casos.filter((c) => c.createdAt <= dia).map((c) => comoEstavaNoDia(c, dia));
}

/** O plano do mês como estaria na véspera do primeiro dia — as metas fixas de cada ciclo. */
export function planoNoInicioDoMes(casos: Case[], mes: MesISO, meta: MetaDoMes | undefined): PlanoDoMes {
  const vespera = somarDias(primeiroDia(mes), -1);
  const antes = casosNoDia(casos, vespera);
  const previsao = preverReclamacoes(antes, vespera, 7, meta?.recebidasPrevistas != null ? { [mes]: meta.recebidasPrevistas } : {});
  return planoDoMes(antes, vespera, mes, meta, previsao, calcularPremissas(antes, vespera));
}

/** Um mês que já fechou: a janela como estava no último dia, contra a meta. */
export interface ResultadoDoMes {
  mes: MesISO;
  resumo: ReputationSummary;
  meta?: MetaDoMes;
  cumpridas: { chave: ChaveDaMeta; meta: number; valor: number; ok: boolean }[];
}

export function resultadoDoMes(casos: Case[], mes: MesISO, meta?: MetaDoMes): ResultadoDoMes {
  const fim = ultimoDia(mes);
  const j = janelaDoMes(mes);
  const resumo = scoreFrom(contar(casosNoDia(casos, fim).filter((c) => c.createdAt >= j.inicio)));
  const valores: Record<ChaveDaMeta, number> = {
    nota: resumo.raScoreExato,
    resposta: resumo.responseIndex,
    consumidor: resumo.consumerScore,
    solucao: resumo.solutionIndex,
    voltaria: resumo.wouldReturnIndex,
    avaliacoes: resumo.evaluated,
  };
  const cumpridas = (Object.keys(valores) as ChaveDaMeta[])
    .filter((k) => meta?.[k] != null)
    .map((k) => ({ chave: k, meta: meta![k] as number, valor: valores[k], ok: valores[k] >= (meta![k] as number) }));
  return { mes, resumo, meta, cumpridas };
}

/* ============================================================
   6. A PROJEÇÃO CONTRA O QUE ACONTECEU
============================================================ */

export interface TesteDaProjecao {
  meses: { mes: MesISO; projetada: number; real: number }[];
  erroMedio: number | null;
}

/**
 * Para cada um dos últimos `quantos` meses fechados: a nota que a projeção
 * dava na véspera do primeiro dia, contra a nota real no último dia.
 */
export function testarProjecao(casos: Case[], hoje: string, quantos = 6): TesteDaProjecao {
  const meses: TesteDaProjecao["meses"] = [];
  for (let i = quantos; i >= 1; i--) {
    const mes = somarMeses(mesDe(hoje), -i);
    const plano = planoNoInicioDoMes(casos, mes, undefined);
    const real = resultadoDoMes(casos, mes).resumo.raScoreExato;
    meses.push({ mes, projetada: plano.projecao.resumo.raScoreExato, real });
  }
  const erros = meses.map((m) => Math.abs(m.projetada - m.real));
  return { meses, erroMedio: erros.length ? Math.round((erros.reduce((s, e) => s + e, 0) / erros.length) * 1000) / 1000 : null };
}

