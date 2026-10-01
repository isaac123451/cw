import type { PrismaClient } from "@prisma/client";

import { podeMarcarSemRetorno } from "@/lib/models/tratativa";
import type { NpsResponseView } from "@/lib/models/nps";

function dia(value?: Date | null) {
  return value ? value.toISOString() : undefined;
}

/**
 * As respostas do NPS como a tela as usa — sem depender de sessão (1.105).
 *
 * Era o corpo de `listNpsResponses`, que só roda com alguém logado; a
 * rotina da madrugada, que manda o relatório do ciclo, precisa da mesma
 * leitura sem sessão. A action continua checando o acesso e chama esta.
 */
export async function lerRespostasDoNps(prisma: PrismaClient, opcoes: { desde?: Date } = {}): Promise<NpsResponseView[]> {
  /*
    Só o que mudou desde `desde` (1.116): a recarga de 3 em 3 minutos baixava
    as 4.110 respostas inteiras (2,3 MB) toda vez. Mudou a resposta, ou ganhou
    tentativa ou anotação, ou chegou uma avaliação do Google ligada a ela.
  */
  const desde = opcoes.desde;
  const linhas = await prisma.npsResponse.findMany({
    where: desde
      ? {
          OR: [
            { updatedAt: { gt: desde } },
            { attempts: { some: { createdAt: { gt: desde } } } },
            { notes: { some: { createdAt: { gt: desde } } } },
            { avaliacoesGoogle: { some: { updatedAt: { gt: desde } } } },
          ],
        }
      : undefined,
    include: {
      owner: { select: { name: true } },
      attempts: { orderBy: { createdAt: "asc" } },
      notes: { orderBy: { createdAt: "asc" } },
      avaliacoesGoogle: {
        select: { estrelas: true, publicadaEm: true },
        orderBy: { publicadaEm: "desc" },
        take: 1,
      },
    },
    orderBy: { respondedAt: "desc" },
  });

  return linhas.map((r) => ({
    id: r.id,
    score: r.score,
    comment: r.comment,
    respondedAt: r.respondedAt.toISOString(),
    customer: r.customer,
    customerName: r.customerName ?? undefined,
    email: r.email ?? undefined,
    phone: r.phone ?? undefined,
    company: r.company ?? undefined,
    establishmentId: r.establishmentId ?? undefined,
    kind: r.kind ?? undefined,
    rootCause: r.rootCause ?? undefined,
    status: r.status,
    owner: r.owner?.name ?? undefined,
    firstContactDueAt:
      r.firstContactDueAt.toISOString(),
    firstContactAt: dia(r.firstContactAt),
    confirmedAt: dia(r.confirmedAt),
    closedAt: dia(r.closedAt),
    outcome: r.outcome ?? undefined,
    reviewAsked: r.reviewAsked,
    testimonialAsked: r.testimonialAsked,
    referralAsked: r.referralAsked,
    reviewFeita: r.reviewFeita ?? undefined,
    aceitaCase: r.aceitaCase ?? undefined,
    indicacoes: r.indicacoes ?? undefined,
    avaliacaoGoogle: r.avaliacoesGoogle[0]
      ? {
          estrelas: r.avaliacoesGoogle[0].estrelas,
          publicadaEm: r.avaliacoesGoogle[0].publicadaEm.toISOString(),
        }
      : undefined,
    source: r.source,
    externalId: r.externalId ?? undefined,
    externalCompanyId: r.externalCompanyId ?? undefined,
    churnRisk: r.churnRisk,
    wootricNotes: r.wootricNotes,
    wootricNotaEm: dia(r.wootricNotaEm),
    wootricConcluidoEm: dia(r.wootricConcluidoEm),
    wootricErro: r.wootricErro ?? undefined,
    notes: r.notes.map((n) => ({
      id: n.id,
      body: n.body,
      actor: n.actor,
      createdAt: n.createdAt.toISOString(),
    })),
    moodAfter: r.moodAfter ?? undefined,
    resolvedAfter: r.resolvedAfter ?? undefined,
    postContactNote: r.postContactNote ?? undefined,
    postContactAt: dia(r.postContactAt),
    postContactBy: r.postContactBy ?? undefined,
    attempts: r.attempts.map((a) => ({
      id: a.id,
      channel: a.channel,
      note: a.note,
      actor: a.actor,
      createdAt: a.createdAt.toISOString(),
      /* Passadas as 2 horas sem conversa, a tentativa já é sem retorno (1.110). */
      resultado: a.resultado === "aguardando" && !podeMarcarSemRetorno(a.createdAt) ? ("aguardando" as const) : ("sem-resposta" as const),
    })),
  }));
}
