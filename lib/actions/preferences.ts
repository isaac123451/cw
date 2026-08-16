"use server";

import { requireRole, tryRole } from "@/lib/auth/guard";

import {
  defaultPrefs,
  NotificationPrefs,
} from "@/lib/services/notifications.service";

/**
 * Preferências da pessoa, no banco em vez do `localStorage`.
 *
 * Sempre do usuário **da sessão**: nenhuma action aceita `userId` de
 * fora, senão qualquer pessoa logada leria ou reescreveria as
 * preferências de outra.
 */

export interface StoredPreferences {
  notifications: NotificationPrefs;
  somenteMinhas: boolean;
}

/** `LEITURA` basta: a preferência é da própria pessoa. */
async function contexto() {

  const ctx = await requireRole("LEITURA");

  return ctx
    ? { prisma: ctx.prisma, userId: ctx.userId }
    : null;
}

export async function getPreferences(): Promise<StoredPreferences | null> {

  /**
   * `tryRole` e não `contexto`: este provider monta no layout raiz, logo
   * roda também em `/login`, onde não há sessão. Lançar ali viraria 500
   * a cada visita à tela de login.
   */
  const ctx = await tryRole("LEITURA");

  if (!ctx) return null;

  const linha =
    await ctx.prisma.userPreference.findUnique({
      where: { userId: ctx.userId },
    });

  if (!linha) return null;

  return {
    // Espalhado sobre o padrão: aviso novo no código passa a valer sem
    // migrar as linhas já gravadas.
    notifications: {
      ...defaultPrefs,
      ...(linha.notifications as Partial<NotificationPrefs>),
    },
    somenteMinhas: linha.somenteMinhas,
  };
}

export async function savePreferences(
  input: StoredPreferences
) {

  const ctx = await contexto();

  if (!ctx) return;

  const dados = {
    notifications:
      input.notifications as unknown as object,
    somenteMinhas: input.somenteMinhas,
  };

  await ctx.prisma.userPreference.upsert({
    where: { userId: ctx.userId },
    update: dados,
    create: { userId: ctx.userId, ...dados },
  });
}
