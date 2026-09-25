"use server";

import { requireRole, SemPermissao, tryRole } from "@/lib/auth/guard";
import { criarLote, lotesRecentes, mudarLote } from "@/lib/services/disparos.service";
import type { ItemNovo, LoteView, OrigemDoDisparo } from "@/lib/models/disparos";

/*
  Os disparos em lote pela plataforma (1.78): montar a lista e acompanhar.
  Quem trabalha a lista é a extensão, no WhatsApp Web — ver
  `app/api/extensao/disparos`.
*/

type Falha = { ok: false; erro: string };

function traduzir(erro: unknown) {
  const codigo = (erro as { code?: string })?.code;
  if (codigo === "P2021" || codigo === "P2022") return "As tabelas de disparo ainda não existem no banco. Rode npm run db:push e depois npm run db:rls — uma vez só.";
  console.error("[disparos]", erro);
  return "O banco não aceitou agora. Tente de novo em instantes.";
}

export async function criarLoteDeDisparo(entrada: {
  nome: string;
  origem: OrigemDoDisparo;
  campanhaId?: string;
  itens: ItemNovo[];
}): Promise<{ ok: true; id: string; itens: number } | Falha> {
  let ctx;
  try {
    ctx = await requireRole("AGENTE");
  } catch (erro) {
    return { ok: false, erro: erro instanceof SemPermissao ? erro.message : "Não foi possível confirmar sua sessão. Entre de novo." };
  }
  if (!ctx) return { ok: false, erro: "Sem banco configurado — nada é gravado no modo demonstração." };
  if (!["premio", "avaliacao"].includes(entrada.origem)) return { ok: false, erro: "Origem inválida." };

  try {
    const eu = await ctx.prisma.user.findUnique({ where: { id: ctx.userId }, select: { name: true } });
    const r = await criarLote(ctx.prisma, { ...entrada, autor: { id: ctx.userId, nome: eu?.name ?? "Operação" } });
    if ("erro" in r) return { ok: false, erro: r.erro! };
    return { ok: true, id: r.id, itens: r.itens };
  } catch (erro) {
    return { ok: false, erro: traduzir(erro) };
  }
}

export async function lerLotesDeDisparo(): Promise<{ ok: true; lotes: LoteView[] } | Falha> {
  const ctx = await tryRole("LEITURA").catch(() => null);
  if (!ctx) return { ok: true, lotes: [] };
  try {
    return { ok: true, lotes: await lotesRecentes(ctx.prisma) };
  } catch (erro) {
    return { ok: false, erro: traduzir(erro) };
  }
}

export async function pararLoteDeDisparo(id: string): Promise<{ ok: true } | Falha> {
  let ctx;
  try {
    ctx = await requireRole("AGENTE");
  } catch (erro) {
    return { ok: false, erro: erro instanceof SemPermissao ? erro.message : "Não foi possível confirmar sua sessão." };
  }
  if (!ctx) return { ok: false, erro: "Sem banco configurado." };
  try {
    const r = await mudarLote(ctx.prisma, id, "parado", { id: ctx.userId });
    return "erro" in r ? { ok: false, erro: r.erro! } : { ok: true };
  } catch (erro) {
    return { ok: false, erro: traduzir(erro) };
  }
}
