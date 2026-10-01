import type { PrismaClient } from "@prisma/client";

import {
  clientesEmCancelamento,
  type CasoParaCancelamento,
  type DesfechoManual,
  type MensagemParaCancelamento,
  type NpsParaCancelamento,
  type ClienteEmCancelamento,
} from "@/lib/models/cancelamento";
import { clientesEmRisco } from "@/lib/models/clienteEmRisco";
import { riscoDeCancelamento, type RiscoDeCancelamento } from "@/lib/models/riscoDeCancelamento";
import { CLOSED_STATUS } from "@/lib/services/case.service";
import { EXPEDIENTE_PADRAO, instanteDe, prazoUtil, type Expediente } from "@/lib/services/horasUteis";
import { lerExpediente } from "@/lib/services/operacao.service";

/**
 * Quando a reclamação chegou (1.113). Era o `createdAt` do banco — o dia
 * da importação: 20 clientes caíam em 23/08/2026, e reclamações de 2024
 * contavam como deste mês. Vale a hora em que chegou; sem ela, o dia
 * publicado no portal.
 */
function chegouEm(c: { recebidaEm: Date | null; publishedAt: Date }) {
  return (c.recebidaEm ?? c.publishedAt).toISOString();
}

/**
 * O prazo do 1º contato: 1 dia útil (1.113) — "cancelamentos feitos no
 * prazo da SLA não contabilizam para mim; o prazo de contato é de 1 dia
 * útil". Com a hora de chegada, a mesma hora do próximo dia útil; só com
 * o dia (a carga do portal), o fim do expediente do próximo dia útil — a
 * leitura mais justa para quem atende.
 */
function prazoDoContato(c: { recebidaEm: Date | null; publishedAt: Date }, expediente: Expediente) {
  /* O último minuto do expediente do dia: mais 1 dia útil é o fim do expediente seguinte. */
  const inicio = c.recebidaEm ?? instanteDe(c.publishedAt.toISOString().slice(0, 10), expediente.fimMin - 1);
  return prazoUtil(inicio, 24, expediente).toISOString();
}

/**
 * Os dados para a conta de cancelamento e retenção (1.85): os casos com o
 * texto, os comentários do NPS e as mensagens das conversas guardadas —
 * as do cliente e as nossas (o "cancelamento efetuado" costuma ser nosso).
 */
export async function lerClientesEmCancelamento(prisma: PrismaClient) {
  const [casos, nps, mensagens, manuais, expediente] = await Promise.all([
    prisma.case.findMany({
      select: {
        protocol: true,
        channel: true,
        customer: true,
        title: true,
        description: true,
        causaRaiz: true,
        solucaoAplicada: true,
        evaluated: true,
        resolved: true,
        wouldDoBusiness: true,
        evaluatedAt: true,
        recebidaEm: true,
        publishedAt: true,
        establishmentId: true,
        document: true,
        email: true,
        phone: true,
        category: { select: { name: true } },
        subcategory: { select: { name: true } },
        establishment: { select: { name: true } },
      },
    }),
    prisma.npsResponse.findMany({
      where: { comment: { not: "" } },
      select: { id: true, customer: true, customerName: true, comment: true, respondedAt: true, establishmentId: true, email: true },
    }),
    prisma.mensagemDaConversa.findMany({
      where: { de: { in: ["cliente", "nos"] } },
      select: {
        texto: true,
        em: true,
        criadoEm: true,
        conversa: { select: { id: true, telefone: true, contatoNome: true, establishmentId: true, npsResponseId: true, case: { select: { protocol: true } } } },
      },
    }),
    lerManuais(prisma),
    lerExpediente(prisma).catch(() => EXPEDIENTE_PADRAO),
  ]);

  const paraCasos: CasoParaCancelamento[] = casos.map((c) => ({
    protocolo: c.protocol,
    frente: c.channel === "RECLAME_AQUI" ? "reclame-aqui" : "redes",
    cliente: c.customer,
    titulo: c.title,
    relato: c.description ?? undefined,
    categoria: c.category?.name,
    subcategoria: c.subcategory?.name,
    causaRaiz: c.causaRaiz ?? undefined,
    solucao: c.solucaoAplicada ?? undefined,
    avaliado: c.evaluated,
    resolvido: c.resolved,
    voltaria: c.wouldDoBusiness,
    avaliadoEm: c.evaluatedAt?.toISOString(),
    criadoEm: chegouEm(c),
    prazoDoContato: prazoDoContato(c, expediente),
    contaId: c.establishmentId ?? undefined,
    contaNome: c.establishment?.name,
    documento: c.document ?? undefined,
    email: c.email ?? undefined,
    telefone: c.phone ?? undefined,
  }));

  const paraNps: NpsParaCancelamento[] = nps.map((r) => ({
    id: r.id,
    cliente: r.customerName || r.customer,
    comentario: r.comment,
    quando: r.respondedAt.toISOString(),
    contaId: r.establishmentId ?? undefined,
    email: r.email ?? undefined,
  }));

  const paraMensagens: MensagemParaCancelamento[] = mensagens.map((m) => ({
    conversaId: m.conversa.id,
    texto: m.texto,
    quando: (m.em ?? m.criadoEm).toISOString(),
    caseProtocolo: m.conversa.case?.protocol,
    contaId: m.conversa.establishmentId ?? undefined,
    npsId: m.conversa.npsResponseId ?? undefined,
    telefone: m.conversa.telefone ?? undefined,
    contato: m.conversa.contatoNome || undefined,
  }));

  return clientesEmCancelamento({ casos: paraCasos, nps: paraNps, mensagens: paraMensagens, manuais });
}

