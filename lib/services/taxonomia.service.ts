import type { PrismaClient } from "@prisma/client";

/**
 * O prazo da transação. O padrão do Prisma (5 s) não cabe: o banco fica em
 * São Paulo e cada comando custa uma ida e volta — a primeira unificação
 * passou de 5 s e foi desfeita inteira (nada ficou pela metade, que é o
 * motivo de ser uma transação).
 */
export const PRAZO_DA_TRANSACAO = { timeout: 60_000, maxWait: 15_000 };

/** Ids agrupados pelo mesmo destino — um updateMany por grupo, e não um update por caso. */
export function agruparPorDestino<T>(itens: T[], destino: (item: T) => { categoryId: string | null; subcategoryId: string | null }, id: (item: T) => string) {
  const grupos = new Map<string, { categoryId: string | null; subcategoryId: string | null; ids: string[] }>();
  for (const item of itens) {
    const d = destino(item);
    const chave = `${d.categoryId ?? ""}|${d.subcategoryId ?? ""}`;
    const g = grupos.get(chave) ?? { ...d, ids: [] };
    g.ids.push(id(item));
    grupos.set(chave, g);
  }
  return [...grupos.values()];
}

import {
  calcularUnificacao,
  CATEGORIAS_OFICIAIS,
  chaveDoNome,
  type CategoriaDoCadastro,
  type Unificacao,
} from "@/lib/models/taxonomia";

/**
 * Gravar e desfazer as trocas de categoria (1.131).
 *
 * A conta é de `calcularUnificacao` (sem banco, a mesma da prévia); aqui só
 * se lê o cadastro, se grava numa transação e se registra cada troca em
 * `ReclassificacaoDeCaso` — o que permite desfazer o lote inteiro.
 */

export async function lerCadastroDeCategorias(prisma: PrismaClient): Promise<CategoriaDoCadastro[]> {
  const [categorias, porCategoria, porSub] = await Promise.all([
    prisma.category.findMany({ orderBy: { order: "asc" }, include: { subcategories: { orderBy: { order: "asc" } } } }),
    prisma.case.groupBy({ by: ["categoryId"], _count: { _all: true } }),
    prisma.case.groupBy({ by: ["subcategoryId"], _count: { _all: true } }),
  ]);
  const nCat = new Map(porCategoria.map((g) => [g.categoryId, g._count._all]));
  const nSub = new Map(porSub.map((g) => [g.subcategoryId, g._count._all]));
  return categorias.map((c) => ({
    id: c.id,
    nome: c.name,
    ativa: c.active,
    casos: nCat.get(c.id) ?? 0,
    subcategorias: c.subcategories.map((s) => ({ id: s.id, nome: s.name, ativa: s.active, casos: nSub.get(s.id) ?? 0 })),
  }));
}

export async function preverUnificacao(prisma: PrismaClient): Promise<Unificacao> {
  const [cadastro, casos] = await Promise.all([
    lerCadastroDeCategorias(prisma),
    prisma.case.findMany({ select: { id: true, categoryId: true, subcategoryId: true } }),
  ]);
  return calcularUnificacao(cadastro, casos);
}

export interface ResultadoDaUnificacao {
  lote: string;
  casos: number;
  categoriasDesativadas: number;
  subcategoriasJuntadas: number;
  criadas: string[];
}

/**
 * Aplica a unificação numa transação só: ou tudo, ou nada.
 *
 * Ordem: cria as oficiais que faltam, muda as subcategorias que ficam para a
 * oficial, troca os casos, desativa o que saiu, renomeia as respostas
 * prontas e as regras de prazo que apontavam pelo nome, e registra cada
 * troca.
 */
