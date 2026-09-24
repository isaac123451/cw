import type { PrismaClient } from "@prisma/client";

import {
  donoDoItem,
  origemDaReincidencia,
  REINCIDENCIA_DIAS,
  reincidenciasCruzadas,
  type Frente,
  type RegistroDeCausa,
  type Reincidencia,
} from "@/lib/models/causaRaiz";
import { acharCausa, rotuloDoPrazo } from "@/lib/models/catalogoDeCausas";
import { frente as frenteDaOperacao } from "@/lib/models/frentes";
import type { ProjectStage } from "@/lib/models/project";
import { descreverRegistro } from "@/lib/services/horasUteis";
import { SOCIAL_SOURCES } from "@/lib/services/case.service";
import { CANAL_PARA_ORIGEM } from "@/lib/services/case.mapper";

/*
  A reincidência que vira item em Projetos (Fases 4 e 27).

  Um lugar só para as duas portas: o botão do Analytics e da tela Causas
  raiz (`abrirProjetoDeReincidencia`) e a rotina diária, que abre sozinha
  o item da causa que tem dono no catálogo. A conta é sempre refeita
  contra o banco, e a marca `origem` (uma por causa e por mês) impede o
  segundo item.
*/

type CausaComDono = { name: string; area?: string | null; prazoHoras?: number | null };

/** O catálogo com a área e o prazo — só os nomes, antes do `db:push` da Fase 27. */
export async function catalogoComDono(prisma: PrismaClient): Promise<CausaComDono[]> {
  try {
    return await prisma.npsRootCause.findMany({ where: { active: true }, select: { name: true, area: true, prazoHoras: true } });
  } catch (erro) {
    if ((erro as { code?: string })?.code !== "P2022") throw erro;
    return prisma.npsRootCause.findMany({ where: { active: true }, select: { name: true } });
  }
}

/** Os registros com causa desde `desde`, nas quatro frentes; com `causa`, só os dela. */
export async function registrosComCausa(prisma: PrismaClient, desde: Date, causa?: string): Promise<RegistroDeCausa[]> {
  const filtro = causa ? { equals: causa, mode: "insensitive" as const } : { not: null };
  const [casos, nps, google] = await Promise.all([
    prisma.case.findMany({
      where: { causaRaiz: filtro, OR: [{ recebidaEm: { gte: desde } }, { recebidaEm: null, publishedAt: { gte: desde } }] },
      select: { protocol: true, externalId: true, title: true, channel: true, recebidaEm: true, publishedAt: true, causaRaiz: true },
    }),
    prisma.npsResponse.findMany({
      where: { rootCause: filtro, respondedAt: { gte: desde } },
      select: { customer: true, customerName: true, score: true, respondedAt: true, rootCause: true },
    }),
    prisma.avaliacaoGoogle.findMany({
      where: { causaRaiz: filtro, publicadaEm: { gte: desde }, status: { not: "denunciada" } },
      select: { autor: true, estrelas: true, publicadaEm: true, causaRaiz: true },
    }),
  ]);
  return [
    ...casos.map((c) => {
      const frente: Frente = SOCIAL_SOURCES.includes(CANAL_PARA_ORIGEM[c.channel] ?? "") ? "redes" : "reclame-aqui";
      const em = (c.recebidaEm ?? c.publishedAt).toISOString();
      return { frente, causa: c.causaRaiz ?? "", em, rotulo: `${frente === "reclame-aqui" ? "RA" : CANAL_PARA_ORIGEM[c.channel]} ${c.externalId ?? c.protocol} — ${c.title}` };
    }),
    ...nps.map((n) => ({ frente: "nps" as const, causa: n.rootCause ?? "", em: n.respondedAt.toISOString(), rotulo: `NPS — ${n.customerName ?? n.customer}, nota ${n.score}` })),
    ...google.map((g) => ({ frente: "google" as const, causa: g.causaRaiz ?? "", em: g.publicadaEm.toISOString(), rotulo: `Google — ${g.autor}, ${g.estrelas} estrela(s)` })),
  ];
}

/** Abre o item da reincidência, ou devolve o deste mês se já existe. */
export async function abrirItemDaReincidencia(
  prisma: PrismaClient,
  achada: Reincidencia,
  agora: Date,
  { dono, prazoHoras, quem }: { dono: string; prazoHoras?: number | null; quem: string }
): Promise<{ projeto: { id: string; title: string }; jaExistia: boolean }> {
  const origem = origemDaReincidencia(achada.causa, agora);
  const existente = await prisma.project.findFirst({ where: { origem }, select: { id: true, title: true } });
  if (existente) return { projeto: existente, jaExistia: true };

  const lista = achada.registros
    .slice(0, 40)
    .map((r) => `• ${descreverRegistro(r.em)} · ${r.rotulo}`)
    .join("\n");

  const criado = await prisma.project.create({
    data: {
      origem,
      title: `Reincidência: ${achada.causa} (${achada.registros.length} em ${REINCIDENCIA_DIAS} dias)`,
      description: [
        `${quem}: ${achada.registros.length} registros de "${achada.causa}" nos últimos ${REINCIDENCIA_DIAS} dias, somando ${achada.frentes.map((f) => frenteDaOperacao(f).nome).join(", ")}.`,
        dono ? `Dono: ${dono}${prazoHoras ? ` — prazo da causa: ${rotuloDoPrazo(prazoHoras)}` : ""}.` : "Sem dono no catálogo: defina a área da causa em Causas raiz.",
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
      owner: dono,
      impact: "Alto",
      tags: ["Reincidência", achada.causa, ...(dono ? [dono] : []), ...achada.frentes.map((f) => frenteDaOperacao(f).nome)],
    },
    select: { id: true, title: true },
  });

  return { projeto: criado, jaExistia: false };
}

/**
 * A rotina diária: toda causa com dono que passou do limite vira item.
 *
 * Só a que tem área no catálogo — "com dono" é o ponto: o item sem
 * responsável é o que ninguém abre. A causa sem área continua no botão
 * do Analytics, para quem decidir.
 */
export async function abrirReincidenciasComDono(prisma: PrismaClient, agora: Date) {
  const desde = new Date(agora.getTime() - REINCIDENCIA_DIAS * 86_400_000);
  const [registros, catalogo] = await Promise.all([registrosComCausa(prisma, desde), catalogoComDono(prisma)]);
  const criados: string[] = [];
  const semDono: string[] = [];
  let jaExistiam = 0;
  for (const achada of reincidenciasCruzadas(registros, agora)) {
    const causa = acharCausa(achada.causa, catalogo);
    const dono = donoDoItem(causa);
    if (!dono) {
      semDono.push(achada.causa);
      continue;
    }
    const r = await abrirItemDaReincidencia(prisma, { ...achada, causa: causa?.name ?? achada.causa }, agora, { dono, prazoHoras: causa?.prazoHoras, quem: "Aberto pela rotina diária" });
    if (r.jaExistia) jaExistiam += 1;
    else criados.push(r.projeto.title);
  }
  return { criados, jaExistiam, semDono };
}
