"use server";

import { updateTag } from "next/cache";

import { WORKSPACE_TAG } from "@/lib/actions/tags";
import { requireRole, SemPermissao, tryRole } from "@/lib/auth/guard";
import { AREAS_DAS_CAUSAS, propostaDoCatalogo, type CausaAprovada, type PropostaDoCatalogo, type TextoDaBase } from "@/lib/models/catalogoDeCausas";
import { ROOT_CAUSES } from "@/lib/models/nps";
import { SOCIAL_SOURCES } from "@/lib/services/case.service";
import { CANAL_PARA_ORIGEM } from "@/lib/services/case.mapper";

/*
  O catálogo de causas tirado da base (Fase 27).

  A proposta lê o texto que o navegador não tem — o relato do Reclame
  Aqui e o post das redes ficam fora da carga da lista por peso — e
  devolve só a contagem e os exemplos. Aprovar grava as causas com a área
  e o prazo; nada é apagado nem renomeado: as causas de antes continuam,
  porque os registros antigos apontam para elas.
*/

type Falha = { ok: false; erro: string };

/** Quantos registros de cada frente entram na conta — os mais recentes. */
const LIMITE_POR_FRENTE = 3000;

export async function lerPropostaDoCatalogo(): Promise<{ ok: true; proposta: PropostaDoCatalogo; catalogo: string[] } | Falha> {
  let ctx;
  try {
    ctx = await tryRole("LEITURA");
  } catch (erro) {
    return { ok: false, erro: erro instanceof SemPermissao ? erro.message : "Não foi possível confirmar sua sessão. Entre de novo." };
  }
  if (!ctx) return { ok: false, erro: "Sem banco configurado — a proposta é tirada dos registros do banco." };

  try {
    const [casos, nps, google, causas] = await Promise.all([
      ctx.prisma.case.findMany({
        select: { protocol: true, externalId: true, title: true, description: true, channel: true },
        orderBy: { createdAt: "desc" },
        take: LIMITE_POR_FRENTE * 2,
      }),
      ctx.prisma.npsResponse.findMany({
        where: { comment: { not: "" } },
        select: { comment: true, customer: true, customerName: true, score: true },
        orderBy: { respondedAt: "desc" },
        take: LIMITE_POR_FRENTE,
      }),
      ctx.prisma.avaliacaoGoogle.findMany({
        where: { texto: { not: null } },
        select: { texto: true, autor: true, estrelas: true },
        orderBy: { publicadaEm: "desc" },
        take: LIMITE_POR_FRENTE,
      }),
      ctx.prisma.npsRootCause.findMany({ select: { name: true }, orderBy: { order: "asc" } }),
    ]);

    const registros: TextoDaBase[] = [
      ...casos.map((c) => {
        const origem = CANAL_PARA_ORIGEM[c.channel] ?? "";
        const social = SOCIAL_SOURCES.includes(origem);
        return {
          frente: social ? ("redes" as const) : ("reclame-aqui" as const),
          texto: `${c.title}\n${c.description ?? ""}`,
          ref: `${social ? origem : "RA"} ${c.externalId ?? c.protocol}`,
        };
      }),
      ...nps.map((n) => ({ frente: "nps" as const, texto: n.comment, ref: `NPS — ${n.customerName ?? n.customer}, nota ${n.score}` })),
      ...google.map((g) => ({ frente: "google" as const, texto: g.texto ?? "", ref: `Google — ${g.autor}, ${g.estrelas}★` })),
    ];

    const catalogo = causas.length ? causas.map((c) => c.name) : [...ROOT_CAUSES];
    return { ok: true, proposta: propostaDoCatalogo(registros, catalogo), catalogo };
  } catch (erro) {
    console.error("[catálogo de causas] proposta", erro);
    return { ok: false, erro: "O banco não respondeu agora. Tente de novo em instantes." };
  }
}

/**
 * Grava as causas aprovadas, com a área e o prazo.
 *
 * A causa que já existe com o mesmo nome (sem diferença de caixa) ganha
 * a área, o prazo e as palavras; a nova entra no fim da lista. Com o
 * cadastro vazio, as causas de partida são gravadas antes — senão, ao
 * existir a primeira linha, as nove de sempre sumiriam da tela.
 */
export async function aprovarCausasDoCatalogo(itens: CausaAprovada[]): Promise<{ ok: true; criadas: number; atualizadas: number } | Falha> {
  const validos = itens
    .map((i) => ({ ...i, nome: i.nome.trim() }))
    .filter((i) => i.nome.length >= 3)
    .slice(0, 40);
  if (!validos.length) return { ok: false, erro: "Marque ao menos uma causa." };
  const areaInvalida = validos.find((i) => !(AREAS_DAS_CAUSAS as readonly string[]).includes(i.area));
  if (areaInvalida) return { ok: false, erro: `"${areaInvalida.area}" não é uma área conhecida.` };

  let ctx;
  try {
    ctx = await requireRole("AGENTE", "nps");
  } catch (erro) {
    return { ok: false, erro: erro instanceof SemPermissao ? erro.message : "Não foi possível confirmar sua sessão. Entre de novo." };
  }
  if (!ctx) return { ok: false, erro: "Sem banco configurado — nada é gravado no modo demonstração." };

  try {
    const existentes = await ctx.prisma.npsRootCause.findMany({ select: { id: true, name: true, order: true } });
    if (existentes.length === 0) {
      await ctx.prisma.npsRootCause.createMany({ data: ROOT_CAUSES.map((name, i) => ({ name, order: i })), skipDuplicates: true });
      existentes.push(...(await ctx.prisma.npsRootCause.findMany({ select: { id: true, name: true, order: true } })));
    }
    const porNome = new Map(existentes.map((e) => [e.name.trim().toLowerCase(), e]));
    let ordem = Math.max(-1, ...existentes.map((e) => e.order)) + 1;
    let criadas = 0;
    let atualizadas = 0;

    for (const item of validos) {
      const dados = {
        description: item.descricao.trim().slice(0, 500) || null,
        area: item.area,
        prazoHoras: Math.max(1, Math.min(720, Math.round(item.prazoHoras))),
        palavras: item.palavras.map((p) => p.trim()).filter(Boolean).slice(0, 20),
      };
      const achada = porNome.get(item.nome.toLowerCase());
      if (achada) {
        await ctx.prisma.npsRootCause.update({ where: { id: achada.id }, data: { ...dados, active: true }, select: { id: true } });
        atualizadas += 1;
      } else {
        await ctx.prisma.npsRootCause.create({ data: { name: item.nome.slice(0, 80), order: ordem++, ...dados }, select: { id: true } });
        criadas += 1;
      }
    }

    updateTag(WORKSPACE_TAG);
    return { ok: true, criadas, atualizadas };
  } catch (erro) {
    const codigo = (erro as { code?: string })?.code;
    if (codigo === "P2021" || codigo === "P2022") {
      return { ok: false, erro: "As colunas de área e prazo da causa ainda não existem no banco. Rode npm run db:push — uma vez só." };
    }
    console.error("[catálogo de causas] aprovar", erro);
    return { ok: false, erro: "O banco não aceitou a gravação agora. Tente de novo em instantes." };
  }
}
