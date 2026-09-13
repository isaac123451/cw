"use server";

import { updateTag } from "next/cache";

import { WORKSPACE_TAG } from "@/lib/actions/tags";
import { requireRole, SemPermissao } from "@/lib/auth/guard";

import {
  origemDaReincidencia,
  REINCIDENCIA_DIAS,
  REINCIDENCIA_MINIMA,
  reincidenciasCruzadas,
  type Frente,
  type RegistroDeCausa,
} from "@/lib/models/causaRaiz";
import { ProjectStage } from "@/lib/models/project";
import { descreverRegistro } from "@/lib/services/horasUteis";
import { SOCIAL_SOURCES } from "@/lib/services/case.service";
import { CANAL_PARA_ORIGEM } from "@/lib/services/case.mapper";

type Falha = { ok: false; erro: string };

/**
 * Reincidência vira item em Projetos.
 *
 * A tela mostra a causa que passou de três registros em 30 dias; o botão
 * pede ao servidor para abrir o item. A conta é refeita aqui, contra o
 * banco — a tela pode estar com a lista de ontem —, e o item leva a lista
 * dos registros, para a área responsável começar pelos casos e não por
 * um número.
 */
export async function abrirProjetoDeReincidencia(entrada: {
  causa: string;
}): Promise<{ ok: true; projeto: { id: string; title: string }; jaExistia: boolean; registros: number } | Falha> {

  const causa = entrada.causa.trim();
  if (!causa) return { ok: false, erro: "Diga qual causa." };

  let ctx;
  try {
    ctx = await requireRole("AGENTE", "projetos");
  } catch (erro) {
    return { ok: false, erro: erro instanceof SemPermissao ? erro.message : "Não foi possível confirmar sua sessão. Entre de novo." };
  }
  if (!ctx) return { ok: false, erro: "Sem banco configurado — nada é gravado no modo demonstração." };

  const agora = new Date();
  const desde = new Date(agora.getTime() - REINCIDENCIA_DIAS * 86_400_000);
  const mesmaCausa = { equals: causa, mode: "insensitive" as const };

  try {
    const [casos, nps, google, pessoa] = await Promise.all([
      ctx.prisma.case.findMany({
        where: {
          causaRaiz: mesmaCausa,
          OR: [{ recebidaEm: { gte: desde } }, { recebidaEm: null, publishedAt: { gte: desde } }],
        },
        select: { protocol: true, externalId: true, title: true, channel: true, recebidaEm: true, publishedAt: true },
      }),
      ctx.prisma.npsResponse.findMany({
        where: { rootCause: mesmaCausa, respondedAt: { gte: desde } },
        select: { customer: true, customerName: true, score: true, respondedAt: true },
      }),
      ctx.prisma.avaliacaoGoogle.findMany({
        where: { causaRaiz: mesmaCausa, publicadaEm: { gte: desde }, status: { not: "denunciada" } },
        select: { autor: true, estrelas: true, publicadaEm: true },
      }),
      ctx.prisma.user.findUnique({ where: { id: ctx.userId }, select: { name: true } }),
    ]);

    const registros: RegistroDeCausa[] = [
      ...casos.map((c) => {
        const frente: Frente = SOCIAL_SOURCES.includes(CANAL_PARA_ORIGEM[c.channel] ?? "") ? "Redes Sociais" : "Reclame Aqui";
        const em = (c.recebidaEm ?? c.publishedAt).toISOString();
        return { frente, causa, em, rotulo: `${frente === "Reclame Aqui" ? "RA" : CANAL_PARA_ORIGEM[c.channel]} ${c.externalId ?? c.protocol} — ${c.title}` };
      }),
      ...nps.map((n) => ({ frente: "NPS" as const, causa, em: n.respondedAt.toISOString(), rotulo: `NPS — ${n.customerName ?? n.customer}, nota ${n.score}` })),
      ...google.map((g) => ({ frente: "Google" as const, causa, em: g.publicadaEm.toISOString(), rotulo: `Google — ${g.autor}, ${g.estrelas} estrela(s)` })),
    ];

    const [achada] = reincidenciasCruzadas(registros, agora);

    if (!achada) {
      return {
        ok: false,
        erro: `"${causa}" tem ${registros.length} registro(s) nos últimos ${REINCIDENCIA_DIAS} dias — reincidência começa em ${REINCIDENCIA_MINIMA}.`,
      };
    }

    const origem = origemDaReincidencia(causa, agora);

    const existente = await ctx.prisma.project.findFirst({ where: { origem }, select: { id: true, title: true } });
    if (existente) return { ok: true, projeto: existente, jaExistia: true, registros: achada.registros.length };

    const lista = achada.registros
      .slice(0, 40)
      .map((r) => `• ${descreverRegistro(r.em)} · ${r.rotulo}`)
      .join("\n");

    const criado = await ctx.prisma.project.create({
      data: {
        origem,
        title: `Reincidência: ${causa} (${achada.registros.length} em ${REINCIDENCIA_DIAS} dias)`,
        description: [
          `Aberto a partir do Analytics: ${achada.registros.length} registros de "${causa}" nos últimos ${REINCIDENCIA_DIAS} dias, somando ${achada.frentes.join(", ")}.`,
          "O problema que se repete em vários clientes é do produto ou do processo — o documento de reputação pede transformar esse feedback em melhoria.",
          "",
          "Registros:",
          lista,
          achada.registros.length > 40 ? `… e mais ${achada.registros.length - 40}.` : "",
        ]
          .filter((l, i, todas) => l !== "" || todas[i - 1] !== "")
          .join("\n")
          .trim(),
        stage: "Ideia" satisfies ProjectStage,
        owner: pessoa?.name ?? "",
        impact: "Alto",
        tags: ["Reincidência", causa, ...achada.frentes],
      },
      select: { id: true, title: true },
    });

    updateTag(WORKSPACE_TAG);

    return { ok: true, projeto: criado, jaExistia: false, registros: achada.registros.length };
  } catch (erro) {
    console.error("[causa raiz] reincidência", erro);
    return { ok: false, erro: "O banco não aceitou a gravação agora. Tente de novo em instantes." };
  }
}
