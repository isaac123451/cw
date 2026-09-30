"use server";

import { tryRole } from "@/lib/auth/guard";
import { lerPaineis, type PainelDoPortal } from "@/lib/services/painelDoPortal.service";

/** O painel oficial do Reclame Aqui, o mais recente de cada período (1.86). */
export async function lerPainelDoPortal(): Promise<
  { ok: true; atuais: Record<string, PainelDoPortal>; historico: PainelDoPortal[] } | { ok: false; erro: string }
> {
  const ctx = await tryRole("LEITURA").catch(() => null);
  if (!ctx) return { ok: false, erro: "Entre na aplicação para ver o painel do portal." };
  try {
    return { ok: true, ...(await lerPaineis(ctx.prisma)) };
  } catch (erro) {
    console.error("[painel-do-portal]", erro);
    return { ok: false, erro: "O banco não respondeu agora." };
  }
}
