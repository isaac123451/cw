"use server";

import { tryRole } from "@/lib/auth/guard";
import { analisarResposta, type AchadoDaResposta } from "@/lib/models/analistaDeRespostas";
import { INICIO_DA_TRILHA } from "@/lib/models/trilha";
import { RESPOSTA_SINTETICA } from "@/lib/services/raMarcadores";

export interface RespostaAnalisada {
  id: string;
  protocolo: string;
  cliente: string;
  titulo: string;
  publicadaEm: string;
  texto: string;
  nota: number;
  achados: AchadoDaResposta[];
}

/**
 * As respostas públicas do período, analisadas (1.94) — a pior primeiro.
 *
 * O texto vem do banco (a lista do quadro não o carrega). Cada uma é
 * comparada com as outras do período para o "texto repetido"; a
 * validação só é cobrada do que chegou depois do registro de contato.
 */
export async function lerRespostasAnalisadas(dias = 90): Promise<{ ok: true; respostas: RespostaAnalisada[]; semTexto: number } | { ok: false; erro: string }> {
  const ctx = await tryRole("LEITURA").catch(() => null);
  if (!ctx) return { ok: false, erro: "Entre na aplicação para ver as respostas." };

  const periodo = Math.min(Math.max(Math.round(dias), 7), 365);

  try {
    const casos = await ctx.prisma.case.findMany({
      where: {
        protocol: { startsWith: "RA-" },
        publicResponseAt: { gte: new Date(Date.now() - periodo * 86_400_000) },
        publicResponse: { not: null },
      },
      select: { id: true, protocol: true, customer: true, title: true, publicResponse: true, publicResponseAt: true, publishedAt: true, validadoEm: true },
      orderBy: { publicResponseAt: "desc" },
      take: 400,
    });

    const comTexto = casos.filter((c) => c.publicResponse && c.publicResponse.trim() !== RESPOSTA_SINTETICA);

    const respostas = comTexto.map((c) => {
      const outras = comTexto.filter((o) => o.id !== c.id).map((o) => o.publicResponse!);
      const antigo = c.publishedAt.toISOString().slice(0, 10) < INICIO_DA_TRILHA;
      const a = analisarResposta(c.publicResponse!, { nome: c.customer, publicadas: outras, validado: antigo ? undefined : Boolean(c.validadoEm) });
      return {
        id: c.id,
        protocolo: c.protocol,
        cliente: c.customer,
        titulo: c.title,
        publicadaEm: c.publicResponseAt!.toISOString(),
        texto: c.publicResponse!,
        nota: a.nota,
        achados: a.achados,
      };
    });

    return { ok: true, respostas: respostas.sort((a, b) => a.nota - b.nota), semTexto: casos.length - comTexto.length };
  } catch (erro) {
    console.error("[analista] ler", erro);
    return { ok: false, erro: "O banco não respondeu agora. Tente de novo em instantes." };
  }
}
