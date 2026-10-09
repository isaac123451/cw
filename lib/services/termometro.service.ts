import type { Prisma, PrismaClient } from "@prisma/client";

import { semMensagensDeOutraConversa } from "@/lib/models/identidadeNaConversa";
import {
  calibrar,
  faixaDaSatisfacao,
  satisfacaoPelosSinais,
  tendenciaEntre,
  type HistoricoDeAvaliacoes,
  type SinaisDoTermometro,
  type Termometro,
  type TermometroView,
} from "@/lib/models/termometro";
import { humorDaConversa } from "@/lib/services/motorProprio";
import { pedirEstruturado, temIA } from "@/lib/services/ia.service";
import { paredeDe } from "@/lib/services/horasUteis";

/**
 * O termômetro do cliente, gravando (09/10/2026) — ver `lib/models/termometro.ts`.
 *
 * Cada medição é uma linha de `TermometroDoCliente`: a última é o agora, as
 * anteriores contam a evolução. A tabela nasce com `npm run db:push`; antes
 * disso, ler devolve nada e medir avisa — nenhuma tela quebra.
 */

export interface AlvoDoTermometro {
  caseId?: string | null;
  npsResponseId?: string | null;
}

/** A tabela ainda não existe (falta o db:push): trata como "sem leitura". */
function semTabela(erro: unknown) {
  const codigo = (erro as { code?: string })?.code;
  return codigo === "P2021" || /TermometroDoCliente.*does not exist|relation .*termometro/i.test(String((erro as Error)?.message ?? ""));
}

/* ---------------- histórico ---------------- */

function resumo(linhas: { score: number | null; resolved: boolean; wouldDoBusiness: boolean }[]): HistoricoDeAvaliacoes {
  const comNota = linhas.filter((l) => typeof l.score === "number");
  return {
    avaliacoes: linhas.length,
    notaMedia: comNota.length ? comNota.reduce((s, l) => s + (l.score ?? 0), 0) / comNota.length : null,
    resolvido: linhas.length ? Math.round((linhas.filter((l) => l.resolved).length / linhas.length) * 100) : null,
    voltaria: linhas.length ? Math.round((linhas.filter((l) => l.wouldDoBusiness).length / linhas.length) * 100) : null,
  };
}

let operacaoEmCache: { valor: HistoricoDeAvaliacoes; ate: number } | null = null;

/** As avaliações reais do Reclame Aqui nos últimos 12 meses — a régua da operação. */
async function historicoDaOperacao(prisma: PrismaClient): Promise<HistoricoDeAvaliacoes> {
  if (operacaoEmCache && operacaoEmCache.ate > Date.now()) return operacaoEmCache.valor;
  const linhas = await prisma.case.findMany({
    where: { channel: "RECLAME_AQUI", evaluated: true, scoreDisregarded: false, evaluatedAt: { gte: new Date(Date.now() - 365 * 86_400_000) } },
    select: { score: true, resolved: true, wouldDoBusiness: true },
  });
  const valor = resumo(linhas);
  operacaoEmCache = { valor, ate: Date.now() + 3_600_000 };
  return valor;
}

/** As avaliações anteriores do mesmo cliente: pelo documento, pela conta, pelo e-mail ou pelo telefone. */
async function historicoDoCliente(
  prisma: PrismaClient,
  quem: { excluir?: string; document?: string | null; establishmentId?: string | null; email?: string | null; phone?: string | null }
): Promise<HistoricoDeAvaliacoes> {
  const ou: Prisma.CaseWhereInput[] = [];
  if (quem.document) ou.push({ document: quem.document });
  if (quem.establishmentId) ou.push({ establishmentId: quem.establishmentId });
  if (quem.email?.includes("@")) ou.push({ email: { equals: quem.email, mode: "insensitive" } });
  const oito = String(quem.phone ?? "").replace(/\D/g, "").slice(-8);
  if (oito.length === 8) ou.push({ phone: { contains: oito.slice(-4) } });
  if (!ou.length) return { avaliacoes: 0, notaMedia: null, resolvido: null, voltaria: null };
  const linhas = await prisma.case.findMany({
    where: { evaluated: true, scoreDisregarded: false, OR: ou, ...(quem.excluir ? { id: { not: quem.excluir } } : {}) },
    select: { score: true, resolved: true, wouldDoBusiness: true, phone: true, document: true, establishmentId: true, email: true },
    take: 30,
  });
  /* O telefone filtrou pelos 4 finais no banco; aqui confere os 8. */
  const doCliente = linhas.filter(
    (l) =>
      (quem.document && l.document === quem.document) ||
      (quem.establishmentId && l.establishmentId === quem.establishmentId) ||
      (quem.email && l.email?.toLowerCase() === quem.email.toLowerCase()) ||
      (oito.length === 8 && String(l.phone ?? "").replace(/\D/g, "").endsWith(oito))
  );
  return resumo(doCliente);
}