/** As correções à mão, por cliente. Sem a tabela ainda, nenhuma. */
async function lerManuais(prisma: PrismaClient) {
  /* Servidor que subiu antes do cliente novo do Prisma: sem a tabela no cliente, sem correções — a conta segue. */
  if (!prisma.desfechoDeCancelamento) return new Map<string, { desfecho: DesfechoManual; por?: string }>();
  try {
    const linhas = await prisma.desfechoDeCancelamento.findMany({ select: { chave: true, desfecho: true, por: true } });
    return new Map(linhas.map((l) => [l.chave, { desfecho: l.desfecho as DesfechoManual, por: l.por ?? undefined }]));
  } catch (erro) {
    const codigo = (erro as { code?: string })?.code;
    if (codigo === "P2021" || codigo === "P2022") return new Map();
    throw erro;
  }
}

/**
 * Os clientes em risco (1.101): reclamação aberta, detrator recente, pedido
 * de cancelamento em aberto, marca de churn, reincidência — dois ou mais.
 * Ver `lib/models/clienteEmRisco.ts`.
 */
export async function lerClientesEmRisco(prisma: PrismaClient, emCancelamento: ClienteEmCancelamento[]) {
  const [casos, nps] = await Promise.all([
    prisma.case.findMany({
      select: { protocol: true, customer: true, status: true, churnRisk: true, recebidaEm: true, publishedAt: true, establishmentId: true, document: true, email: true, establishment: { select: { name: true } } },
    }),
    prisma.npsResponse.findMany({
      where: { score: { lte: 6 }, respondedAt: { gte: new Date(Date.now() - 60 * 86_400_000) } },
      select: { id: true, customer: true, customerName: true, score: true, respondedAt: true, status: true, establishmentId: true, email: true },
    }),
  ]);
  return clientesEmRisco({
    casos: casos.map((c) => ({
      protocolo: c.protocol,
      cliente: c.customer,
      aberto: !CLOSED_STATUS.includes(c.status),
      churn: c.churnRisk,
      criadoEm: chegouEm(c),
      contaId: c.establishmentId ?? undefined,
      contaNome: c.establishment?.name,
      documento: c.document ?? undefined,
      email: c.email ?? undefined,
    })),
    nps: nps.map((r) => ({
      id: r.id,
      cliente: r.customerName || r.customer,
      nota: r.score,
      respondidoEm: r.respondedAt.toISOString(),
      encerrado: r.status.startsWith("[Encerrado]"),
      contaId: r.establishmentId ?? undefined,
      email: r.email ?? undefined,
    })),
    pedidosEmAberto: new Set(emCancelamento.filter((c) => c.desfecho === "em-aberto").map((c) => c.chave)),
  });
}

