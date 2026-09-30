"use server";

import { tryRole } from "@/lib/auth/guard";
import { backupDiarioLigado } from "@/lib/services/backup.service";

/** Se a cópia diária está ligada — para o cartão dizer a verdade (1.99). */
export async function estadoDoBackup(): Promise<{ admin: boolean; diario: boolean }> {
  const ctx = await tryRole("ADMIN").catch(() => null);
  return { admin: Boolean(ctx), diario: backupDiarioLigado() };
}
