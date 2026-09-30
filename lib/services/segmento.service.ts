import type { PrismaClient } from "@prisma/client";

import { MAXIMO_DE_CONCORRENTES, SLUG_DA_EMPRESA, type LinhaDoSegmento, type PosicaoNoSegmento } from "@/lib/models/segmento";
import { validarPainel, type PainelDoPortal } from "@/lib/services/painelDoPortal.service";
import { EMPRESA_NO_PORTAL } from "@/lib/services/raPortal.service";
import { hojeNaOperacao } from "@/lib/services/reputation.service";

/**
 * Comparação com o segmento (Fase 30, 1.107) — ver `lib/models/segmento.ts`.
 *
 * A extensão manda o que leu das listas públicas; esta rota confere campo
 * a campo e grava uma linha por empresa por dia. Ler de novo no mesmo dia
 * só atualiza.
 */

export interface LeituraDoSegmento {
  slug: string;
  nome: string;
  paineis: PainelDoPortal[];
  posicao: PosicaoNoSegmento | null;
}

const dia = (aaaammdd: string) => new Date(`${aaaammdd}T00:00:00Z`);

export function validarLeitura(bruto: unknown): LeituraDoSegmento | null {
  if (!bruto || typeof bruto !== "object") return null;
  const l = bruto as Record<string, unknown>;
  const slug = String(l.slug ?? "");
  const nome = String(l.nome ?? "").trim().slice(0, 120);
  if (!SLUG_DA_EMPRESA.test(slug) || !nome) return null;
  const paineis = (Array.isArray(l.paineis) ? l.paineis.slice(0, 12) : []).map(validarPainel).filter((p): p is PainelDoPortal => p !== null);
  const p = l.posicao as Record<string, unknown> | null | undefined;
  const numero = Number(p?.posicao);
  const posicao =
    p && Number.isInteger(numero) && numero > 0 && numero < 10_000
      ? { posicao: numero, tipo: String(p.tipo ?? "").slice(0, 20), segmento: String(p.segmento ?? "").slice(0, 120) }
      : null;
  return { slug, nome, paineis, posicao };
}

export async function gravarLeituras(prisma: PrismaClient, leituras: LeituraDoSegmento[]) {
  const hoje = dia(hojeNaOperacao());
  const agora = new Date();
  for (const l of leituras) {
    const dados = { nome: l.nome, paineis: l.paineis as object, posicao: (l.posicao ?? undefined) as object | undefined, lidoEm: agora };
    await prisma.reputacaoNoSegmento.upsert({
      where: { slug_dia: { slug: l.slug, dia: hoje } },
      create: { slug: l.slug, dia: hoje, ...dados },
      update: dados,
    });
  }
  return leituras.length;
}

/** O que a extensão lê hoje: as empresas cadastradas, e se já leu. */
export async function pedidoDoSegmento(prisma: PrismaClient) {
  const [config, hoje] = await Promise.all([
    prisma.operacaoConfig.findUnique({ where: { id: "unico" }, select: { concorrentesRA: true } }),
    prisma.reputacaoNoSegmento.count({ where: { dia: dia(hojeNaOperacao()), slug: EMPRESA_NO_PORTAL } }),
  ]);
  const concorrentes = (config?.concorrentesRA ?? ["anota-ai", "goomer", "saipos", "delivery-much"])
    .filter((s) => SLUG_DA_EMPRESA.test(s) && s !== EMPRESA_NO_PORTAL)
    .slice(0, MAXIMO_DE_CONCORRENTES);
  return { concorrentes, lidoHoje: hoje > 0 };
}

/**
 * A tabela: a leitura mais recente de cada empresa cadastrada (e da casa),
 * no período pedido, com a nota de cerca de 30 dias antes para mostrar
 * quem subiu e quem caiu.
 */
export async function lerComparacao(prisma: PrismaClient, tipo = "SIX_MONTHS"): Promise<{ linhas: LinhaDoSegmento[]; concorrentes: string[] }> {
  const { concorrentes } = await pedidoDoSegmento(prisma);
  const slugs = [EMPRESA_NO_PORTAL, ...concorrentes];
  const desde = new Date(Date.now() - 45 * 86_400_000);
  const linhasDoBanco = await prisma.reputacaoNoSegmento.findMany({
    where: { slug: { in: slugs }, dia: { gte: desde } },
    orderBy: { dia: "desc" },
  });

  const linhas: LinhaDoSegmento[] = [];
  for (const slug of slugs) {
    const doSlug = linhasDoBanco.filter((l) => l.slug === slug);
    const atual = doSlug[0];
    if (!atual) continue;
    const painel = (atual.paineis as unknown as PainelDoPortal[]).find((p) => p.tipo === tipo) ?? null;
    const limite = atual.dia.getTime() - 25 * 86_400_000;
    const antiga = doSlug.find((l) => l.dia.getTime() <= limite);
    const painelAntigo = antiga ? ((antiga.paineis as unknown as PainelDoPortal[]).find((p) => p.tipo === tipo) ?? null) : null;
    linhas.push({
      slug,
      nome: atual.nome,
      casa: slug === EMPRESA_NO_PORTAL,
      nota: painel?.nota ?? null,
      resposta: painel?.resposta ?? null,
      solucao: painel?.solucao ?? null,
      voltaria: painel?.voltaria ?? null,
      notaConsumidor: painel?.notaConsumidor ?? null,
      recebidas: painel?.recebidas ?? null,
      tempoMedio: painel?.tempoMedio ?? "",
      selo: painel?.selo ?? "",
      posicao: (atual.posicao as unknown as PosicaoNoSegmento | null) ?? null,
      notaAntes: painelAntigo?.nota ?? null,
      lidoEm: atual.lidoEm.toISOString(),
    });
  }
  return { linhas, concorrentes };
}
