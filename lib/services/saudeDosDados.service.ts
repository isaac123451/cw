import type { PrismaClient } from "@prisma/client";

import type { EntradaDaSaude } from "@/lib/models/saudeDosDados";
import { CLOSED_STATUS } from "@/lib/services/case.service";

/**
 * O que a regra da saúde dos dados precisa, numa ida ao banco por tabela.
 * Usado pela tela (`lib/actions/saudeDosDados.ts`) e pela conferência
 * (`check:saude-dos-dados`) — a mesma leitura nos dois.
 */
export async function lerEntradaDaSaude(prisma: PrismaClient): Promise<EntradaDaSaude> {
  const [estabelecimentos, planos, casos, respostaSemData, porEtapa, etapas, causas, tarefas] = await Promise.all([
    prisma.establishment.findMany({ select: { name: true, slug: true, plan: true, mrrCents: true } }),
    prisma.plan.findMany({ select: { name: true, priceCents: true, active: true, kind: true } }),
    prisma.case.findMany({
      select: { id: true, protocol: true, channel: true, customer: true, title: true, status: true, owner: { select: { name: true } } },
    }),
    /* O texto é pesado: só o das que não têm data, que são poucas. */
    prisma.case.findMany({
      where: { channel: "RECLAME_AQUI", publicResponseAt: null, publicResponse: { not: null } },
      select: { id: true, publicResponse: true },
    }),
    prisma.case.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.workflowStatus.findMany({ select: { name: true } }),
    prisma.npsRootCause.findMany({ where: { active: true }, select: { name: true } }),
    prisma.agendaTask.findMany({ where: { done: false }, select: { id: true, title: true, done: true } }),
  ]);

  const semData = new Set(respostaSemData.filter((c) => (c.publicResponse ?? "").trim() !== "").map((c) => c.id));
  const contagem = new Map(porEtapa.map((g) => [g.status, g._count._all]));

  return {
    estabelecimentos: estabelecimentos.map((x) => ({ nome: x.name, slug: x.slug, plano: x.plan, mensalidadeCentavos: x.mrrCents })),
    planos: planos.map((p) => ({ nome: p.name, precoCentavos: p.priceCents, ativo: p.active, tipo: p.kind })),
    casos: casos.map((c) => ({
      id: c.id,
      protocolo: c.protocol,
      canal: c.channel === "RECLAME_AQUI" ? "RECLAME_AQUI" : "SOCIAL",
      cliente: c.customer,
      titulo: c.title,
      status: c.status,
      aberto: !CLOSED_STATUS.includes(c.status),
      dono: c.owner?.name ?? null,
      /* A consulta acima já trouxe só as que têm texto e não têm data. */
      temResposta: semData.has(c.id),
      respostaEm: null,
    })),
    etapasQueContamComoAbertas: etapas
      .filter((x) => !CLOSED_STATUS.includes(x.name))
      .map((x) => ({ nome: x.name, casos: contagem.get(x.name) ?? 0 })),
    causas: causas.map((c) => ({ nome: c.name })),
    tarefas: tarefas.map((t) => ({ id: t.id, titulo: t.title, feita: t.done })),
  };
}
