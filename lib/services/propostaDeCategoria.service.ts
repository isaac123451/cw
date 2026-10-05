import type { PrismaClient } from "@prisma/client";

import { CATEGORIAS_OFICIAIS, chaveDaSubcategoria, chaveDoNome, NOMES_OFICIAIS } from "@/lib/models/taxonomia";
import { pedirEstruturado } from "@/lib/services/ia.service";
import { agruparPorDestino, PRAZO_DA_TRANSACAO } from "@/lib/services/taxonomia.service";

/**
 * A IA lê o relato e propõe a categoria (1.131/1.132).
 *
 * A sugestão por texto que já existia acerta 65% — ela aprende com as
 * categorias gravadas, que eram justamente o problema. Aqui o modelo lê o
 * título e o relato e escolhe entre as oficiais, com as definições que
 * separam uma da vizinha, e a subcategoria entre as que existem na
 * categoria escolhida.
 *
 * **Nada muda sozinho.** O resultado é uma `PropostaDeCategoria`
 * pendente; a troca só acontece quando alguém aceita na tela.
 */

/** Quantas reclamações por pedido: cabem no relógio da rota e no limite do modelo. */
export const POR_PEDIDO = 6;
const TAMANHO_DO_RELATO = 1400;

export type Confianca = "alta" | "media" | "baixa";

export interface Taxonomia {
  /** categoria oficial → subcategorias ativas dela. */
  subcategorias: Map<string, string[]>;
}

export async function lerTaxonomia(prisma: PrismaClient): Promise<Taxonomia> {
  const categorias = await prisma.category.findMany({
    where: { active: true },
    include: { subcategories: { where: { active: true }, orderBy: { order: "asc" } } },
  });
  const subcategorias = new Map<string, string[]>();
  for (const nome of NOMES_OFICIAIS) {
    const c = categorias.find((x) => chaveDoNome(x.name) === chaveDoNome(nome));
    subcategorias.set(nome, (c?.subcategories ?? []).map((s) => s.name).filter((n) => chaveDoNome(n) !== "nao classificado"));
  }
  return { subcategorias };
}

export function instrucaoDoSistema(t: Taxonomia) {
  const linhas = CATEGORIAS_OFICIAIS.map((c) => {
    const subs = t.subcategorias.get(c.nome) ?? [];
    return `- ${c.nome}: ${c.definicao}${subs.length ? `\n  Subcategorias: ${subs.join(" | ")}` : ""}`;
  });
  return `Você classifica reclamações do Reclame Aqui contra a Cardápio Web — sistema para restaurantes (PDV, cardápio digital, KDS, impressão de pedidos, WhatsApp e robô, integrações de delivery, módulo fiscal).

Para cada reclamação, escolha a CATEGORIA pelo problema principal de que o cliente reclama — o que motivou a reclamação —, não por algo citado de passagem. Quem reclama que o sistema parou e o suporte não resolveu tem um problema de Sistema (ou de Impressão, WhatsApp…), não de Atendimento. Atendimento é quando a queixa é o atendimento em si.

Categorias (use exatamente um destes nomes):
${linhas.join("\n")}

SUBCATEGORIA: escolha a da lista da categoria escolhida que melhor descreve o caso, copiando o nome exatamente como está. Se nenhuma servir, devolva "".

CONFIANÇA: "alta" quando o relato deixa claro o problema principal; "media" quando há dois problemas fortes; "baixa" quando o relato é vago.

MOTIVO: uma frase curta, em português, citando o trecho do relato que decidiu.`;
}

const ESQUEMA = {
  type: "object",
  properties: {
    itens: {
      type: "array",
      items: {
        type: "object",
        properties: {
          protocolo: { type: "string" },
          categoria: { type: "string", enum: NOMES_OFICIAIS },
          subcategoria: { type: "string" },
          confianca: { type: "string", enum: ["alta", "media", "baixa"] },
          motivo: { type: "string" },
        },
        required: ["protocolo", "categoria", "subcategoria", "confianca", "motivo"],
      },
    },
  },
  required: ["itens"],
};

