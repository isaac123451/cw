"use server";

import { tryRole } from "@/lib/auth/guard";
import { efeitoPorResposta, type EfeitoDaResposta } from "@/lib/models/respostasQueFuncionam";

/** A nota depois de cada resposta pronta — ver `lib/models/respostasQueFuncionam.ts`. Sem a tabela, nada. */
export async function lerEfeitoDasRespostas(): Promise<Record<string, EfeitoDaResposta>> {
  const ctx = await tryRole("LEITURA").catch(() => null);
  if (!ctx) return {};
  try {
    const usos = await ctx.prisma.usoDeResposta.findMany({ select: { macroId: true, caseId: true, usadoEm: true }, take: 20000 });
    if (!usos.length) return {};
    const casos = await ctx.prisma.case.findMany({
      where: { id: { in: [...new Set(usos.map((u) => u.caseId))] }, evaluated: true, score: { not: null } },
      select: { id: true, score: true, evaluatedAt: true },
    });
    const avaliacao = new Map(casos.map((c) => [c.id, c]));
    return efeitoPorResposta(
      usos.map((u) => ({
        macroId: u.macroId,
        caseId: u.caseId,
        usadoEm: u.usadoEm.toISOString(),
        avaliadoEm: avaliacao.get(u.caseId)?.evaluatedAt?.toISOString() ?? null,
        nota: avaliacao.get(u.caseId)?.score ?? null,
      }))
    );
  } catch {
    return {};
  }
}
