"use server";

import { requireRole, tryRole } from "@/lib/auth/guard";
import type { Modulo } from "@/lib/auth/modules";

import type { CaseFilters } from "@/lib/context/CaseContext";

/** O módulo a que estas ações pertencem — ver lib/auth/modules.ts. */
const MODULO: Modulo = "reclame-aqui";

/**
 * Filtros salvos, no banco em vez do `localStorage`.
 *
 * Antes eram por dispositivo: quem salvava "meus aguardando réplica" no
 * desktop não achava no notebook. Agora seguem a conta.
 *
 * Sempre do usuário **da sessão** — nenhuma action aceita `ownerId` de
 * fora, senão qualquer pessoa logada leria (ou apagaria) o filtro de
 * outra trocando o valor.
 */

/** `LEITURA` basta: o filtro é da própria pessoa. */
async function contexto() {

  const ctx = await requireRole("LEITURA", MODULO);

  return ctx
    ? { prisma: ctx.prisma, userId: ctx.userId }
    : null;
}

export interface StoredFilter {
  id: string;
  name: string;
  criteria: CaseFilters;
  order: number;
}

export async function listSavedFilters(): Promise<
  StoredFilter[]
> {

  // `tryRole`: o provider monta no layout raiz e roda em `/login` também.
  const ctx = await tryRole("LEITURA", MODULO);

  if (!ctx) return [];

  const linhas = await ctx.prisma.savedFilter.findMany({
    // Os pré-definidos vivem no código (`BUILT_IN_FILTERS`); aqui só o
    // que a pessoa criou, mais o que a operação marcou como compartilhado.
    where: {
      builtIn: false,
      OR: [
        { ownerId: ctx.userId },
        { shared: true },
      ],
    },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });

  return linhas.map((item) => ({
    id: item.id,
    name: item.name,
    criteria: item.criteria as unknown as CaseFilters,
    order: item.order,
  }));
}

export async function saveSavedFilter(input: {
  name: string;
  criteria: CaseFilters;
}) {

  const ctx = await contexto();

  if (!ctx) return null;

  const nome = input.name.trim();

  if (nome === "") return null;

  /**
   * Mesmo nome sobrescreve, como fazia no `localStorage` — mas só entre
   * os filtros da própria pessoa: dois usuários podem ter um "Urgentes"
   * cada um, sem um pisar no outro.
   */
  const existente =
    await ctx.prisma.savedFilter.findFirst({
      where: {
        ownerId: ctx.userId,
        builtIn: false,
        name: { equals: nome, mode: "insensitive" },
      },
      select: { id: true },
    });

  const criteria =
    input.criteria as unknown as object;

  if (existente) {
    await ctx.prisma.savedFilter.update({
      where: { id: existente.id },
      data: { criteria },
    });

    return existente.id;
  }

  const total = await ctx.prisma.savedFilter.count({
    where: { ownerId: ctx.userId },
  });

  const criado = await ctx.prisma.savedFilter.create({
    data: {
      name: nome,
      criteria,
      order: total,
      ownerId: ctx.userId,
      builtIn: false,
    },
    select: { id: true },
  });

  return criado.id;
}

export async function deleteSavedFilter(id: string) {

  const ctx = await contexto();

  if (!ctx) return;

  // `deleteMany` com o dono no filtro: um id de outra pessoa não apaga
  // nada, em vez de estourar erro ou apagar o que não é seu.
  await ctx.prisma.savedFilter.deleteMany({
    where: { id, ownerId: ctx.userId },
  });
}
