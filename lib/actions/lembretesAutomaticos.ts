"use server";

import { updateTag } from "next/cache";

import { requireRole, SemPermissao } from "@/lib/auth/guard";
import type { AgendaTask } from "@/lib/models/agenda";
import { criarLembretesAutomaticos } from "@/lib/services/lembretesAutomaticos.service";
import { registrarLembretes } from "@/lib/services/iaDoDia.service";
import { WORKSPACE_TAG } from "@/lib/actions/tags";

/**
 * Cria os lembretes que nascem sozinhos e devolve os que nasceram agora.
 *
 * Roda quando a Agenda abre — quem chama mostra o que nasceu, com
 * desfazer. A regra mora em `lembretesAutomaticos.service`.
 */
export async function gerarLembretesAutomaticos(): Promise<{ ok: true; criados: AgendaTask[] } | { ok: false; erro: string }> {

  let ctx;
  try {
    ctx = await requireRole("AGENTE");
  } catch (erro) {
    return { ok: false, erro: erro instanceof SemPermissao ? erro.message : "Não foi possível confirmar sua sessão." };
  }
  if (!ctx) return { ok: true, criados: [] };

  try {
    const criados = await criarLembretesAutomaticos(ctx.prisma, ctx.userId);
    if (criados.length) {
      /* O que nasceu fica registrado como ação da IA do dia — com o mesmo desfazer. */
      await registrarLembretes(ctx.prisma, ctx.userId, criados).catch(() => {});
      updateTag(WORKSPACE_TAG);
    }
    return { ok: true, criados };
  } catch (erro) {
    console.error("[agenda] lembretes automáticos", erro);
    return { ok: false, erro: "O banco não aceitou agora. Os lembretes automáticos tentam de novo na próxima vez que a Agenda abrir." };
  }
}
