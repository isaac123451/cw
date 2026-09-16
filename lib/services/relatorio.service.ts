import type { Case } from "@/lib/models/case";
import { respondida } from "@/lib/models/case";
import { cicloAnterior, type Ciclo } from "@/lib/models/ciclo";
import { etapaDasRedes } from "@/lib/models/redes";
import { isEncerrado, type NpsResponseView } from "@/lib/models/nps";
import { indicadoresGoogle, type AvaliacaoParaIndicador } from "@/lib/models/avaliacoesGoogle";
import { isReclameAqui, isSocial } from "@/lib/services/case.service";
import type { SlaRule } from "@/lib/models/sla";
import {
  descreverIndicadorDoPrimeiroContato,
  primeiroContatoDoNps,
  primeiroContatoDosCasos,
  type IndicadorDoPrimeiroContato,
} from "@/lib/models/primeiroContato";
import { descreverMinutosUteis, EXPEDIENTE_PADRAO, type Expediente } from "@/lib/services/horasUteis";
import { abaEm, medirDia } from "@/lib/services/metricas.service";
import { indicadoresDoGuia, summarize } from "@/lib/services/nps.service";
import {
  diaNaOperacao,
  evaluationsToReach,
  formatElapsed,
  hasRA1000,
  parseElapsed,
  ptBR,
  RA1000_BAND,
  RA1000_MINIMO_DE_AVALIACOES,
  RA1000_TARGETS,
  type ReputationSummary,
} from "@/lib/services/reputation.service";

/**
 * O Relatório de Reputação do ciclo.
 *
 * O documento: "ao final de cada ciclo, o agente envia à gestão o
 * Relatório de Reputação destacando os pontos de atenção da área e as
 * metas do período. O documento consolida o acompanhamento dos
 * indicadores de NPS e Reclame Aqui, apresentando as projeções para
 * alcançar o selo RA1000."
 *
 * Tudo aqui é conta sobre a base — nenhum número digitado. Um ciclo
 * passado é lido como estava no último dia dele (o que tinha sido
 * respondido e avaliado até ali); o ciclo corrente, até hoje.
 */

export interface AbaDoRelatorio {
  meses: 6 | 12;
  /** "vigente" é a aba que o portal mostra hoje; "proximo", a que vira vigente no dia 1º. */
  modo: "vigente" | "proximo";
  janela: { inicio: string; fim: string };
  resumo: ReputationSummary;
  selo: boolean;
  /** Respostas públicas que faltam para os 90% do índice. */
  faltamRespostas: number;
  semResposta: number;
  /** Avaliações que faltam para o mínimo de 50 do selo. */
  faltamParaOMinimo: number;
  /** Avaliações nota 10, resolvidas e favoráveis, depois de responder as que faltam. */
  avaliacoesParaOSelo: { necessarias: number; alcancavel: boolean; motivo?: string };
  tempoMedianoMin: number | null;
  /** Da publicação ao 1º contato registrado, nas reclamações da aba. */
  primeiroContato: IndicadorDoPrimeiroContato;
}

export interface DadosDoRelatorio {
  ciclo: Ciclo;
  /** O último dia lido: o fim do ciclo, ou hoje, no ciclo corrente. */
  ateDia: string;
  corrente: boolean;
  ra: {
    abas: AbaDoRelatorio[];
    /** Os mesmos números no fim do ciclo anterior, para a variação. */
    anterior: { nota: number; resposta: number; solucao: number; consumidor: number; voltaria: number; selo: boolean };
    noCiclo: { entrantes: number; respondidas: number; avaliadas: number; resolvidas: number };
    abertas: { semResposta: number; maisDe7Dias: number };
    ciclosComSelo: number;
  };
  nps: {
    respostas: number;
    nps: number | null;
    promotores: number;
    detratores: number;
    percentualContatados: number | null;
    humorMedioDoDetrator: number | null;
    fechadosNoCiclo: number;
    abertosForaDoPrazo: number;
  };
  redes: { entrantes: number; resolvidos: number; abertos: number };
  google: { total: number; notaMedia: number | null; percentualRespondidas: number | null; negativas: number; negativasSemResposta: number };
  /** O tempo até o 1º contato do que chegou no ciclo, por frente — a meta do documento, medida. */
  primeiroContato: { ra: IndicadorDoPrimeiroContato; redes: IndicadorDoPrimeiroContato; nps: IndicadorDoPrimeiroContato };
  pontos: { texto: string; href?: string }[];
}

export interface GoogleDoRelatorio extends AvaliacaoParaIndicador {
  id: string;
}

