"use server";

import { requireRole, SemPermissao, tryRole } from "@/lib/auth/guard";
import { resumoDeRetencao, type ClienteEmCancelamento, type DesfechoManual, type ResumoDeRetencao } from "@/lib/models/cancelamento";
import { lerClientesEmCancelamento } from "@/lib/services/cancelamento.service";

type Falha = { ok: false; erro: string };

/** A conta de cancelamento e retenção, montada agora a partir da base (1.85). */
export async function lerRetencao(): Promise<{ ok: true; clientes: ClienteEmCancelamento[]; resumo: ResumoDeRetencao } | Falha> {
  const ctx = await tryRole("LEITURA").catch(() => null);
  if (!ctx) return { ok: false, erro: "Entre na aplicação para ver a retenção." };
  try {
    const clientes = await lerClientesEmCancelamento(ctx.prisma);
    return { ok: true, clientes, resumo: resumoDeRetencao(clientes) };
  } catch (erro) {
    console.error("[retencao]", erro);
    return { ok: false, erro: "O banco não respondeu agora. Tente de novo em instantes." };
  }
}

/**
 * Corrige o desfecho de um cliente à mão — ou volta à leitura automática
 * (`null`). A correção vale acima dos sinais; "não é cancelamento" tira o
 * cliente da conta.
 */
export async function marcarDesfecho(chave: string, desfecho: DesfechoManual | null): Promise<{ ok: true } | Falha> {
  let ctx;
  try {
    ctx = await requireRole("AGENTE");
  } catch (erro) {
    return { ok: false, erro: erro instanceof SemPermissao ? erro.message : "Não foi possível confirmar sua sessão." };
  }
  if (!ctx) return { ok: false, erro: "Sem banco configurado." };
  if (!/^(conta|doc|email|caso|tel|nps|conversa):.{1,200}$/.test(chave)) return { ok: false, erro: "Cliente inválido." };
  if (desfecho !== null && !["retido", "cancelado", "nao-e-cancelamento"].includes(desfecho)) return { ok: false, erro: "Desfecho inválido." };

  try {
    if (desfecho === null) {
      await ctx.prisma.desfechoDeCancelamento.deleteMany({ where: { chave } });
    } else {
      const eu = await ctx.prisma.user.findUnique({ where: { id: ctx.userId }, select: { name: true } });
      await ctx.prisma.desfechoDeCancelamento.upsert({
        where: { chave },
        create: { chave, desfecho, por: eu?.name ?? null },
        update: { desfecho, por: eu?.name ?? null, em: new Date() },
      });
    }
    return { ok: true };
  } catch (erro) {
    console.error("[retencao] marcar", erro);
    return { ok: false, erro: "O banco não aceitou agora. Tente de novo." };
  }
}