export async function aplicarUnificacao(prisma: PrismaClient, por: string): Promise<ResultadoDaUnificacao> {
  const plano = await preverUnificacao(prisma);
  const lote = `unificacao-${new Date().toISOString()}`;

  /* As oficiais que faltam nascem antes, para ter id. */
  for (const nome of plano.criar) {
    const oficial = CATEGORIAS_OFICIAIS.findIndex((c) => c.nome === nome);
    await prisma.category.upsert({
      where: { name: nome },
      update: { active: true },
      create: { name: nome, description: CATEGORIAS_OFICIAIS[oficial]?.definicao ?? null, order: oficial + 1, active: true },
    });
  }

  const categorias = await prisma.category.findMany({ select: { id: true, name: true } });
  const idDaOficial = new Map(categorias.map((c) => [chaveDoNome(c.name), c.id]));
  const nomeDaCategoria = new Map(categorias.map((c) => [c.id, c.name]));
  const subcategorias = await prisma.subcategory.findMany({ select: { id: true, name: true } });
  const nomeDaSub = new Map(subcategorias.map((s) => [s.id, s.name]));
  const oficialId = (nome: string) => {
    const id = idDaOficial.get(chaveDoNome(nome));
    if (!id) throw new Error(`A categoria oficial "${nome}" não está no cadastro.`);
    return id;
  };

  const porDestino = agruparPorDestino(plano.trocas, (t) => ({ categoryId: oficialId(t.paraCategoria), subcategoryId: t.paraSubcategoriaId }), (t) => t.caseId);
  const subsPorDestino = new Map<string, string[]>();
  for (const m of plano.moverSubcategorias) subsPorDestino.set(oficialId(m.paraCategoria), [...(subsPorDestino.get(oficialId(m.paraCategoria)) ?? []), m.id]);
  /* Respostas prontas e regras de prazo apontam pelo nome: agrupadas pela oficial de destino. */
  const nomesPorDestino = new Map<string, string[]>();
  for (const m of plano.movimentos) nomesPorDestino.set(m.para, [...(nomesPorDestino.get(m.para) ?? []), m.nome]);

  await prisma.$transaction(async (tx) => {
    for (const [categoryId, ids] of subsPorDestino) await tx.subcategory.updateMany({ where: { id: { in: ids } }, data: { categoryId, active: true } });
    for (const g of porDestino) await tx.case.updateMany({ where: { id: { in: g.ids } }, data: { categoryId: g.categoryId, subcategoryId: g.subcategoryId } });
    await tx.subcategory.updateMany({ where: { id: { in: plano.desativarSubcategorias } }, data: { active: false } });
    await tx.category.updateMany({ where: { id: { in: plano.desativarCategorias } }, data: { active: false } });
    for (const [para, nomes] of nomesPorDestino) {
      await tx.macro.updateMany({ where: { category: { in: nomes } }, data: { category: para } });
      await tx.slaRule.updateMany({ where: { category: { in: nomes } }, data: { category: para } });
    }
    await tx.reclassificacaoDeCaso.createMany({
      data: plano.trocas.map((t) => ({
        caseId: t.caseId,
        lote,
        origem: "unificacao",
        deCategoriaId: t.deCategoriaId,
        deCategoria: t.deCategoriaId ? (nomeDaCategoria.get(t.deCategoriaId) ?? null) : null,
        deSubcategoriaId: t.deSubcategoriaId,
        deSubcategoria: t.deSubcategoriaId ? (nomeDaSub.get(t.deSubcategoriaId) ?? null) : null,
        paraCategoriaId: oficialId(t.paraCategoria),
        paraCategoria: t.paraCategoria,
        paraSubcategoriaId: t.paraSubcategoriaId,
        paraSubcategoria: t.paraSubcategoriaId ? (nomeDaSub.get(t.paraSubcategoriaId) ?? null) : null,
        motivo: "Unificação nas categorias da documentação",
        por,
      })),
    });
  }, PRAZO_DA_TRANSACAO);

  return {
    lote,
    casos: plano.trocas.length,
    categoriasDesativadas: plano.desativarCategorias.length,
    subcategoriasJuntadas: plano.desativarSubcategorias.length,
    criadas: plano.criar,
  };
}

