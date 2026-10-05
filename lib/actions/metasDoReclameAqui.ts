"use server";

import { requireRole, SemPermissao, tryRole } from "@/lib/auth/guard";
import { getSession } from "@/lib/auth/session";
import type { MetaDoMes } from "@/lib/models/planoDeAcao";

/**
 * As metas do Reclame Aqui por mês (1.133) — lidas por quem vê o módulo,
 * gravadas por administrador. Meta é decisão de gestão: a equipe vê o
 * plano; quem define o alvo é quem responde por ele.
 */

type Falha = { ok: false; erro: string };

export interface MetasGravadas {
  metas: MetaDoMes[];
  podeEditar: boolean;
  atualizadas: { mes: string; em: string; por: string | null }[];
}

export async function lerMetasDoReclameAqui(): Promise<MetasGravadas> {
  const ctx = await tryRole("LEITURA", "reclame-aqui");
  if (!ctx) return { metas: [], podeEditar: false, atualizadas: [] };
  const linhas = await ctx.prisma.metaDoReclameAqui.findMany({ orderBy: { mes: "asc" } });
  return {
    metas: linhas.map((l) => ({
      mes: l.mes,
      nota: l.nota,
      resposta: l.resposta,
      consumidor: l.consumidor,
      solucao: l.solucao,
      voltaria: l.voltaria,
      avaliacoes: l.avaliacoes,
      recebidasPrevistas: l.recebidasPrevistas,
      observacao: l.observacao,
    })),
    podeEditar: ctx.role === "ADMIN",
    atualizadas: linhas.map((l) => ({ mes: l.mes, em: l.atualizadoEm.toISOString(), por: l.atualizadoPor })),
  };
}

const LIMITES: Record<"nota" | "resposta" | "consumidor" | "solucao" | "voltaria", [number, number]> = {
  nota: [0, 10],
  resposta: [0, 100],
  consumidor: [0, 10],
  solucao: [0, 100],
  voltaria: [0, 100],
};

/** Confere uma meta vinda da tela; devolve a mensagem do primeiro problema. */
function validarMeta(m: MetaDoMes): string | null {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(m.mes ?? "")) return "Mês inválido.";
  for (const [campo, [min, max]] of Object.entries(LIMITES) as [keyof typeof LIMITES, [number, number]][]) {
    const v = m[campo];
    if (v == null) continue;
    if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max) return `${campo === "nota" ? "A nota" : campo === "consumidor" ? "A nota do consumidor" : "A porcentagem"} de ${m.mes} precisa ficar entre ${min} e ${max}.`;
  }
  for (const campo of ["avaliacoes", "recebidasPrevistas"] as const) {
    const v = m[campo];
    if (v == null) continue;
    if (!Number.isInteger(v) || v < 0 || v > 100000) return `${campo === "avaliacoes" ? "As avaliações" : "As reclamações previstas"} de ${m.mes} precisam ser um número inteiro.`;
  }
  if (m.observacao != null && m.observacao.length > 300) return "A observação passa de 300 caracteres.";
  return null;
}

/**
 * Grava as metas dos meses enviados. Mês com tudo vazio sai da base — é
 * a pessoa limpando a meta na tela.
 */
export async function salvarMetasDoReclameAqui(metas: MetaDoMes[]): Promise<({ ok: true } & MetasGravadas) | Falha> {
  let ctx;
  try {
    ctx = await requireRole("ADMIN", "reclame-aqui");
  } catch (erro) {
    return { ok: false, erro: erro instanceof SemPermissao ? "Só administrador define as metas." : "Não foi possível confirmar sua sessão." };
  }
  if (!ctx) return { ok: false, erro: "Sem banco configurado." };
  if (!Array.isArray(metas) || metas.length === 0 || metas.length > 36) return { ok: false, erro: "Nada para gravar." };

  for (const m of metas) {
    const problema = validarMeta(m);
    if (problema) return { ok: false, erro: problema };
  }

  const por = (await getSession())?.name ?? null;
  try {
    await ctx.prisma.$transaction(
      metas.map((m) => {
        const dados = {
          nota: m.nota ?? null,
          resposta: m.resposta ?? null,
          consumidor: m.consumidor ?? null,
          solucao: m.solucao ?? null,
          voltaria: m.voltaria ?? null,
          avaliacoes: m.avaliacoes ?? null,
          recebidasPrevistas: m.recebidasPrevistas ?? null,
          observacao: m.observacao?.trim() || null,
        };
        const vazia = Object.values(dados).every((v) => v == null);
        return vazia
          ? ctx.prisma.metaDoReclameAqui.deleteMany({ where: { mes: m.mes } })
          : ctx.prisma.metaDoReclameAqui.upsert({ where: { mes: m.mes }, update: { ...dados, atualizadoPor: por }, create: { mes: m.mes, ...dados, atualizadoPor: por } });
      })
    );
  } catch (erro) {
    return { ok: false, erro: erro instanceof Error ? `As metas não foram gravadas: ${erro.message}` : "As metas não foram gravadas." };
  }
  return { ok: true, ...(await lerMetasDoReclameAqui()) };
}
