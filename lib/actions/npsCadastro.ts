"use server";

import { updateTag } from "next/cache";

import { requireRole, tryRole } from "@/lib/auth/guard";
import type { Modulo } from "@/lib/auth/modules";
import { WORKSPACE_TAG } from "@/lib/actions/tags";

import {
  ETAPAS_PADRAO,
  NpsKindOption,
  NpsStageOption,
  TIPOS_PADRAO,
} from "@/lib/models/nps";

import {
  gravarEtapa,
  gravarTipo,
  removerEtapa,
  removerTipo,
} from "@/lib/services/npsCadastro.service";

/** O módulo a que estas ações pertencem — ver lib/auth/modules.ts. */
const MODULO: Modulo = "nps";

/**
 * As etapas e os tipos do NPS, administrados pela operação.
 *
 * Eram duas listas fixas em `lib/models/nps.ts` — as quatro colunas do
 * quadro e os sete tipos do guia. Viraram cadastro pelo mesmo motivo do
 * `WorkflowStatus` do Reclame Aqui e da causa raiz do próprio NPS: o
 * processo muda, e etapa nova não pode depender de deploy.
 *
 * **Banco vazio devolve os valores de partida**, com id derivado da
 * posição (`padrao-etapa-3`). É o que faz a tela funcionar antes de
 * qualquer cadastro e no modo demonstração, sem um caso especial dentro
 * de cada formulário. Editar um deles materializa a lista inteira.
 *
 * A regra em si mora em `lib/services/npsCadastro.service.ts`: aqui
 * ficam só sessão, papel e invalidação de cache. É o que permite
 * `npm run check:nps-etapas` exercitar exatamente o código que a tela
 * usa, em vez de uma cópia dele.
 */

/* ============================================================
   ETAPAS
============================================================ */

export async function listNpsStages(): Promise<
  NpsStageOption[]
> {

  const ctx = await tryRole("LEITURA", MODULO);

  if (!ctx) return ETAPAS_PADRAO;

  const linhas = await ctx.prisma.npsStage.findMany({
    orderBy: [{ order: "asc" }, { name: "asc" }],
  });

  if (linhas.length === 0) return ETAPAS_PADRAO;

  return linhas.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description ?? undefined,
    color: r.color,
    order: r.order,
    active: r.active,
    final: r.final,
    kinds: r.kinds,
  }));
}

export async function saveNpsStage(
  input: NpsStageOption
) {

  const ctx = await requireRole("AGENTE", MODULO);

  if (!ctx) return null;

  const id = await gravarEtapa(ctx.prisma, input);

  updateTag(WORKSPACE_TAG);

  return id;
}

export async function removeNpsStage(id: string) {

  const ctx = await requireRole("AGENTE", MODULO);

  if (!ctx || id.startsWith("padrao-")) return;

  const emUso = await removerEtapa(ctx.prisma, id);

  updateTag(WORKSPACE_TAG);

  return emUso;
}

/* ============================================================
   TIPOS
============================================================ */

export async function listNpsKinds(): Promise<
  NpsKindOption[]
> {

  const ctx = await tryRole("LEITURA", MODULO);

  if (!ctx) return TIPOS_PADRAO;

  const linhas = await ctx.prisma.npsKind.findMany({
    orderBy: [{ order: "asc" }, { name: "asc" }],
  });

  if (linhas.length === 0) return TIPOS_PADRAO;

  return linhas.map((r) => ({
    id: r.id,
    name: r.name,
    emoji: r.emoji,
    color: r.color,
    action: r.action,
    requiresConfirmation: r.requiresConfirmation,
    requiresRootCause: r.requiresRootCause,
    opensProcessReview: r.opensProcessReview,
    ownDeadlineHours: r.ownDeadlineHours ?? undefined,
    order: r.order,
    active: r.active,
  }));
}

export async function saveNpsKind(input: NpsKindOption) {

  const ctx = await requireRole("AGENTE", MODULO);

  if (!ctx) return null;

  const id = await gravarTipo(ctx.prisma, input);

  updateTag(WORKSPACE_TAG);

  return id;
}

export async function removeNpsKind(id: string) {

  const ctx = await requireRole("AGENTE", MODULO);

  if (!ctx || id.startsWith("padrao-")) return;

  const emUso = await removerTipo(ctx.prisma, id);

  updateTag(WORKSPACE_TAG);

  return emUso;
}
