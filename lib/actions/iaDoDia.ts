"use server";

import { updateTag } from "next/cache";

import { requireRole, SemPermissao } from "@/lib/auth/guard";
import { CASES_TAG, WORKSPACE_TAG } from "@/lib/actions/tags";
import type { AcaoDaIAView } from "@/lib/models/iaDoDia";
import { acoesDeHoje, acoesNaoVistas, desfazer, marcarVistas, rodarIaDoDia } from "@/lib/services/iaDoDia.service";

/**
 * A IA do dia, pela tela (08/10/2026) — ver `lib/models/iaDoDia.ts`.
 *
 * Quem chama é o vigia que mora no layout: ao abrir a plataforma e a cada
 * poucos minutos. A rodada é cara (conversas, agenda, IA), então cada
 * pessoa roda no máximo a cada 5 minutos por instância do servidor.
 */

const INTERVALO_MS = 5 * 60_000;
const ultimaRodada = new Map<string, number>();

type Resultado<T> = { ok: true } & T | { ok: false; erro: string };

async function contexto() {
  try {
    return await requireRole("AGENTE");
  } catch (erro) {
    if (erro instanceof SemPermissao) return null;
    throw erro;
  }
}

/** Roda (se já passou o intervalo) e devolve o que ainda não foi mostrado. */
export async function rodarAIaDoDia(): Promise<Resultado<{ novas: AcaoDaIAView[] }>> {
  const ctx = await contexto();
  if (!ctx) return { ok: true, novas: [] };
  try {
    const agora = Date.now();
    if (agora - (ultimaRodada.get(ctx.userId) ?? 0) >= INTERVALO_MS) {
      ultimaRodada.set(ctx.userId, agora);
      await rodarIaDoDia(ctx.prisma, ctx.userId);
      /* Lembrete criado, atividade fechada e anotação mudam a agenda e as fichas. */
      updateTag(WORKSPACE_TAG);
      updateTag(CASES_TAG);
    }
    return { ok: true, novas: await acoesNaoVistas(ctx.prisma, ctx.userId) };
  } catch (erro) {
    /* Sem a tabela ainda (antes do db:push) ou banco recusando: a IA do dia só não aparece. */
    console.error("[ia do dia] rodada", erro);
    return { ok: false, erro: "A IA do dia não rodou agora." };
  }
}

export async function marcarAcoesVistas(ids: string[]): Promise<Resultado<object>> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Entre na aplicação." };
  try {
    await marcarVistas(ctx.prisma, ctx.userId, ids.slice(0, 50));
    return { ok: true };
  } catch {
    return { ok: false, erro: "Não deu para marcar agora." };
  }
}

export async function desfazerAcaoDaIA(id: string): Promise<Resultado<object>> {
  const ctx = await contexto();
  if (!ctx) return { ok: false, erro: "Entre na aplicação." };
  try {
    const r = await desfazer(ctx.prisma, ctx.userId, id);
    if (r.ok) {
      updateTag(WORKSPACE_TAG);
      updateTag(CASES_TAG);
    }
    return r;
  } catch {
    return { ok: false, erro: "O banco não aceitou agora — tente de novo." };
  }
}

export async function lerAcoesDeHoje(): Promise<Resultado<{ acoes: AcaoDaIAView[] }>> {
  const ctx = await contexto();
  if (!ctx) return { ok: true, acoes: [] };
  try {
    return { ok: true, acoes: await acoesDeHoje(ctx.prisma, ctx.userId) };
  } catch {
    return { ok: false, erro: "Não deu para ler o que a IA fez hoje." };
  }
}
