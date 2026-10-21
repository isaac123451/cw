"use server";

import { requireRole, SemPermissao, tryRole } from "@/lib/auth/guard";

export interface AprendizadoView {
  id: string;
  assunto: string;
  texto: string;
  fonte: "whatsapp" | "slack";
  vezes: number;
  atualizadoEm: string;
}

/** O que a IA aprendeu com as conversas do time, os mais repetidos primeiro. */
export async function lerAprendizados(): Promise<{ ok: true; lista: AprendizadoView[] } | { ok: false; erro: string }> {
  const ctx = await tryRole("LEITURA").catch(() => null);
  if (!ctx) return { ok: false, erro: "Entre na aplicação para ver o que a IA aprendeu." };
  try {
    const linhas = await ctx.prisma.aprendizadoDaIA.findMany({ where: { ativo: true }, orderBy: [{ vezes: "desc" }, { atualizadoEm: "desc" }], take: 500 });
    return {
      ok: true,
      lista: linhas.map((l) => ({ id: l.id, assunto: l.assunto, texto: l.texto, fonte: l.fonte === "slack" ? "slack" : "whatsapp", vezes: l.vezes, atualizadoEm: l.atualizadoEm.toISOString() })),
    };
  } catch (erro) {
    console.error("[aprendizados] ler", erro);
    return { ok: false, erro: "O banco não respondeu agora. Tente de novo em instantes." };
  }
}

/**
 * Esquece um aprendizado. Fica guardado como inativo — se a mesma coisa
 * aparecer de novo nas conversas, não volta sozinha.
 */
export async function esquecerAprendizado(id: string): Promise<{ ok: true } | { ok: false; erro: string }> {
  let ctx;
  try {
    ctx = await requireRole("AGENTE");
  } catch (erro) {
    return { ok: false, erro: erro instanceof SemPermissao ? erro.message : "Não foi possível confirmar sua sessão." };
  }
  if (!ctx) return { ok: false, erro: "Sem banco configurado." };
  try {
    await ctx.prisma.aprendizadoDaIA.update({ where: { id }, data: { ativo: false } });
    return { ok: true };
  } catch (erro) {
    console.error("[aprendizados] esquecer", erro);
    return { ok: false, erro: "Não foi possível esquecer agora. Tente de novo." };
  }
}