export interface ReclamacaoComRisco {
  id: string;
  protocolo: string;
  frente: "reclame-aqui" | "redes";
  cliente: string;
  titulo: string;
  status: string;
  chegouEm: string;
  responsavel: string | null;
  risco: RiscoDeCancelamento;
}

/**
 * As reclamações abertas com chance de cancelar (1.113): a régua de
 * `riscoDeCancelamento` sobre cada uma, com a repetição pelo CPF/CNPJ e o
 * NPS recente da conta. Só as de risco médio para cima, e as que já dizem
 * que o cliente cancelou (recuperação).
 */
export async function lerReclamacoesComRisco(prisma: PrismaClient, opcoes: { caseId?: string; incluirBaixo?: boolean } = {}): Promise<ReclamacaoComRisco[]> {
  const [abertos, todos, detratores] = await Promise.all([
    prisma.case.findMany({
      where: opcoes.caseId ? { OR: [{ id: opcoes.caseId }, { externalId: opcoes.caseId }] } : { status: { notIn: CLOSED_STATUS } },
      select: {
        id: true,
        protocol: true,
        channel: true,
        customer: true,
        title: true,
        description: true,
        status: true,
        criterios: true,
        churnRisk: true,
        evaluated: true,
        wouldDoBusiness: true,
        resolved: true,
        recebidaEm: true,
        publishedAt: true,
        document: true,
        email: true,
        establishmentId: true,
        category: { select: { name: true } },
        subcategory: { select: { name: true } },
        owner: { select: { name: true } },
      },
    }),
    prisma.case.findMany({ where: { document: { not: null } }, select: { protocol: true, document: true, recebidaEm: true, publishedAt: true } }),
    prisma.npsResponse.findMany({
      where: { score: { lte: 6 }, respondedAt: { gte: new Date(Date.now() - 60 * 86_400_000) } },
      select: { score: true, establishmentId: true, email: true, respondedAt: true },
      orderBy: { respondedAt: "desc" },
    }),
  ]);
  const digitos = (v?: string | null) => String(v ?? "").replace(/\D/g, "");
  const saida: ReclamacaoComRisco[] = [];
  for (const c of abertos) {
    const doc = digitos(c.document);
    const chegou = Date.parse(chegouEm(c));
    const reincidencia = doc.length >= 11
      ? todos.filter((o) => o.protocol !== c.protocol && digitos(o.document) === doc && Date.parse(chegouEm(o)) <= chegou && chegou - Date.parse(chegouEm(o)) <= 90 * 86_400_000).length
      : 0;
    const detrator = detratores.find((r) => (c.establishmentId && r.establishmentId === c.establishmentId) || (c.email && r.email && r.email.toLowerCase() === c.email.toLowerCase()));
    const risco = riscoDeCancelamento({
      titulo: c.title,
      relato: c.description ?? "",
      categoria: c.category?.name,
      subcategoria: c.subcategory?.name,
      criterios: c.criterios,
      reincidencia,
      detratorRecente: detrator ? detrator.score : null,
      churn: c.churnRisk,
      avaliado: c.evaluated,
      voltaria: c.wouldDoBusiness,
      resolvido: c.resolved,
    });
    if (risco.nivel === "baixo" && !opcoes.incluirBaixo) continue;
    saida.push({
      id: c.id,
      protocolo: c.protocol,
      frente: c.channel === "RECLAME_AQUI" ? "reclame-aqui" : "redes",
      cliente: c.customer,
      titulo: c.title,
      status: c.status,
      chegouEm: chegouEm(c),
      responsavel: c.owner?.name ?? null,
      risco,
    });
  }
  const ordem = { cancelou: 1, alto: 0, medio: 2, baixo: 3 } as const;
  return saida.sort((a, b) => ordem[a.risco.nivel] - ordem[b.risco.nivel] || b.risco.pontos - a.risco.pontos);
}
