"use server";

import { tryRole } from "@/lib/auth/guard";
import { radarDeIncidente, JANELA_DO_RADAR_HORAS, type Incidente, type SinalParaRadar } from "@/lib/models/radarDeIncidente";

/**
 * O radar de incidente de agora (1.102): as últimas 6 horas de reclamações
 * (pela hora em que chegaram), NPS com comentário e mensagens de clientes
 * nas conversas guardadas. Ver `lib/models/radarDeIncidente.ts`.
 */
export async function lerRadarDeIncidente(): Promise<Incidente[]> {
  const ctx = await tryRole("LEITURA").catch(() => null);
  if (!ctx) return [];
  const desde = new Date(Date.now() - JANELA_DO_RADAR_HORAS * 3_600_000);
  try {
    const [casos, nps, msgs] = await Promise.all([
      ctx.prisma.case.findMany({
        where: { recebidaEm: { gte: desde } },
        select: { id: true, protocol: true, customer: true, title: true, description: true, causaRaiz: true, recebidaEm: true, channel: true },
      }),
      ctx.prisma.npsResponse.findMany({ where: { respondedAt: { gte: desde }, comment: { not: "" } }, select: { id: true, customer: true, customerName: true, comment: true, respondedAt: true } }),
      ctx.prisma.mensagemDaConversa.findMany({
        where: { de: "cliente", em: { gte: desde } },
        select: { texto: true, em: true, conversa: { select: { id: true, telefone: true, contatoNome: true } } },
      }),
    ]);
    const sinais: SinalParaRadar[] = [
      ...casos.map((c) => ({
        frente: c.channel === "RECLAME_AQUI" ? ("reclame-aqui" as const) : ("redes" as const),
        cliente: c.customer,
        quando: c.recebidaEm!.toISOString(),
        texto: `${c.title}\n${c.description ?? ""}`,
        causa: c.causaRaiz ?? undefined,
        rotulo: `${c.protocol} · ${c.customer}`,
        href: c.channel === "RECLAME_AQUI" ? `/reclame-aqui/${c.id}` : `/redes-sociais/${c.id}`,
      })),
      ...nps.map((r) => ({ frente: "nps" as const, cliente: r.customer, quando: r.respondedAt.toISOString(), texto: r.comment, rotulo: `NPS · ${r.customerName || r.customer}`, href: `/nps/${r.id}` })),
      ...msgs
        .filter((m) => m.em)
        .map((m) => ({ frente: "conversa" as const, cliente: m.conversa.telefone ?? m.conversa.id, quando: m.em!.toISOString(), texto: m.texto, rotulo: `Conversa · ${m.conversa.contatoNome ?? m.conversa.telefone ?? ""}` })),
    ];
    return radarDeIncidente(sinais);
  } catch (erro) {
    console.error("[radar]", erro);
    return [];
  }
}