export interface CasoParaClassificar {
  id: string;
  protocolo: string;
  titulo: string;
  relato: string;
  categoria: string | null;
  subcategoria: string | null;
}

export interface Proposta {
  caseId: string;
  categoria: string;
  subcategoria: string | null;
  confianca: Confianca;
  motivo: string;
}

/**
 * Confere a resposta do modelo: categoria fora da lista é descartada, e a
 * subcategoria só vale se existir na categoria escolhida (comparada sem
 * maiúscula e acento) — senão a proposta segue sem subcategoria.
 */
export function validarPropostas(brutas: unknown, casos: CasoParaClassificar[], t: Taxonomia): Proposta[] {
  const lista = Array.isArray((brutas as { itens?: unknown })?.itens) ? ((brutas as { itens: unknown[] }).itens as Record<string, unknown>[]) : [];
  const porProtocolo = new Map(casos.map((c) => [c.protocolo, c]));
  const saida: Proposta[] = [];
  for (const item of lista) {
    const caso = porProtocolo.get(String(item?.protocolo ?? "").trim());
    if (!caso || saida.some((p) => p.caseId === caso.id)) continue;
    const categoria = NOMES_OFICIAIS.find((n) => chaveDoNome(n) === chaveDoNome(String(item.categoria ?? "")));
    if (!categoria) continue;
    const pedida = chaveDaSubcategoria(String(item.subcategoria ?? ""));
    const subcategoria = pedida ? ((t.subcategorias.get(categoria) ?? []).find((s) => chaveDaSubcategoria(s) === pedida) ?? null) : null;
    const confianca = (["alta", "media", "baixa"] as const).find((c) => c === item.confianca) ?? "baixa";
    saida.push({ caseId: caso.id, categoria, subcategoria, confianca, motivo: String(item.motivo ?? "").trim().slice(0, 300) || "—" });
  }
  return saida;
}

/** A proposta é igual ao que o caso já tem? Categoria e subcategoria, sem olhar grafia. */
export function mesmaClassificacao(p: { categoria: string; subcategoria: string | null }, caso: { categoria: string | null; subcategoria: string | null }) {
  return chaveDoNome(p.categoria) === chaveDoNome(caso.categoria ?? "") && chaveDaSubcategoria(p.subcategoria ?? "") === chaveDaSubcategoria(caso.subcategoria ?? "");
}

/** As próximas reclamações sem proposta, das mais recentes para as mais antigas. */
export async function proximasSemProposta(prisma: PrismaClient, quantas: number): Promise<{ casos: CasoParaClassificar[]; restantes: number }> {
  const where = { channel: "RECLAME_AQUI" as const, propostaDeCategoria: { is: null } };
  const [linhas, restantes] = await Promise.all([
    prisma.case.findMany({
      where,
      orderBy: { publishedAt: "desc" },
      take: quantas,
      select: { id: true, protocol: true, title: true, description: true, category: { select: { name: true } }, subcategory: { select: { name: true } } },
    }),
    prisma.case.count({ where }),
  ]);
  return {
    casos: linhas.map((l) => ({
      id: l.id,
      protocolo: l.protocol,
      titulo: l.title,
      relato: (l.description ?? "").replace(/\s+/g, " ").trim().slice(0, TAMANHO_DO_RELATO),
      categoria: l.category?.name ?? null,
      subcategoria: l.subcategory?.name ?? null,
    })),
    restantes,
  };
}

export interface ResultadoDoLote {
  ok: boolean;
  erro?: string;
  classificadas: number;
  diferentes: number;
  restantes: number;
  modelo?: string;
}

