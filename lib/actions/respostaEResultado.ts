"use server";

import { randomUUID } from "node:crypto";

import { updateTag } from "next/cache";

import { WORKSPACE_TAG } from "@/lib/actions/tags";
import { requireRole, SemPermissao, tryRole } from "@/lib/auth/guard";
import { anonimizar, comResultado, melhoresRespostas, vezesComResultado, type RespostaComResultado, type VezComResultado } from "@/lib/models/respostaEResultado";
import { RESPOSTA_SINTETICA } from "@/lib/services/raMarcadores";
import { nomeDeContatoValido } from "@/lib/models/conversa";

type Falha = { ok: false; erro: string };

const CATEGORIA_DOS_MODELOS = "Modelos que funcionaram";

async function lerRespostas(prisma: NonNullable<Awaited<ReturnType<typeof tryRole>>>["prisma"], onde: { categoryId?: string | null } = {}) {
  const casos = await prisma.case.findMany({
    where: { channel: "RECLAME_AQUI", publicResponse: { not: null }, ...(onde.categoryId ? { categoryId: onde.categoryId } : {}) },
    select: {
      id: true,
      protocol: true,
      customer: true,
      publicResponse: true,
      publicResponseAt: true,
      publishedAt: true,
      evaluated: true,
      resolved: true,
      score: true,
      wouldDoBusiness: true,
      evaluatedAt: true,
      category: { select: { name: true } },
    },
    orderBy: { publishedAt: "desc" },
    take: 1500,
  });
  return casos
    .filter((c) => c.publicResponse && c.publicResponse.trim().length > 20 && c.publicResponse.trim() !== RESPOSTA_SINTETICA)
    .map((c) =>
      comResultado({
        id: c.id,
        protocolo: c.protocol,
        cliente: c.customer,
        categoria: c.category?.name ?? "Sem categoria",
        texto: c.publicResponse!,
        reclamadaEm: c.publishedAt.toISOString().slice(0, 10),
        respondidaEm: c.publicResponseAt?.toISOString() ?? null,
        avaliada: c.evaluated,
        resolvida: c.resolved,
        nota: c.score,
        voltaria: c.wouldDoBusiness,
        avaliadaEm: c.evaluatedAt?.toISOString() ?? null,
      })
    );
}

/**
 * Todas as respostas públicas com o resultado, e as vezes em que falamos
 * no WhatsApp com o que veio depois (1.109). As contas por padrão e por
 * tipo de problema são feitas na tela, com `lib/models/respostaEResultado.ts`.
 */
export async function lerRespostaEResultado(): Promise<{ ok: true; respostas: RespostaComResultado[]; vezes: VezComResultado[] } | Falha> {
  const ctx = await tryRole("LEITURA", "reclame-aqui").catch(() => null);
  if (!ctx) return { ok: false, erro: "Entre na aplicação para ver o resultado das respostas." };
  try {
    const [respostas, conversas] = await Promise.all([
      lerRespostas(ctx.prisma),
      ctx.prisma.conversa.findMany({
        select: { id: true, contatoNome: true, telefone: true, mensagens: { select: { de: true, texto: true, em: true } } },
        orderBy: { atualizadoEm: "desc" },
        take: 300,
      }),
    ]);
    const vezes = vezesComResultado(
      conversas.map((c) => ({ id: c.id, contato: nomeDeContatoValido(c.contatoNome) || c.telefone || "Contato", mensagens: c.mensagens.map((m) => ({ de: m.de, texto: m.texto, em: m.em?.toISOString() ?? null })) }))
    );
    return { ok: true, respostas, vezes };
  } catch (erro) {
    console.error("[resposta-e-resultado]", erro);
    return { ok: false, erro: "O banco não respondeu agora. Tente de novo em instantes." };
  }
}

/**
 * As respostas que funcionaram no mesmo tipo de problema de um caso — a
 * sugestão que aparece na hora de escrever a resposta pública. Sem o nome
 * do outro cliente.
 */
export async function modelosParaOCaso(caseId: string): Promise<{ ok: true; categoria: string | null; modelos: { id: string; protocolo: string; nota: number | null; texto: string }[] } | Falha> {
  const ctx = await tryRole("LEITURA", "reclame-aqui").catch(() => null);
  if (!ctx) return { ok: false, erro: "Entre na aplicação." };
  try {
    /* A ficha manda o id da tela (o do portal); o banco aceita os dois (1.113). */
    const caso = await ctx.prisma.case.findFirst({ where: { OR: [{ id: caseId }, { externalId: caseId }] }, select: { id: true, categoryId: true, category: { select: { name: true } } } });
    if (!caso?.categoryId) return { ok: true, categoria: null, modelos: [] };
    const respostas = (await lerRespostas(ctx.prisma, { categoryId: caso.categoryId })).filter((r) => r.id !== caso.id);
    const modelos = melhoresRespostas(respostas, undefined, 3).map((r) => ({ id: r.id, protocolo: r.protocolo, nota: r.nota, texto: anonimizar(r.texto, r.cliente) }));
    return { ok: true, categoria: caso.category?.name ?? null, modelos };
  } catch (erro) {
    console.error("[resposta-e-resultado] modelos", erro);
    return { ok: false, erro: "O banco não respondeu agora." };
  }
}

/**
 * Guarda uma resposta que funcionou como resposta pronta, sem o nome do
 * cliente, na categoria "Modelos que funcionaram". A mesma resposta não
 * vira modelo duas vezes.
 */
export async function virarRespostaPronta(caseId: string): Promise<{ ok: true; jaExistia: boolean } | Falha> {
  let ctx;
  try {
    ctx = await requireRole("AGENTE", "base-conhecimento");
  } catch (erro) {
    return { ok: false, erro: erro instanceof SemPermissao ? erro.message : "Não foi possível confirmar sua sessão." };
  }
  if (!ctx) return { ok: false, erro: "Sem banco configurado." };

  try {
    const marca = `caso:${caseId}`;
    const existente = await ctx.prisma.macro.findFirst({ where: { tags: { has: marca } }, select: { id: true } });
    if (existente) return { ok: true, jaExistia: true };

    const caso = await ctx.prisma.case.findFirst({
      where: { OR: [{ id: caseId }, { externalId: caseId }] },
      select: { customer: true, publicResponse: true, evaluated: true, resolved: true, score: true, category: { select: { name: true } } },
    });
    if (!caso?.publicResponse) return { ok: false, erro: "A reclamação não tem resposta pública." };
    if (!caso.evaluated || !caso.resolved) return { ok: false, erro: "Só vira modelo a resposta de uma reclamação resolvida." };

    const quem = await ctx.prisma.user.findUnique({ where: { id: ctx.userId }, select: { name: true } });
    const categoria = caso.category?.name ?? "Sem categoria";
    await ctx.prisma.macro.create({
      data: {
        id: randomUUID(),
        title: `${categoria} — resolvida, nota ${caso.score ?? "—"}`,
        body: anonimizar(caso.publicResponse, caso.customer),
        category: CATEGORIA_DOS_MODELOS,
        channel: "Reclame Aqui",
        owner: quem?.name ?? "",
        tags: ["modelo-que-funcionou", marca],
      },
    });
    updateTag(WORKSPACE_TAG);
    return { ok: true, jaExistia: false };
  } catch (erro) {
    console.error("[resposta-e-resultado] modelo", erro);
    return { ok: false, erro: "O banco não aceitou a gravação agora. Tente de novo em instantes." };
  }
}
