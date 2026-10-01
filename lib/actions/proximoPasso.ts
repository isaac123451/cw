"use server";

import { Prisma } from "@prisma/client";

import { requireRole } from "@/lib/auth/guard";
import { proximoPassoValido, type ProximoPassoGuardado } from "@/lib/models/proximoPasso";

/**
 * Guarda o próximo passo da fila do Meu dia na conta (1.123), para o popup
 * da extensão mostrar "o próximo" sem refazer a fila no servidor.
 *
 * Chamado pelo navegador só quando o primeiro da fila muda — não a cada
 * recarga. `null` limpa (fila vazia: nada a fazer agora). Cada um grava o
 * seu; o id vem da sessão.
 */
export async function guardarProximoPasso(retrato: ProximoPassoGuardado | null): Promise<{ erro?: string }> {
  const ctx = await requireRole("LEITURA").catch(() => null);
  if (!ctx) return { erro: "Sem sessão." };
  const valor = retrato ? proximoPassoValido(retrato, new Date()) : null;
  if (retrato && !valor) return { erro: "Próximo passo fora do formato." };
  const json = valor as unknown as Prisma.InputJsonValue;
  await ctx.prisma.userPreference.upsert({
    where: { userId: ctx.userId },
    update: { proximoPasso: valor ? json : Prisma.DbNull },
    create: { userId: ctx.userId, notifications: {}, ...(valor ? { proximoPasso: json } : {}) },
  });
  return {};
}
