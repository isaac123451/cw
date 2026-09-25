import type { PrismaClient } from "@prisma/client";

import {
  clientesEmCancelamento,
  type CasoParaCancelamento,
  type DesfechoManual,
  type MensagemParaCancelamento,
  type NpsParaCancelamento,
} from "@/lib/models/cancelamento";

/**
 * Os dados para a conta de cancelamento e retenção (1.85): os casos com o
 * texto, os comentários do NPS e as mensagens das conversas guardadas —
 * as do cliente e as nossas (o "cancelamento efetuado" costuma ser nosso).
 */
export async function lerClientesEmCancelamento(prisma: PrismaClient) {
  const [casos, nps, mensagens, manuais] = await Promise.all([
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
        createdAt: true,
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
    criadoEm: c.createdAt.toISOString(),
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
