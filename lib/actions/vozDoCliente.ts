"use server";

import { tryRole } from "@/lib/auth/guard";
import { vozDoMes, type RegistroDaVoz, type VozDoMes } from "@/lib/models/vozDoCliente";

/** A voz do cliente de um mês (1.104) — ver `lib/models/vozDoCliente.ts`. */
export async function lerVozDoCliente(mes: string): Promise<{ ok: true; voz: VozDoMes } | { ok: false; erro: string }> {
  const ctx = await tryRole("LEITURA").catch(() => null);
  if (!ctx) return { ok: false, erro: "Entre na aplicação para ver a voz do cliente." };
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) return { ok: false, erro: "Mês inválido." };

  const inicio = new Date(`${mes}-01T03:00:00Z`);
  const [a, m] = mes.split("-").map(Number);
  const fim = new Date(Date.UTC(m === 12 ? a + 1 : a, m === 12 ? 0 : m, 1, 3));

  try {
    const [casos, nps] = await Promise.all([
      ctx.prisma.case.findMany({
        /* publishedAt é dia puro (meia-noite UTC): o mês vai de 00:00Z a 00:00Z. */
        where: { publishedAt: { gte: new Date(`${mes}-01T00:00:00Z`), lt: new Date(fim.getTime() - 3 * 3_600_000) } },
        select: { channel: true, causaRaiz: true, publishedAt: true, title: true, description: true, evaluated: true, score: true, resolved: true },
      }),
      ctx.prisma.npsResponse.findMany({
        where: { respondedAt: { gte: inicio, lt: fim }, OR: [{ rootCause: { not: null } }, { comment: { not: "" }, score: { lte: 6 } }] },
        select: { rootCause: true, respondedAt: true, comment: true, score: true },
      }),
    ]);
    const registros: RegistroDaVoz[] = [
      ...casos.map((c) => ({
        frente: c.channel === "RECLAME_AQUI" ? ("reclame-aqui" as const) : ("redes" as const),
        causa: c.causaRaiz ?? undefined,
        em: c.publishedAt.toISOString(),
        texto: `${c.title}. ${c.description ?? ""}`,
        citacao: c.title.replace(/^Card[aá]pio Web:\s*/i, "").slice(0, 160),
        nota: c.score ?? undefined,
        avaliada: c.evaluated,
        resolvida: c.resolved ?? undefined,
      })),
      ...nps.map((r) => ({ frente: "nps" as const, causa: r.rootCause ?? undefined, em: new Date(r.respondedAt.getTime() - 3 * 3_600_000).toISOString(), texto: r.comment ?? "", citacao: (r.comment ?? "").replace(/\s+/g, " ").trim().slice(0, 160), nota: r.score })),
    ];
    return { ok: true, voz: vozDoMes(registros, mes) };
  } catch (erro) {
    console.error("[voz do cliente]", erro);
    return { ok: false, erro: "O banco não respondeu agora." };
  }
}