/* ---------------- a medição ---------------- */

export interface LeituraParaOTermometro {
  relato: string;
  historico: HistoricoDeAvaliacoes;
  operacao: HistoricoDeAvaliacoes;
  base: { valor: number; porque: string[] };
  mensagens: { de: string; texto: string; em: Date }[];
}

type Leitor = (entrada: LeituraParaOTermometro) => Promise<(Partial<Termometro> & { modelo?: string }) | null>;

const pct = (v: number | null) => (v === null ? "—" : `${v}%`);

/** A leitura da IA — null quando ela não respondeu. */
const lerComIA: Leitor = async (e) => {
  if (!temIA()) return null;
  const quando = (d: Date) => {
    const p = paredeDe(d);
    return `${p.dia.slice(8, 10)}/${p.dia.slice(5, 7)} ${String(Math.floor(p.min / 60)).padStart(2, "0")}:${String(p.min % 60).padStart(2, "0")}`;
  };
  const r = await pedirEstruturado({
    sistema:
      "Você mede a satisfação de clientes de uma empresa de sistema para restaurantes (Cardápio Web), para o time de reputação. Seja realista e calibrado: cliente esperando resposta, irritado ou ameaçando cancelar não está satisfeito, mesmo que educado. Use só o que está escrito. Português do Brasil.",
    prompt: [
      `O atendimento: ${e.relato}`,
      `Histórico deste cliente em avaliações anteriores do Reclame Aqui: ${e.historico.avaliacoes ? `${e.historico.avaliacoes}, nota média ${e.historico.notaMedia?.toFixed(1)}, resolvido ${pct(e.historico.resolvido)}, voltaria ${pct(e.historico.voltaria)}` : "nenhuma"}.`,
      `Referência da operação (12 meses): nota média ${e.operacao.notaMedia?.toFixed(1) ?? "—"}, resolvido ${pct(e.operacao.resolvido)}, voltaria ${pct(e.operacao.voltaria)}.`,
      `Pelos sinais da conversa, a satisfação de base é ${e.base.valor}/10 (${e.base.porque.join("; ")}).`,
      "",
      "Responda: satisfacao (0 a 10, como a pergunta do NPS: o quanto ele está satisfeito AGORA), nota_prevista (0 a 10: a nota que ele daria se avaliasse hoje), chance_resolvido e chance_voltaria (0 a 100), motivo (uma ou duas frases: o que mais pesa) e sinais (até 4 fatos curtos da conversa que sustentam a leitura).",
      "",
      e.mensagens.length ? "Conversa (da mais antiga para a mais nova):" : "Sem conversa guardada.",
      e.mensagens
        .slice(-30)
        .map((m) => `[${quando(m.em)}] ${m.de === "nos" ? "Nós" : "Cliente"}: ${m.texto.replace(/\s+/g, " ").slice(0, 300)}`)
        .join("\n")
        .slice(0, 7000),
    ].join("\n"),
    esquema: {
      type: "object",
      properties: {
        satisfacao: { type: "number" },
        nota_prevista: { type: "number" },
        chance_resolvido: { type: "number" },
        chance_voltaria: { type: "number" },
        motivo: { type: "string" },
        sinais: { type: "array", items: { type: "string" } },
      },
      required: ["satisfacao", "nota_prevista", "chance_resolvido", "chance_voltaria", "motivo", "sinais"],
    },
  }).catch(() => null);
  if (!r || r.erro || !r.dados) return null;
  const d = r.dados as Record<string, unknown>;
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
  return {
    satisfacao: n(d.satisfacao),
    notaPrevista: n(d.nota_prevista),
    chanceResolvido: n(d.chance_resolvido),
    chanceVoltaria: n(d.chance_voltaria),
    motivo: String(d.motivo ?? "").trim(),
    sinais: Array.isArray(d.sinais) ? d.sinais.map((x) => String(x ?? "").trim()).filter(Boolean) : [],
    modelo: r.modelo,
  };
};

/**
 * Mede agora e grava. O caso (ou o NPS), a conversa ligada a ele (sem o que
 * veio de outra), o histórico do cliente e o da operação.
 */
