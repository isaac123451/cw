"use server";

import { requireRole, SemPermissao, tryRole } from "@/lib/auth/guard";

export interface ErroDaExtensaoView {
  id: string;
  onde: string;
  mensagem: string;
  pilha: string | null;
  versao: string;
  vezes: number;
  quem: string | null;
  primeiraEm: string;
  ultimaEm: string;
}

/** Os erros da extensão dos últimos 30 dias, o mais recente primeiro. */
export async function lerErrosDaExtensao(): Promise<{ ok: true; lista: ErroDaExtensaoView[] } | { ok: false; erro: string }> {
  const ctx = await tryRole("LEITURA").catch(() => null);
  if (!ctx) return { ok: false, erro: "Entre na aplicação para ver os erros da extensão." };
  try {
    const linhas = await ctx.prisma.erroDaExtensao.findMany({
      where: { ultimaEm: { gte: new Date(Date.now() - 30 * 86_400_000) } },
      orderBy: { ultimaEm: "desc" },
      take: 100,
    });
    return {
      ok: true,
      lista: linhas.map((l) => ({ ...l, primeiraEm: l.primeiraEm.toISOString(), ultimaEm: l.ultimaEm.toISOString() })),
    };
  } catch (erro) {
    console.error("[erros da extensão] ler", erro);
    return { ok: false, erro: "O banco não respondeu agora." };
  }
}

/** Dá o erro por resolvido — some da lista; se acontecer de novo, volta. */
export async function resolverErroDaExtensao(id: string): Promise<{ ok: true } | { ok: false; erro: string }> {
  let ctx;
  try {
    ctx = await requireRole("AGENTE");
  } catch (erro) {
    return { ok: false, erro: erro instanceof SemPermissao ? erro.message : "Não foi possível confirmar sua sessão." };
  }
  if (!ctx) return { ok: false, erro: "Sem banco configurado." };
  try {
    await ctx.prisma.erroDaExtensao.delete({ where: { id } });
    return { ok: true };
  } catch {
    return { ok: false, erro: "Não foi possível agora." };
  }
}
