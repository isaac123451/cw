"use server";

import type { Prisma } from "@prisma/client";

import { requireRole, tryRole } from "@/lib/auth/guard";
import { ajusteValido, type AjusteDaRecuperacao } from "@/lib/models/recuperacao";

/**
 * O ajuste do plano de recuperação da própria pessoa (1.122).
 *
 * Cada um ajusta o seu — o id vem da sessão, nunca da tela. Gravado em
 * `UserPreference.recuperacao`, e sempre conferido por `ajusteValido` na
 * ida e na volta: o que vier fora dos limites vira o limite.
 */

export async function lerAjusteDaRecuperacao(): Promise<AjusteDaRecuperacao> {
  const ctx = await tryRole("LEITURA").catch(() => null);
  if (!ctx) return ajusteValido(null);
  try {
    const linha = await ctx.prisma.userPreference.findUnique({ where: { userId: ctx.userId }, select: { recuperacao: true } });
    return ajusteValido(linha?.recuperacao);
  } catch (erro) {
    console.error("[recuperacao] leitura do ajuste falhou", erro);
    return ajusteValido(null);
  }
}

export async function salvarAjusteDaRecuperacao(entrada: AjusteDaRecuperacao): Promise<{ erro?: string; ajuste?: AjusteDaRecuperacao }> {
  const ctx = await requireRole("LEITURA").catch(() => null);
  if (!ctx) return { erro: "Entre de novo para salvar o plano." };
  const ajuste = ajusteValido(entrada);
  const valor = ajuste as unknown as Prisma.InputJsonValue;
  await ctx.prisma.userPreference.upsert({
    where: { userId: ctx.userId },
    update: { recuperacao: valor },
    create: { userId: ctx.userId, notifications: {}, recuperacao: valor },
  });
  return { ajuste };
}
