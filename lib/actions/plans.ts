"use server";

import { updateTag } from "next/cache";

import { requireRole, tryRole } from "@/lib/auth/guard";
import type { Modulo } from "@/lib/auth/modules";
import { WORKSPACE_TAG } from "@/lib/actions/tags";

import {
  PLANOS_PADRAO,
  PlanOption,
} from "@/lib/models/plan";

/** O módulo a que estas ações pertencem — ver lib/auth/modules.ts. */
const MODULO: Modulo = "configuracoes";

/**
 * Planos e módulos, administrados pela operação.
 *
 * Gravar exige **AGENTE**: é a tabela de preço que a operação usa para
 * responder consumidor, e ela muda com mais frequência do que um deploy.
 *
 * Banco vazio devolve os valores de partida da central de ajuda, com id
 * derivado da posição — mesma regra da causa raiz e das etapas do NPS:
 * a tela funciona antes de qualquer cadastro, sem um caso especial
 * dentro do formulário.
 */

export async function listPlans(): Promise<
  PlanOption[]
> {

  const ctx = await tryRole("LEITURA", MODULO);

  const padrao = PLANOS_PADRAO.map((item, i) => ({
    ...item,
    id: `padrao-plano-${i}`,
  }));

  if (!ctx) return padrao;

  const linhas = await ctx.prisma.plan.findMany({
    orderBy: [
      { kind: "asc" },
      { order: "asc" },
      { name: "asc" },
    ],
  });

  if (linhas.length === 0) return padrao;

  return linhas.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description ?? undefined,
    kind: r.kind as PlanOption["kind"],
    priceCents: r.priceCents,
    features: r.features,
    order: r.order,
    active: r.active,
  }));
}

export async function savePlan(input: PlanOption) {

  const ctx = await requireRole("AGENTE", MODULO);

  if (!ctx) return null;

  const nome = input.name.trim();

  if (nome === "") return null;

  const dados = {
    name: nome,
    description: input.description?.trim() || null,
    kind: input.kind,
    priceCents: Math.max(
      Math.round(input.priceCents),
      0
    ),
    features: input.features
      .map((f) => f.trim())
      .filter(Boolean),
    order: input.order,
    active: input.active,
  };

  const novo =
    !input.id ||
    input.id.startsWith("padrao-") ||
    input.id.startsWith("novo-");

  if (novo) {

    const criado = await ctx.prisma.plan.create({
      data: dados,
      select: { id: true },
    });

    await semearRestantes(ctx.prisma, nome);

    updateTag(WORKSPACE_TAG);

    return criado.id;
  }

  await ctx.prisma.plan.update({
    where: { id: input.id },
    data: dados,
  });

  updateTag(WORKSPACE_TAG);

  return input.id;
}

/**
 * Ao gravar o primeiro, materializa os de partida.
 *
 * Sem isto, criar um plano novo faria os oito da central de ajuda
 * sumirem de uma vez — a listagem deixa de cair no padrão assim que
 * existe qualquer linha no banco.
 */
async function semearRestantes(
  prisma: NonNullable<
    Awaited<ReturnType<typeof requireRole>>
  >["prisma"],
  exceto: string
) {

  const total = await prisma.plan.count();

  if (total > 1) return;

  await prisma.plan.createMany({
    data: PLANOS_PADRAO.filter(
      (item) => item.name !== exceto
    ),
    skipDuplicates: true,
  });
}

/**
 * Remove — de verdade.
 *
 * Diferente da causa raiz e das etapas do NPS: aqui nada aponta para o
 * registro. Plano só é lido para montar a tabela de preços na hora da
 * inserção da macro, então apagar não reescreve passado nenhum. Quem
 * quiser guardar o histórico desativa.
 */
export async function removePlan(id: string) {

  const ctx = await requireRole("AGENTE", MODULO);

  if (!ctx || id.startsWith("padrao-")) return;

  await ctx.prisma.plan
    .delete({ where: { id } })
    .catch(() => {});

  updateTag(WORKSPACE_TAG);
}
