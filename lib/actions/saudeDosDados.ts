"use server";

import { tryRole } from "@/lib/auth/guard";
import { achadosDaBase, type AchadoDaBase } from "@/lib/models/saudeDosDados";
import { lerEntradaDaSaude } from "@/lib/services/saudeDosDados.service";

/**
 * A saúde dos dados (out/2026) — ver `lib/models/saudeDosDados.ts`.
 *
 * Só para quem administra, e só leitura: devolve os achados; corrigir é na
 * tela de cada registro.
 */
export async function lerSaudeDosDados(): Promise<{ ok: true; admin: boolean; achados: AchadoDaBase[] } | { ok: false; erro: string }> {
  const ctx = await tryRole("ADMIN").catch(() => null);
  if (!ctx) return { ok: true, admin: false, achados: [] };

  try {
    return { ok: true, admin: true, achados: achadosDaBase(await lerEntradaDaSaude(ctx.prisma)) };
  } catch (erro) {
    console.error("[saúde dos dados]", erro);
    return { ok: false, erro: "O banco não respondeu agora. Tente de novo em instantes." };
  }
}
