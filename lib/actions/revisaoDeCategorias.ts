"use server";

import { updateTag } from "next/cache";

import { CASES_TAG, WORKSPACE_TAG } from "@/lib/actions/tags";
import { requireRole, SemPermissao, tryRole } from "@/lib/auth/guard";
import { getSession } from "@/lib/auth/session";
import { decidirPropostas, lerPropostas, type EstadoDasPropostas, type ResultadoDaDecisao } from "@/lib/services/propostaDeCategoria.service";
import type { CategoryOption, SubcategoryOption } from "@/lib/models/settings";
import { aplicarUnificacao, desfazerLote, lerLotes, preverUnificacao, type LoteDeReclassificacao, type ResultadoDaUnificacao } from "@/lib/services/taxonomia.service";

/**
 * A revisão das categorias (1.132): unificar nas oficiais, decidir as
 * propostas da IA e desfazer um lote. Ler vale para quem lê; mudar é de
 * administrador, como a unificação que já existia em Configurar fluxo.
 *
 * A classificação pela IA não passa por aqui: ela leva segundos por pedido
 * e roda em `/api/reclame-aqui/categorias/propor`, uma rota — uma action
 * seguraria a fila das outras.
 */

type Falha = { ok: false; erro: string };

interface Listas {
  categorias: CategoryOption[];
  subcategorias: SubcategoryOption[];
}

/** As listas como a tela usa, para trocar as suas sem recarregar a página. */
async function listas(prisma: NonNullable<Awaited<ReturnType<typeof requireRole>>>["prisma"]): Promise<Listas> {
  const [categorias, subcategorias] = await Promise.all([
    prisma.category.findMany({ orderBy: { order: "asc" } }),
    prisma.subcategory.findMany({ include: { category: { select: { name: true } } }, orderBy: { order: "asc" } }),
  ]);
  return {
    categorias: categorias.map((r) => ({ id: r.id, name: r.name, description: r.description ?? "", order: r.order, active: r.active, ceilingHours: r.ceilingHours ?? undefined })),
    subcategorias: subcategorias.map((r) => ({ id: r.id, category: r.category.name, name: r.name, description: r.description ?? "", order: r.order, active: r.active })),
  };
}

export interface RevisaoDeCategorias {
  unificacao: {
    movimentos: { nome: string; casos: number; para: string }[];
    fusoes: { categoria: string; fica: string; saem: { nome: string; casos: number }[] }[];
    trocas: number;
  };
  propostas: EstadoDasPropostas;
  lotes: LoteDeReclassificacao[];
  podeMudar: boolean;
}

export async function lerRevisaoDeCategorias(): Promise<{ ok: true; revisao: RevisaoDeCategorias } | Falha> {
  const ctx = await tryRole("LEITURA", "reclame-aqui");
  if (!ctx) return { ok: false, erro: "Sem acesso ao Reclame Aqui." };
  const [plano, propostas, lotes] = await Promise.all([preverUnificacao(ctx.prisma), lerPropostas(ctx.prisma), lerLotes(ctx.prisma)]);
  return {
    ok: true,
    revisao: {
      unificacao: {
        movimentos: plano.movimentos.map((m) => ({ nome: m.nome, casos: m.casos, para: m.para })),
        fusoes: plano.fusoes,
        trocas: plano.trocas.length,
      },
      propostas,
      lotes,
      podeMudar: ctx.role === "ADMIN",
    },
  };
}

async function comoAdministrador() {
  try {
    const ctx = await requireRole("ADMIN");
    if (!ctx) return { erro: "Sem banco configurado." } as const;
    const sessao = await getSession();
    return { ctx, por: sessao?.name ?? sessao?.email ?? "Administrador" } as const;
  } catch (erro) {
    return { erro: erro instanceof SemPermissao ? "Só administrador muda a classificação das reclamações." : "Não foi possível confirmar sua sessão." } as const;
  }
}

export async function unificarNasOficiais(): Promise<({ ok: true } & ResultadoDaUnificacao & Listas) | Falha> {
  const a = await comoAdministrador();
  if ("erro" in a) return { ok: false, erro: a.erro! };
  try {
    const r = await aplicarUnificacao(a.ctx.prisma, a.por);
    updateTag(CASES_TAG);
    updateTag(WORKSPACE_TAG);
    return { ok: true, ...r, ...(await listas(a.ctx.prisma)) };
  } catch (erro) {
    return { ok: false, erro: erro instanceof Error ? `A unificação não foi gravada: ${erro.message}` : "A unificação não foi gravada." };
  }
}

export async function decidirPropostasDeCategoria(entrada: { ids: string[]; decisao: "aceitar" | "recusar" }): Promise<({ ok: true } & ResultadoDaDecisao & Listas) | Falha> {
  const a = await comoAdministrador();
  if ("erro" in a) return { ok: false, erro: a.erro! };
  if (!Array.isArray(entrada.ids) || entrada.ids.length === 0) return { ok: false, erro: "Escolha ao menos uma proposta." };
  if (entrada.decisao !== "aceitar" && entrada.decisao !== "recusar") return { ok: false, erro: "Decisão desconhecida." };
  try {
    const r = await decidirPropostas(a.ctx.prisma, entrada.ids.slice(0, 500), entrada.decisao, a.por);
    if (r.aplicadas > 0) {
      updateTag(CASES_TAG);
      updateTag(WORKSPACE_TAG);
    }
    return { ok: true, ...r, ...(await listas(a.ctx.prisma)) };
  } catch (erro) {
    return { ok: false, erro: erro instanceof Error ? `Nada foi gravado: ${erro.message}` : "Nada foi gravado." };
  }
}

export async function desfazerReclassificacao(lote: string): Promise<({ ok: true; desfeitas: number; preservadas: number } & Listas) | Falha> {
  const a = await comoAdministrador();
  if ("erro" in a) return { ok: false, erro: a.erro! };
  if (!/^(unificacao|ia)-/.test(lote)) return { ok: false, erro: "Lote desconhecido." };
  try {
    const r = await desfazerLote(a.ctx.prisma, lote);
    updateTag(CASES_TAG);
    updateTag(WORKSPACE_TAG);
    return { ok: true, ...r, ...(await listas(a.ctx.prisma)) };
  } catch (erro) {
    return { ok: false, erro: erro instanceof Error ? `Nada foi desfeito: ${erro.message}` : "Nada foi desfeito." };
  }
}
