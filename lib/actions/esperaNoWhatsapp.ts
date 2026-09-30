"use server";

import { tryRole } from "@/lib/auth/guard";
import type { ConversaEsperando, RetratoDaEspera } from "@/lib/models/esperaNoWhatsapp";

/** O retrato mais recente da lista do WhatsApp de quem abriu a tela (1.108). */
export async function lerEsperaNoWhatsapp(): Promise<RetratoDaEspera | null> {
  const ctx = await tryRole("LEITURA").catch(() => null);
  if (!ctx) return null;
  try {
    const linha = await ctx.prisma.esperaNoWhatsapp.findUnique({ where: { userId: ctx.userId } });
    return linha ? { conversas: linha.conversas as unknown as ConversaEsperando[], lidoEm: linha.lidoEm.toISOString() } : null;
  } catch (erro) {
    console.error("[espera-whatsapp]", erro);
    return null;
  }
}
