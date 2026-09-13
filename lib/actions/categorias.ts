"use server";

import { updateTag } from "next/cache";

import { CASES_TAG, WORKSPACE_TAG } from "@/lib/actions/tags";
import { requireRole, SemPermissao, tryRole } from "@/lib/auth/guard";

import type { CategoriaContada } from "@/lib/models/categorias";
import type { CategoryOption, SubcategoryOption } from "@/lib/models/settings";

/**
 * Contar e unificar categorias — a ferramenta com prévia.
 *
 * Unificar mexe em quatro lugares que guardam a categoria: os casos
 * (pelo id), as subcategorias (pertencem a uma categoria), as respostas
 * prontas e as regras de prazo (pelo nome). As de origem ficam
 * **desativadas**, sem casos — nada é excluído, e reativar é um clique.
 */

type Falha = { ok: false; erro: string };

export async function contarCategorias(): Promise<CategoriaContada[]> {

  const ctx = await tryRole("LEITURA");
  if (!ctx) return [];

  const [categorias, casos, subcategorias, macros, regras] = await Promise.all([
    ctx.prisma.category.findMany({ orderBy: { order: "asc" } }),
    ctx.prisma.case.groupBy({ by: ["categoryId"], _count: { _all: true } }),
    ctx.prisma.subcategory.groupBy({ by: ["categoryId"], _count: { _all: true } }),
    ctx.prisma.macro.groupBy({ by: ["category"], _count: { _all: true } }),
    ctx.prisma.slaRule.groupBy({ by: ["category"], _count: { _all: true } }),
  ]);

  const mapa = (lista: { chave: string | null; n: number }[]) => new Map(lista.map((l) => [l.chave, l.n]));

  const porCaso = mapa(casos.map((l) => ({ chave: l.categoryId, n: l._count._all })));
  const porSub = mapa(subcategorias.map((l) => ({ chave: l.categoryId, n: l._count._all })));
  const porMacro = mapa(macros.map((l) => ({ chave: l.category, n: l._count._all })));
  const porRegra = mapa(regras.map((l) => ({ chave: l.category, n: l._count._all })));

  return categorias.map((c) => ({
    id: c.id,
    nome: c.name,
    ativa: c.active,
    casos: porCaso.get(c.id) ?? 0,
    subcategorias: porSub.get(c.id) ?? 0,
    macros: porMacro.get(c.name) ?? 0,
    regras: porRegra.get(c.name) ?? 0,
  }));
}

export async function unificarCategorias(entrada: {
  destinoId: string;
  origemIds: string[];
}): Promise<
  | {
      ok: true;
      casos: number;
      subcategoriasMovidas: number;
      subcategoriasFundidas: number;
      macros: number;
      regras: number;
      desativadas: string[];
      categorias: CategoryOption[];
      subcategorias: SubcategoryOption[];
    }
  | Falha
> {

  const origemIds = [...new Set(entrada.origemIds)].filter((id) => id !== entrada.destinoId);

  if (origemIds.length === 0) return { ok: false, erro: "Escolha ao menos uma categoria para juntar ao destino." };

  let ctx;

  try {
    ctx = await requireRole("ADMIN");
  } catch (erro) {
    return { ok: false, erro: erro instanceof SemPermissao ? erro.message : "Não foi possível confirmar sua sessão." };
  }

  if (!ctx) return { ok: false, erro: "Sem banco configurado." };

  try {
    const [destino, origens] = await Promise.all([
      ctx.prisma.category.findUnique({ where: { id: entrada.destinoId }, include: { subcategories: true } }),
      ctx.prisma.category.findMany({ where: { id: { in: origemIds } }, include: { subcategories: true } }),
    ]);

    if (!destino) return { ok: false, erro: "A categoria de destino não existe mais." };
    if (origens.length !== origemIds.length) return { ok: false, erro: "Alguma das categorias escolhidas não existe mais — recarregue a tela." };

    /*
      Subcategorias primeiro: os casos apontam para elas, e a de mesmo
      nome no destino tem de receber os casos antes de a de origem sair.
    */
    let subcategoriasMovidas = 0;
    let subcategoriasFundidas = 0;

    const doDestino = new Map(destino.subcategories.map((s) => [s.name.trim().toLowerCase(), s]));

    for (const origem of origens) {
      for (const sub of origem.subcategories) {

        const gemea = doDestino.get(sub.name.trim().toLowerCase());

        if (gemea) {
          await ctx.prisma.case.updateMany({ where: { subcategoryId: sub.id }, data: { subcategoryId: gemea.id } });
          await ctx.prisma.subcategory.update({ where: { id: sub.id }, data: { active: false } });
          subcategoriasFundidas += 1;
        } else {
          const movida = await ctx.prisma.subcategory.update({
            where: { id: sub.id },
            data: { categoryId: destino.id },
          });
          doDestino.set(movida.name.trim().toLowerCase(), movida);
          subcategoriasMovidas += 1;
        }
      }
    }

    const casos = await ctx.prisma.case.updateMany({
      where: { categoryId: { in: origemIds } },
      data: { categoryId: destino.id },
    });

    const nomes = origens.map((o) => o.name);

    const macros = await ctx.prisma.macro.updateMany({
      where: { category: { in: nomes } },
      data: { category: destino.name },
    });

    const regras = await ctx.prisma.slaRule.updateMany({
      where: { category: { in: nomes } },
      data: { category: destino.name },
    });

    await ctx.prisma.category.updateMany({
      where: { id: { in: origemIds } },
      data: { active: false },
    });

    /* As listas novas, para a tela trocar as suas sem recarregar a página. */
    const [categorias, subcategorias] = await Promise.all([
      ctx.prisma.category.findMany({ orderBy: { order: "asc" } }),
      ctx.prisma.subcategory.findMany({ include: { category: { select: { name: true } } }, orderBy: { order: "asc" } }),
    ]);

    updateTag(CASES_TAG);
    updateTag(WORKSPACE_TAG);

    return {
      ok: true,
      casos: casos.count,
      subcategoriasMovidas,
      subcategoriasFundidas,
      macros: macros.count,
      regras: regras.count,
      desativadas: nomes,
      categorias: categorias.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description ?? "",
        order: r.order,
        active: r.active,
        ceilingHours: r.ceilingHours ?? undefined,
      })),
      subcategorias: subcategorias.map((r) => ({
        id: r.id,
        category: r.category.name,
        name: r.name,
        description: r.description ?? "",
        order: r.order,
        active: r.active,
      })),
    };
  } catch (erro) {
    console.error("[categorias] unificar", erro);
    /*
      Os passos são sequenciais (o pooler não aceita transação longa) e
      cada um pode ser repetido sem estrago: rodar de novo a mesma
      unificação termina o que faltou.
    */
    return {
      ok: false,
      erro: "A unificação parou no meio. Rode de novo com a mesma escolha — cada passo pode ser repetido e completa o que faltou.",
    };
  }
}
