import "server-only";

import type { PrismaClient } from "@prisma/client";

import type { EventoDoCaso } from "@/lib/services/timeline.service";

/**
 * O histórico de trocas do caso: responsável e etapa, com quem trocou.
 *
 * **Por que existe (out/2026).** A tabela `CaseEvent` estava no banco e
 * nada gravava nela. Três reclamações apareceram com um usuário de teste
 * como responsável, e não havia como saber desde quando nem por quem: o
 * histórico do caso era montado só das datas, das movimentações e dos
 * contatos. Agora a ficha, o quadro e a extensão deixam o rastro aqui.
 *
 * Falhar aqui não desfaz a gravação do caso: o registro é rastro, não
 * condição.
 */
export async function registrarTrocas(
  prisma: PrismaClient,
  quem: { userId?: string | null; nome?: string | null },
  protocolo: string,
  antes: { owner?: string | null; status?: string | null },
  depois: { owner?: string | null; status?: string | null }
) {
  try {
    const trocas: { kind: "responsavel" | "etapa"; detail: string }[] = [];
    if ((antes.owner ?? "") !== (depois.owner ?? "")) {
      trocas.push({ kind: "responsavel", detail: `${antes.owner || "ninguém"} → ${depois.owner || "ninguém"}` });
    }
    if (antes.status && depois.status && antes.status !== depois.status) {
      trocas.push({ kind: "etapa", detail: `${antes.status} → ${depois.status}` });
    }
    if (trocas.length === 0) return;
    const [caso, usuario] = await Promise.all([
      prisma.case.findUnique({ where: { protocol: protocolo }, select: { id: true } }),
      !quem.nome && quem.userId ? prisma.user.findUnique({ where: { id: quem.userId }, select: { name: true } }) : null,
    ]);
    if (!caso) return;
    const actor = quem.nome ?? usuario?.name ?? null;
    await prisma.caseEvent.createMany({
      data: trocas.map((t) => ({ caseId: caso.id, kind: t.kind, detail: t.detail, actor })),
    });
  } catch (erro) {
    console.error("[casos] histórico da troca não gravou", erro);
  }
}

/** As trocas do caso, na ordem em que aconteceram. */
export async function eventosDoCaso(prisma: PrismaClient, protocolo: string): Promise<EventoDoCaso[]> {
  const caso = await prisma.case.findUnique({ where: { protocol: protocolo }, select: { id: true } });
  if (!caso) return [];
  const eventos = await prisma.caseEvent.findMany({
    where: { caseId: caso.id, kind: { in: ["responsavel", "etapa"] } },
    orderBy: { createdAt: "asc" },
    take: 200,
  });
  return eventos.map((e) => ({
    id: e.id,
    tipo: e.kind === "responsavel" ? ("responsavel" as const) : ("etapa" as const),
    detalhe: e.detail ?? "",
    por: e.actor,
    em: e.createdAt.toISOString(),
  }));
}