/** Um pedido à IA: as próximas reclamações sem proposta, e as propostas gravadas. */
export async function proporLote(prisma: PrismaClient): Promise<ResultadoDoLote> {
  const { casos, restantes } = await proximasSemProposta(prisma, POR_PEDIDO);
  if (casos.length === 0) return { ok: true, classificadas: 0, diferentes: 0, restantes: 0 };

  const t = await lerTaxonomia(prisma);
  const prompt = casos
    .map((c) => `PROTOCOLO: ${c.protocolo}\nTÍTULO: ${c.titulo}\nRELATO: ${c.relato || "(sem relato)"}`)
    .join("\n\n---\n\n");

  const r = await pedirEstruturado({ sistema: instrucaoDoSistema(t), prompt, esquema: ESQUEMA });
  if (r.erro) return { ok: false, erro: r.erro, classificadas: 0, diferentes: 0, restantes };

  const propostas = validarPropostas(r.dados, casos, t);
  if (propostas.length === 0) return { ok: false, erro: "A IA respondeu, mas sem nenhuma classificação válida — tente de novo.", classificadas: 0, diferentes: 0, restantes, modelo: r.modelo };

  const porId = new Map(casos.map((c) => [c.id, c]));
  let diferentes = 0;
  await prisma.$transaction(
    propostas.map((p) => {
      const caso = porId.get(p.caseId)!;
      const igual = mesmaClassificacao(p, caso);
      if (!igual) diferentes += 1;
      const dados = {
        categoria: p.categoria,
        subcategoria: p.subcategoria,
        confianca: p.confianca,
        motivo: p.motivo,
        categoriaAtual: caso.categoria,
        subcategoriaAtual: caso.subcategoria,
        status: igual ? "igual" : "pendente",
        modelo: r.modelo ?? null,
        geradaEm: new Date(),
        decididaEm: null,
        decididaPor: null,
      };
      return prisma.propostaDeCategoria.upsert({ where: { caseId: p.caseId }, update: dados, create: { caseId: p.caseId, ...dados }, select: { id: true } });
    })
  );

  return { ok: true, classificadas: propostas.length, diferentes, restantes: Math.max(0, restantes - propostas.length), modelo: r.modelo };
}

/* ============================================================
   DECIDIR — aceitar grava a troca, com registro; recusar só marca
============================================================ */

export interface ResultadoDaDecisao {
  lote: string | null;
  aplicadas: number;
  recusadas: number;
  /** Caso mudado por alguém depois da proposta: não se aplica por cima; volta para a fila da IA. */
  desatualizadas: number;
}

export async function decidirPropostas(prisma: PrismaClient, ids: string[], decisao: "aceitar" | "recusar", por: string): Promise<ResultadoDaDecisao> {
  const propostas = await prisma.propostaDeCategoria.findMany({
    where: { id: { in: ids }, status: "pendente" },
    include: { case: { select: { id: true, categoryId: true, subcategoryId: true, category: { select: { name: true } }, subcategory: { select: { name: true } } } } },
  });
  const agora = new Date();

  if (decisao === "recusar") {
    await prisma.propostaDeCategoria.updateMany({ where: { id: { in: propostas.map((p) => p.id) } }, data: { status: "recusada", decididaEm: agora, decididaPor: por } });
    return { lote: null, aplicadas: 0, recusadas: propostas.length, desatualizadas: 0 };
  }

  const atuais = propostas.filter((p) => chaveDoNome(p.case.category?.name ?? "") === chaveDoNome(p.categoriaAtual ?? "") && chaveDaSubcategoria(p.case.subcategory?.name ?? "") === chaveDaSubcategoria(p.subcategoriaAtual ?? ""));
  const velhas = propostas.filter((p) => !atuais.includes(p));

  const categorias = await prisma.category.findMany({ select: { id: true, name: true, subcategories: { select: { id: true, name: true, active: true } } } });
  const daOficial = (nome: string) => categorias.find((c) => chaveDoNome(c.name) === chaveDoNome(nome));

  const lote = `ia-${agora.toISOString()}`;
  const trocas: { proposta: (typeof atuais)[number]; categoryId: string; subcategoryId: string | null; subNome: string | null }[] = [];
  for (const p of atuais) {
    const cat = daOficial(p.categoria);
    if (!cat) continue;
    const sub = p.subcategoria ? cat.subcategories.find((s) => chaveDaSubcategoria(s.name) === chaveDaSubcategoria(p.subcategoria!)) : undefined;
    trocas.push({ proposta: p, categoryId: cat.id, subcategoryId: sub?.id ?? null, subNome: sub?.name ?? null });
  }

  const porDestino = agruparPorDestino(trocas, (t) => ({ categoryId: t.categoryId, subcategoryId: t.subcategoryId }), (t) => t.proposta.caseId);

  await prisma.$transaction(async (tx) => {
    for (const g of porDestino) await tx.case.updateMany({ where: { id: { in: g.ids } }, data: { categoryId: g.categoryId, subcategoryId: g.subcategoryId } });
    await tx.reclassificacaoDeCaso.createMany({
      data: trocas.map((t) => ({
        caseId: t.proposta.caseId,
        lote,
        origem: "ia",
        deCategoriaId: t.proposta.case.categoryId,
        deCategoria: t.proposta.case.category?.name ?? null,
        deSubcategoriaId: t.proposta.case.subcategoryId,
        deSubcategoria: t.proposta.case.subcategory?.name ?? null,
        paraCategoriaId: t.categoryId,
        paraCategoria: t.proposta.categoria,
        paraSubcategoriaId: t.subcategoryId,
        paraSubcategoria: t.subNome,
        motivo: t.proposta.motivo,
        por,
      })),
    });
    await tx.propostaDeCategoria.updateMany({ where: { id: { in: trocas.map((t) => t.proposta.id) } }, data: { status: "aceita", decididaEm: agora, decididaPor: por } });
    /* A desatualizada sai: na próxima rodada a IA lê o caso como está agora. */
    await tx.propostaDeCategoria.deleteMany({ where: { id: { in: velhas.map((p) => p.id) } } });
  }, PRAZO_DA_TRANSACAO);

  return { lote: trocas.length ? lote : null, aplicadas: trocas.length, recusadas: 0, desatualizadas: velhas.length };
}