export async function medirTermometro(
  prisma: PrismaClient,
  alvo: AlvoDoTermometro,
  opcoes: { agora?: Date; ler?: Leitor; /** Calcula sem gravar — a conferência e a prévia. */ soCalcular?: boolean } = {}
): Promise<{ ok: true; termometro: TermometroView } | { ok: false; erro: string }> {
  const agora = opcoes.agora ?? new Date();
  const ler = opcoes.ler ?? lerComIA;
  if (!alvo.caseId && !alvo.npsResponseId) return { ok: false, erro: "Sem caso nem NPS para medir." };

  const caso = alvo.caseId
    ? await prisma.case.findUnique({
        where: { id: alvo.caseId },
        select: { id: true, protocol: true, title: true, description: true, status: true, publicResponse: true, encerradoEm: true, document: true, establishmentId: true, email: true, phone: true, channel: true },
      })
    : null;
  const nps = alvo.npsResponseId
    ? await prisma.npsResponse.findUnique({
        where: { id: alvo.npsResponseId },
        select: { id: true, score: true, comment: true, status: true, closedAt: true, establishmentId: true, email: true, phone: true },
      })
    : null;
  if (!caso && !nps) return { ok: false, erro: "Esse caso ou NPS não existe mais." };

  const conversa = await prisma.conversa.findFirst({
    where: caso ? { caseId: caso.id } : { npsResponseId: nps!.id },
    orderBy: { atualizadoEm: "desc" },
    select: { id: true, telefone: true, contatoNome: true, mensagens: { orderBy: { em: "desc" }, take: 80, select: { de: true, texto: true, em: true, autor: true, chave: true, criadoEm: true } } },
  });
  const mensagens = conversa
    ? semMensagensDeOutraConversa({ telefone: conversa.telefone, nome: conversa.contatoNome }, [...conversa.mensagens].reverse()).filter(
        (m): m is typeof m & { em: Date } => Boolean(m.em) && (m.de === "nos" || m.de === "cliente")
      )
    : [];

  const doCliente = mensagens.filter((m) => m.de === "cliente");
  const ultima = mensagens[mensagens.length - 1];
  const promessaAtrasada = caso
    ? Boolean(
        await prisma.agendaTask.findFirst({
          where: { caseId: caso.id, done: false, id: { startsWith: "auto-" }, dueDate: { lt: new Date(`${paredeDe(agora).dia}T00:00:00.000Z`) } },
          select: { id: true },
        })
      )
    : false;
  const sinais: SinaisDoTermometro = {
    humor: doCliente.length ? humorDaConversa(mensagens.slice(-12).map((m) => ({ de: m.de === "nos" ? ("nos" as const) : ("cliente" as const), texto: m.texto }))) : null,
    horasEsperando: ultima && ultima.de === "cliente" ? (agora.getTime() - ultima.em.getTime()) / 3_600_000 : 0,
    promessaAtrasada,
    respostaPublica: Boolean(caso?.publicResponse?.trim()),
    encerrado: Boolean(caso?.encerradoEm || nps?.closedAt),
    notaNps: nps?.score ?? null,
  };
  const base = satisfacaoPelosSinais(sinais);

  const [historico, operacao] = await Promise.all([
    historicoDoCliente(prisma, {
      excluir: caso?.id,
      document: caso?.document,
      establishmentId: caso?.establishmentId ?? nps?.establishmentId,
      email: caso?.email ?? nps?.email,
      phone: caso?.phone ?? nps?.phone ?? conversa?.telefone,
    }),
    historicoDaOperacao(prisma),
  ]);

  const relato = caso
    ? `reclamação ${caso.protocol} (${caso.status}${caso.publicResponse ? ", com resposta pública" : ", sem resposta pública"}): “${caso.title}”. ${(caso.description ?? "").replace(/\s+/g, " ").slice(0, 600)}`
    : `resposta ao NPS com nota ${nps!.score} (${nps!.status})${nps!.comment ? `: “${nps!.comment.replace(/\s+/g, " ").slice(0, 400)}”` : ""}.`;

  const ia = await ler({ relato, historico, operacao, base, mensagens });
  const t = calibrar(base, historico, operacao, ia);

  if (opcoes.soCalcular) {
    return {
      ok: true,
      termometro: {
        ...t,
        faixa: faixaDaSatisfacao(t.satisfacao),
        tendencia: null,
        fonte: ia ? "ia" : "regra",
        em: agora.toISOString(),
        historico: [{ satisfacao: t.satisfacao, em: agora.toISOString() }],
      },
    };
  }

  try {
    const anterior = await prisma.termometroDoCliente.findFirst({
      where: caso ? { caseId: caso.id } : { npsResponseId: nps!.id },
      orderBy: { criadoEm: "desc" },
      select: { satisfacao: true },
    });
    await prisma.termometroDoCliente.create({
      data: {
        caseId: caso?.id ?? null,
        npsResponseId: caso ? null : nps!.id,
        conversaId: conversa?.id ?? null,
        satisfacao: t.satisfacao,
        notaPrevista: t.notaPrevista,
        chanceResolvido: t.chanceResolvido,
        chanceVoltaria: t.chanceVoltaria,
        tendencia: tendenciaEntre(anterior?.satisfacao, t.satisfacao),
        motivo: t.motivo,
        sinais: t.sinais,
        fonte: ia ? "ia" : "regra",
        modelo: ia?.modelo ?? null,
        criadoEm: agora,
      },
    });
  } catch (erro) {
    if (semTabela(erro)) return { ok: false, erro: "O termômetro ainda não tem onde gravar — falta rodar npm run db:push." };
    throw erro;
  }

  const view = await termometroAtual(prisma, caso ? { caseId: caso.id } : { npsResponseId: nps!.id });
  return view ? { ok: true, termometro: view } : { ok: false, erro: "Não deu para ler o termômetro gravado." };
}