const noIntervalo = (d: string | undefined, de: string, ate: string) => Boolean(d) && diaNaOperacao(d!) >= de && diaNaOperacao(d!) <= ate;

function mediana(xs: number[]) {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

interface Relogio {
  regras: SlaRule[];
  expediente: Expediente;
  agora: Date;
}

function montarAba(cases: Case[], dia: string, meses: 6 | 12, modo: "vigente" | "proximo", relogio: Relogio): AbaDoRelatorio {
  const { casos, raw, resumo, janela } = abaEm(cases, dia, meses, modo);

  const alvo = Math.ceil((RA1000_TARGETS.resposta / 100) * raw.received);
  const semResposta = Math.max(0, raw.received - raw.answered);
  const faltamRespostas = Math.min(semResposta, Math.max(0, alvo - raw.answered));

  /* Primeiro as respostas que faltam; depois, quantas avaliações ideais levam ao selo. */
  const comRespostas = { ...raw, answered: raw.answered + faltamRespostas };
  const alvoSelo = evaluationsToReach(comRespostas, RA1000_BAND, true);

  const tempos = casos.map((c) => parseElapsed(c.responseTime)).filter((m): m is number => m !== null);

  return {
    meses,
    modo,
    janela,
    resumo,
    selo: hasRA1000(resumo),
    faltamRespostas,
    semResposta,
    faltamParaOMinimo: Math.max(0, RA1000_MINIMO_DE_AVALIACOES - raw.evaluated),
    avaliacoesParaOSelo: {
      necessarias: alvoSelo.needed,
      alcancavel: alvoSelo.reachable,
      motivo:
        alvoSelo.reason === "sem-avaliacoes"
          ? "não há reclamações sem avaliação suficientes no período"
          : alvoSelo.reason === "teto-da-nota"
            ? "mesmo com tudo nota 10 a meta não fecha"
            : undefined,
    },
    tempoMedianoMin: mediana(tempos),
    primeiroContato: primeiroContatoDosCasos(casos, relogio.regras, { de: janela.inicio, ate: janela.fim }, relogio.agora, relogio.expediente),
  };
}

export function montarRelatorio(entrada: {
  cases: Case[];
  nps: NpsResponseView[];
  google: GoogleDoRelatorio[];
  ciclo: Ciclo;
  hoje: string;
  /** As regras de prazo e o expediente: sem eles, o 1º contato sai sem "no prazo". */
  regras?: SlaRule[];
  expediente?: Expediente;
  agora?: Date;
}): DadosDoRelatorio {

  const { cases, nps, google, ciclo, hoje } = entrada;
  const relogio: Relogio = { regras: entrada.regras ?? [], expediente: entrada.expediente ?? EXPEDIENTE_PADRAO, agora: entrada.agora ?? new Date() };
  const corrente = hoje >= ciclo.inicio && hoje <= ciclo.fim;
  const ateDia = corrente ? hoje : ciclo.fim;
  const { inicio } = ciclo;

  const ra = cases.filter(isReclameAqui);
  /*
    Três abas: a de 6 meses que o portal mostra hoje (a vigente, em meses
    fechados), a de 6 meses que vira vigente no dia 1º — é nela que o que
    se faz agora conta, e é dela a projeção do selo — e a de 12 meses.
  */
  const abas = [montarAba(cases, ateDia, 6, "vigente", relogio), montarAba(cases, ateDia, 6, "proximo", relogio), montarAba(cases, ateDia, 12, "vigente", relogio)];

  const anteriorFim = cicloAnterior(ciclo).fim;
  const antes = abaEm(cases, anteriorFim, 6).resumo;

  const noCiclo = {
    entrantes: ra.filter((c) => noIntervalo(c.createdAt, inicio, ateDia)).length,
    respondidas: ra.filter((c) => respondida(c) && noIntervalo(c.publicResponseAt, inicio, ateDia)).length,
    avaliadas: ra.filter((c) => c.evaluated && noIntervalo(c.evaluatedAt, inicio, ateDia)).length,
    resolvidas: ra.filter((c) => c.evaluated && c.resolved && noIntervalo(c.evaluatedAt, inicio, ateDia)).length,
  };

  /* O que está aberto agora, e não no fim do ciclo: é o que pede ação. */
  const hojeMs = Date.parse(`${hoje}T12:00:00Z`);
  const semResposta = ra.filter((c) => !respondida(c));
  const maisDe7Dias = semResposta.filter((c) => (hojeMs - Date.parse(`${diaNaOperacao(c.createdAt)}T12:00:00Z`)) / 86400000 > 7).length;

  const metricaDoDia = medirDia(cases, [], ateDia);

  /* ---- NPS: as respostas que chegaram no ciclo ---- */
  const npsDoCiclo = nps.filter((r) => noIntervalo(r.respondedAt, inicio, ateDia));
  const resumoNps = summarize(npsDoCiclo);
  const guia = indicadoresDoGuia(npsDoCiclo);
  const abertosForaDoPrazo = nps.filter((r) => !isEncerrado(r.status) && !r.firstContactAt && Date.parse(r.firstContactDueAt) < Date.now()).length;

  /* ---- Redes: os atendimentos que entraram no ciclo ---- */
  const social = cases.filter(isSocial).filter((c) => noIntervalo(c.createdAt, inicio, ateDia));
  const redes = {
    entrantes: social.length,
    resolvidos: social.filter((c) => etapaDasRedes(c.status)?.resolvido).length,
    abertos: social.filter((c) => !etapaDasRedes(c.status)?.final).length,
  };

  /* ---- Google: as avaliações publicadas no ciclo ---- */
  const googleDoCiclo = google.filter((g) => noIntervalo(g.publicadaEm, inicio, ateDia));
  const ind = indicadoresGoogle(googleDoCiclo);
  const negativasSemResposta = google.filter((g) => g.classificacao === "negativa" && !g.respondidaEm && g.status !== "denunciada").length;

  const seis = abas[0];
  const proxima = abas[1];

  const dados: DadosDoRelatorio = {
    ciclo,
    ateDia,
    corrente,
    ra: {
      abas,
      anterior: {
        nota: antes.raScore,
        resposta: antes.responseIndex,
        solucao: antes.solutionIndex,
        consumidor: antes.consumerScore,
        voltaria: antes.wouldReturnIndex,
        selo: hasRA1000(antes),
      },
      noCiclo,
      abertas: { semResposta: semResposta.length, maisDe7Dias },
      ciclosComSelo: metricaDoDia.ciclosComSelo,
    },
    nps: {
      respostas: resumoNps.total,
      nps: resumoNps.total ? resumoNps.score : null,
      promotores: resumoNps.promotores,
      detratores: resumoNps.detratores,
      percentualContatados: guia.percentualContatados,
      humorMedioDoDetrator: guia.humorMedioDoDetrator,
      fechadosNoCiclo: nps.filter((r) => isEncerrado(r.status) && r.status !== "[Encerrado] Sem tratativa" && noIntervalo(r.closedAt, inicio, ateDia)).length,
      abertosForaDoPrazo,
    },
    redes,
    google: {
      total: ind.total,
      notaMedia: ind.notaMedia,
      percentualRespondidas: ind.percentualRespondidas,
      negativas: ind.negativas,
      negativasSemResposta,
    },
    primeiroContato: {
      ra: primeiroContatoDosCasos(ra, relogio.regras, { de: inicio, ate: ateDia }, relogio.agora, relogio.expediente),
      redes: primeiroContatoDosCasos(cases.filter(isSocial), relogio.regras, { de: inicio, ate: ateDia }, relogio.agora, relogio.expediente),
      nps: primeiroContatoDoNps(nps, { de: inicio, ate: ateDia }, relogio.agora, (iso) => diaNaOperacao(iso), relogio.expediente),
    },
    pontos: [],
  };

  dados.pontos = pontosDeAtencao(dados, seis, proxima);
  return dados;
}

/** O que precisa da atenção da gestão — cada ponto com o lugar em que se resolve. */
function pontosDeAtencao(d: DadosDoRelatorio, seis: AbaDoRelatorio, proxima: AbaDoRelatorio): DadosDoRelatorio["pontos"] {
  const r = seis.resumo;
  const p: DadosDoRelatorio["pontos"] = [];

  if (d.ra.anterior.selo && !seis.selo) p.push({ texto: "O selo RA1000 caiu na aba vigente de 6 meses neste ciclo.", href: "/reclame-aqui/analytics" });
  if (seis.selo && !proxima.selo) p.push({ texto: `O selo está em risco: a próxima aba de 6 meses (${br(proxima.janela.inicio)} a ${br(proxima.janela.fim)}) ainda não fecha as metas.`, href: "/reclame-aqui/analytics" });

  if (r.responseIndex < RA1000_TARGETS.resposta) {
    p.push({ texto: `Índice de resposta em ${ptBR(r.responseIndex)}% (6 meses vigente): faltam ${seis.faltamRespostas} resposta(s) para os 90% do RA1000.`, href: "/reclame-aqui" });
  }
  if (proxima.resumo.responseIndex < RA1000_TARGETS.resposta && proxima.faltamRespostas > 0) {
    p.push({ texto: `Na próxima aba de 6 meses a resposta está em ${ptBR(proxima.resumo.responseIndex)}%: faltam ${proxima.faltamRespostas} resposta(s).`, href: "/reclame-aqui" });
  }
  if (d.ra.abertas.semResposta > 0) {
    p.push({
      texto: `${d.ra.abertas.semResposta} reclamação(ões) sem resposta pública${d.ra.abertas.maisDe7Dias ? `, ${d.ra.abertas.maisDe7Dias} há mais de 7 dias` : ""}.`,
      href: "/reclame-aqui",
    });
  }
  if (r.evaluated < RA1000_MINIMO_DE_AVALIACOES) {
    p.push({ texto: `Só ${r.evaluated} avaliações na aba de 6 meses — o selo pede ${RA1000_MINIMO_DE_AVALIACOES}.`, href: "/reclame-aqui/avaliacoes" });
  }
  if (r.evaluated > 0 && r.solutionIndex < RA1000_TARGETS.solucao) p.push({ texto: `Índice de solução em ${ptBR(r.solutionIndex)}% — a meta do selo é ${RA1000_TARGETS.solucao}%.`, href: "/reclame-aqui/avaliacoes" });
  if (r.evaluated > 0 && r.wouldReturnIndex < RA1000_TARGETS["novos-negocios"]) p.push({ texto: `Voltariam a fazer negócio: ${ptBR(r.wouldReturnIndex)}% — a meta é ${RA1000_TARGETS["novos-negocios"]}%.`, href: "/reclame-aqui/avaliacoes" });
  if (r.evaluated > 0 && r.consumerScore < RA1000_TARGETS.consumidor) p.push({ texto: `Nota do consumidor em ${ptBR(r.consumerScore, 2)} — a meta é ${RA1000_TARGETS.consumidor}.`, href: "/reclame-aqui/avaliacoes" });

  if (r.responseMinutes > 7 * 1440) {
    p.push({
      texto: `Primeira resposta pública em ${formatElapsed(r.responseMinutes)} na média${seis.tempoMedianoMin !== null ? ` (mediana de ${formatElapsed(seis.tempoMedianoMin)})` : ""} — puxada pelas respondidas muito tarde.`,
      href: "/reclame-aqui/analytics",
    });
  }

  const frentes = [
    { nome: "Reclame Aqui", ind: d.primeiroContato.ra, href: "/reclame-aqui" },
    { nome: "redes", ind: d.primeiroContato.redes, href: "/redes-sociais" },
  ];
  for (const { nome, ind, href } of frentes) {
    if (ind.vencidosSemContato > 0) p.push({ texto: `${ind.vencidosSemContato} atendimento(s) do ciclo em ${nome} sem 1º contato e com o prazo vencido.`, href: "/meu-dia" });
    else if (ind.percentualNoPrazo !== null && ind.percentualNoPrazo < 90) p.push({ texto: `1º contato no prazo em ${ind.percentualNoPrazo}% dos casos do ciclo em ${nome}.`, href });
  }

  if (d.nps.abertosForaDoPrazo > 0) p.push({ texto: `${d.nps.abertosForaDoPrazo} ciclo(s) do NPS com o 1º contato fora do prazo.`, href: "/nps" });
  if (d.nps.percentualContatados !== null && d.nps.percentualContatados < 100) p.push({ texto: `${d.nps.percentualContatados}% dos detratores do ciclo contatados.`, href: "/nps" });
  if (d.google.negativasSemResposta > 0) p.push({ texto: `${d.google.negativasSemResposta} avaliação(ões) negativa(s) no Google sem resposta.`, href: "/google" });
  if (d.redes.abertos > 0) p.push({ texto: `${d.redes.abertos} atendimento(s) das redes do ciclo ainda em aberto.`, href: "/redes-sociais" });

  return p;
}

const pct = (v: number) => `${ptBR(v)}%`;
/** "01/09/25" — com o ano: a aba de 12 meses atravessa a virada. */
const br = (d: string) => { const [a, m, dd] = d.split("-"); return `${dd}/${m}/${a.slice(2)}`; };
const seta = (agora: number, antes: number) => (agora > antes ? "↑" : agora < antes ? "↓" : "=");

/**
 * O relatório em texto, para o Slack — no formato que a gestão lê.
 * `analise` entra por último, quando alguém escreveu (ou pediu à IA).
 */
/** O que falta para o selo numa aba, em uma frase. */
export function projecaoDoSelo(aba: AbaDoRelatorio) {
  if (aba.selo) return "selo garantido nas metas de hoje";
  const passos = [
    aba.faltamRespostas ? `responder ${aba.faltamRespostas}` : null,
    aba.avaliacoesParaOSelo.alcancavel && aba.avaliacoesParaOSelo.necessarias
      ? `conquistar ${aba.avaliacoesParaOSelo.necessarias} avaliação(ões) nota 10 resolvidas`
      : !aba.avaliacoesParaOSelo.alcancavel
        ? `(${aba.avaliacoesParaOSelo.motivo})`
        : null,
    aba.faltamParaOMinimo ? `chegar a ${RA1000_MINIMO_DE_AVALIACOES} avaliações (faltam ${aba.faltamParaOMinimo})` : null,
  ].filter(Boolean);
  return passos.length ? `para o selo: ${passos.join(", ")}` : "sem selo";
}

export function textoDoRelatorio(d: DadosDoRelatorio, analise?: string) {
  const [seis, proxima, doze] = d.ra.abas;
  const r = seis.resumo;
  const a = d.ra.anterior;

  const projecao = [
    `vigente (${br(seis.janela.inicio)} a ${br(seis.janela.fim)}): ${seis.selo ? `sim, ${d.ra.ciclosComSelo} ciclo(s) seguido(s)` : `não — ${projecaoDoSelo(seis)}`}`,
    `próxima (${br(proxima.janela.inicio)} a ${br(proxima.janela.fim)}, em andamento): ${proxima.selo ? "fecha as metas hoje" : projecaoDoSelo(proxima)}`,
  ].join("; ");

  const linhas = [
    `*Relatório de Reputação — ciclo ${d.ciclo.rotulo}*${d.corrente ? " (parcial, até hoje)" : ""}`,
    "",
    `*Reclame Aqui (6 meses vigente):* nota ${ptBR(r.raScore)} ${seta(r.raScore, a.nota)} · resposta ${pct(r.responseIndex)} ${seta(r.responseIndex, a.resposta)} · solução ${pct(r.solutionIndex)} · consumidor ${ptBR(r.consumerScore, 2)} · voltaria ${pct(r.wouldReturnIndex)} · ${r.evaluated} avaliações`,
    `*Próxima aba de 6 meses:* nota ${ptBR(proxima.resumo.raScore)} · resposta ${pct(proxima.resumo.responseIndex)} · ${proxima.resumo.evaluated} avaliações`,
    `*Reclame Aqui (12 meses):* nota ${ptBR(doze.resumo.raScore)} · selo ${doze.selo ? "sim" : "não"}`,
    `*Selo RA1000:* ${projecao}.`,
    `*No ciclo:* ${d.ra.noCiclo.entrantes} reclamação(ões) nova(s) · ${d.ra.noCiclo.respondidas} respondida(s) · ${d.ra.noCiclo.avaliadas} avaliada(s), ${d.ra.noCiclo.resolvidas} resolvida(s). Em aberto sem resposta: ${d.ra.abertas.semResposta}.`,
    `*NPS do ciclo:* ${d.nps.respostas} resposta(s)${d.nps.nps !== null ? ` · NPS ${d.nps.nps}` : ""} · ${d.nps.detratores} detrator(es)${d.nps.percentualContatados !== null ? `, ${d.nps.percentualContatados}% contatados` : ""}${d.nps.humorMedioDoDetrator !== null ? ` · humor do detrator depois do contato ${ptBR(d.nps.humorMedioDoDetrator)}/5` : ""} · ${d.nps.fechadosNoCiclo} ciclo(s) fechado(s).`,
    `*1º contato no ciclo:* Reclame Aqui ${descreverIndicadorDoPrimeiroContato(d.primeiroContato.ra, (m) => descreverMinutosUteis(m))} · redes ${descreverIndicadorDoPrimeiroContato(d.primeiroContato.redes, (m) => descreverMinutosUteis(m))} · NPS ${descreverIndicadorDoPrimeiroContato(d.primeiroContato.nps, (m) => descreverMinutosUteis(m))}.`,
    `*Redes sociais:* ${d.redes.entrantes} atendimento(s) · ${d.redes.resolvidos} resolvido(s) · ${d.redes.abertos} em aberto.`,
    `*Google:* ${d.google.total} avaliação(ões)${d.google.notaMedia !== null ? ` · nota média ${ptBR(d.google.notaMedia)}` : ""}${d.google.percentualRespondidas !== null ? ` · ${d.google.percentualRespondidas}% respondidas` : ""}.`,
    "",
    `*Pontos de atenção:*${d.pontos.length ? "" : " nenhum."}`,
    ...d.pontos.map((p) => `• ${p.texto}`),
  ];

  if (analise?.trim()) linhas.push("", "*Análise:*", analise.trim());

  return linhas.join("\n");
}