/* ============================================================
   O RESUMO PARA A TELA
============================================================ */

export interface PropostaNaTela {
  id: string;
  caseId: string;
  protocolo: string;
  titulo: string;
  abertaEm: string;
  atual: { categoria: string | null; subcategoria: string | null };
  proposta: { categoria: string; subcategoria: string | null };
  confianca: Confianca;
  motivo: string;
}

export interface EstadoDasPropostas {
  totalDoReclameAqui: number;
  semProposta: number;
  porStatus: Record<string, number>;
  pendentes: PropostaNaTela[];
}

export async function lerPropostas(prisma: PrismaClient): Promise<EstadoDasPropostas> {
  const [total, semProposta, grupos, pendentes] = await Promise.all([
    prisma.case.count({ where: { channel: "RECLAME_AQUI" } }),
    prisma.case.count({ where: { channel: "RECLAME_AQUI", propostaDeCategoria: { is: null } } }),
    prisma.propostaDeCategoria.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.propostaDeCategoria.findMany({
      where: { status: "pendente" },
      include: { case: { select: { protocol: true, title: true, publishedAt: true, category: { select: { name: true } }, subcategory: { select: { name: true } } } } },
    }),
  ]);
  const ordem: Record<string, number> = { alta: 0, media: 1, baixa: 2 };
  return {
    totalDoReclameAqui: total,
    semProposta,
    porStatus: Object.fromEntries(grupos.map((g) => [g.status, g._count._all])),
    pendentes: pendentes
      .map((p) => ({
        id: p.id,
        caseId: p.caseId,
        protocolo: p.case.protocol,
        titulo: p.case.title,
        abertaEm: p.case.publishedAt.toISOString().slice(0, 10),
        atual: { categoria: p.case.category?.name ?? null, subcategoria: p.case.subcategory?.name ?? null },
        proposta: { categoria: p.categoria, subcategoria: p.subcategoria },
        confianca: (p.confianca as Confianca) ?? "baixa",
        motivo: p.motivo,
      }))
      .sort((a, b) => ordem[a.confianca] - ordem[b.confianca] || b.abertaEm.localeCompare(a.abertaEm)),
  };
}