/**
 * Desfaz um lote: cada caso volta para a categoria e a subcategoria de
 * antes, e o que tinha sido desativado volta a ficar ativo.
 *
 * A subcategoria que tinha mudado de categoria junto com a sua (a gêmea que
 * ficou) é reconhecida pelo próprio registro — mesmo id antes e depois,
 * categoria diferente — e volta para a categoria de origem.
 *
 * Caso que alguém mudou depois do lote não é tocado: desfazer por cima de
 * uma correção feita à mão seria apagar trabalho.
 */
export async function desfazerLote(prisma: PrismaClient, lote: string): Promise<{ desfeitas: number; preservadas: number }> {
  const linhas = await prisma.reclassificacaoDeCaso.findMany({ where: { lote, desfeitaEm: null } });
  if (linhas.length === 0) return { desfeitas: 0, preservadas: 0 };

  const casos = await prisma.case.findMany({ where: { id: { in: linhas.map((l) => l.caseId) } }, select: { id: true, categoryId: true, subcategoryId: true } });
  const agora = new Map(casos.map((c) => [c.id, c]));
  const intactas = linhas.filter((l) => {
    const c = agora.get(l.caseId);
    return c && c.categoryId === l.paraCategoriaId && c.subcategoryId === l.paraSubcategoriaId;
  });

  const subVolta = new Map<string, string>();
  for (const l of intactas) {
    if (l.deSubcategoriaId && l.deSubcategoriaId === l.paraSubcategoriaId && l.deCategoriaId && l.deCategoriaId !== l.paraCategoriaId) {
      subVolta.set(l.deSubcategoriaId, l.deCategoriaId);
    }
  }
  const reativarCategorias = [...new Set(intactas.map((l) => l.deCategoriaId).filter((x): x is string => Boolean(x)))];
  const reativarSubs = [...new Set(intactas.map((l) => l.deSubcategoriaId).filter((x): x is string => Boolean(x)))];

  const volta = agruparPorDestino(intactas, (l) => ({ categoryId: l.deCategoriaId, subcategoryId: l.deSubcategoriaId }), (l) => l.caseId);

  await prisma.$transaction(async (tx) => {
    for (const [id, categoryId] of subVolta) await tx.subcategory.update({ where: { id }, data: { categoryId } });
    for (const g of volta) await tx.case.updateMany({ where: { id: { in: g.ids } }, data: { categoryId: g.categoryId, subcategoryId: g.subcategoryId } });
    await tx.category.updateMany({ where: { id: { in: reativarCategorias } }, data: { active: true } });
    await tx.subcategory.updateMany({ where: { id: { in: reativarSubs } }, data: { active: true } });
    await tx.reclassificacaoDeCaso.updateMany({ where: { id: { in: intactas.map((l) => l.id) } }, data: { desfeitaEm: new Date() } });
    /* Desfazer uma aprovação devolve as propostas para a fila de decisão. */
    if (lote.startsWith("ia-")) {
      await tx.propostaDeCategoria.updateMany({ where: { caseId: { in: intactas.map((l) => l.caseId) }, status: "aceita" }, data: { status: "pendente", decididaEm: null, decididaPor: null } });
    }
  }, PRAZO_DA_TRANSACAO);

  return { desfeitas: intactas.length, preservadas: linhas.length - intactas.length };
}

export interface LoteDeReclassificacao {
  lote: string;
  origem: string;
  por: string;
  em: string;
  trocas: number;
  desfeito: boolean;
}

export async function lerLotes(prisma: PrismaClient): Promise<LoteDeReclassificacao[]> {
  const grupos = await prisma.reclassificacaoDeCaso.groupBy({
    by: ["lote", "origem", "por"],
    _count: { _all: true },
    _min: { em: true, desfeitaEm: true },
  });
  return grupos
    .map((g) => ({ lote: g.lote, origem: g.origem, por: g.por, em: (g._min.em ?? new Date()).toISOString(), trocas: g._count._all, desfeito: Boolean(g._min.desfeitaEm) }))
    .sort((a, b) => b.em.localeCompare(a.em));
}
