"use server";

import { tryRole } from "@/lib/auth/guard";

/**
 * A última leitura do vigia (05/11/2026, Fase B). A cada volta ele lê a
 * lista da Cardápio Web no portal e grava o painel da nota
 * (`PainelDoPortal.lidoEm`): é o sinal de vida dele. O sino avisa quando o
 * sinal some por mais de 2 horas úteis — "esse vigia ele precisa ser bem
 * assertivo".
 */
export async function ultimaLeituraDoVigia(): Promise<string | null> {
  const ctx = await tryRole("LEITURA").catch(() => null);
  if (!ctx) return null;
  const linha = await ctx.prisma.painelDoPortal.findFirst({ orderBy: { lidoEm: "desc" }, select: { lidoEm: true } }).catch(() => null);
  return linha?.lidoEm.toISOString() ?? null;
}
