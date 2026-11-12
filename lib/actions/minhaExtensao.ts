"use server";

import { extensaoDaPessoa } from "@/lib/api/extensao";
import { tryRole } from "@/lib/auth/guard";
import type { ExtensaoVista } from "@/lib/models/versaoDaExtensao";

/**
 * A última versão da extensão vista para quem está na sessão (12/11/2026,
 * 1.1.74). O sino compara com a versão da plataforma; o primeiro acesso
 * marca o passo da extensão. Sem sessão, sem banco ou antes do db:push:
 * null, e nada aparece.
 */
export async function minhaExtensao(): Promise<ExtensaoVista | null> {
  const ctx = await tryRole("LEITURA").catch(() => null);
  if (!ctx) return null;
  return extensaoDaPessoa(ctx.prisma, ctx.userId).catch(() => null);
}