/** A leitura de agora e as anteriores — null quando nunca foi medido (ou a tabela ainda não existe). */
export async function termometroAtual(prisma: PrismaClient, alvo: AlvoDoTermometro): Promise<TermometroView | null> {
  if (!alvo.caseId && !alvo.npsResponseId) return null;
  try {
    const linhas = await prisma.termometroDoCliente.findMany({
      where: alvo.caseId ? { caseId: alvo.caseId } : { npsResponseId: alvo.npsResponseId! },
      orderBy: { criadoEm: "desc" },
      take: 12,
    });
    const agora = linhas[0];
    if (!agora) return null;
    return {
      satisfacao: agora.satisfacao,
      faixa: faixaDaSatisfacao(agora.satisfacao),
      notaPrevista: agora.notaPrevista,
      chanceResolvido: agora.chanceResolvido,
      chanceVoltaria: agora.chanceVoltaria,
      tendencia: (agora.tendencia as TermometroView["tendencia"]) ?? null,
      motivo: agora.motivo,
      sinais: Array.isArray(agora.sinais) ? (agora.sinais as unknown[]).map(String) : [],
      fonte: agora.fonte,
      em: agora.criadoEm.toISOString(),
      historico: [...linhas].reverse().map((l) => ({ satisfacao: l.satisfacao, em: l.criadoEm.toISOString() })),
    };
  } catch (erro) {
    if (semTabela(erro)) return null;
    throw erro;
  }
}

/** Quantas medições por rodada da IA do dia: cada uma é uma chamada de IA. */
const POR_RODADA = 4;

/**
 * Na rodada da IA do dia: mede de novo quem teve mensagem nova desde a
 * última leitura (e a conversa já parou há 10 minutos). Devolve quantas.
 */
export async function termometrosDoDia(prisma: PrismaClient, agora = new Date(), soConversas?: string[]): Promise<number> {
  const conversas = await prisma.conversa.findMany({
    where: {
      ...(soConversas ? { id: { in: soConversas } } : {}),
      OR: [{ caseId: { not: null } }, { npsResponseId: { not: null } }],
      mensagens: { some: { em: { gte: new Date(agora.getTime() - 2 * 86_400_000) } } },
    },
    select: { caseId: true, npsResponseId: true, mensagens: { orderBy: { em: "desc" }, take: 1, select: { em: true } } },
    orderBy: { atualizadoEm: "desc" },
    take: 30,
  });
  let feitas = 0;
  for (const c of conversas) {
    if (feitas >= POR_RODADA) break;
    const ultima = c.mensagens[0]?.em;
    if (!ultima || agora.getTime() - ultima.getTime() < 10 * 60_000) continue;
    const alvo = c.caseId ? { caseId: c.caseId } : { npsResponseId: c.npsResponseId };
    const atual = await termometroAtual(prisma, alvo).catch(() => null);
    if (atual && Date.parse(atual.em) >= ultima.getTime()) continue;
    const r = await medirTermometro(prisma, alvo, { agora });
    if (!r.ok) {
      if (/db:push/.test(r.erro)) return feitas;
      continue;
    }
    feitas += 1;
  }
  return feitas;
}
