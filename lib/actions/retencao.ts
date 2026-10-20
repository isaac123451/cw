"use server";

import { requireRole, SemPermissao, tryRole } from "@/lib/auth/guard";
import { resumoDeRetencao, SETORES, type ClienteEmCancelamento, type DesfechoManual, type ResumoDeRetencao } from "@/lib/models/cancelamento";
import { lerCancelamento, lerClientesEmRisco, lerReclamacoesComRisco, type ReclamacaoComRisco } from "@/lib/services/cancelamento.service";
import type { ClienteEmRisco } from "@/lib/models/clienteEmRisco";

type Falha = { ok: false; erro: string };

/** A conta de cancelamento e retenção, montada agora a partir da base (1.85). */
export async function lerRetencao(): Promise<{ ok: true; clientes: ClienteEmCancelamento[]; resumo: ResumoDeRetencao; emRisco: ClienteEmRisco[]; reclamacoes: ReclamacaoComRisco[] } | Falha> {
  const ctx = await tryRole("LEITURA").catch(() => null);
  if (!ctx) return { ok: false, erro: "Entre na aplicação para ver a retenção." };
  try {
    const { clientes, foraDaConta } = await lerCancelamento(ctx.prisma);
    /* O que a conta já decidiu de cada protocolo — o cartão de chance não pode dizer o contrário. */
    const desfechos = new Map<string, "retido" | "cancelado" | "nao-e-cancelamento">();
    for (const c of clientes) if (!c.retidoSemSinal) for (const p of c.protocolos) desfechos.set(p, c.desfecho);
    for (const c of foraDaConta) for (const p of c.protocolos) desfechos.set(p, "nao-e-cancelamento");
    const [emRisco, reclamacoes] = await Promise.all([
      lerClientesEmRisco(ctx.prisma, clientes).catch(() => []),
      lerReclamacoesComRisco(ctx.prisma, { desfechos }).catch(() => []),
    ]);
    return { ok: true, clientes, resumo: resumoDeRetencao(clientes), emRisco, reclamacoes };
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
export async function marcarDesfecho(chave: string, desfecho: DesfechoManual | null, setor?: string): Promise<{ ok: true } | Falha> {
  let ctx;
  try {
    ctx = await requireRole("AGENTE");
  } catch (erro) {
    return { ok: false, erro: erro instanceof SemPermissao ? erro.message : "Não foi possível confirmar sua sessão." };
  }
  if (!ctx) return { ok: false, erro: "Sem banco configurado." };
  if (!/^(conta|doc|email|caso|tel|nps|conversa):.{1,200}$/.test(chave)) return { ok: false, erro: "Cliente inválido." };
  if (desfecho !== null && !["retido", "cancelado", "cancelado-outro-setor", "nao-e-cancelamento"].includes(desfecho)) return { ok: false, erro: "Desfecho inválido." };
  /* O setor que cancelou mora na nota; só os da lista. */
  const nota = desfecho === "cancelado-outro-setor" ? ((SETORES as readonly string[]).includes(setor ?? "") ? setor! : "Outro setor") : null;

  try {
    if (desfecho === null) {
      await ctx.prisma.desfechoDeCancelamento.deleteMany({ where: { chave } });
    } else {
      const eu = await ctx.prisma.user.findUnique({ where: { id: ctx.userId }, select: { name: true } });
      await ctx.prisma.desfechoDeCancelamento.upsert({
        where: { chave },
        create: { chave, desfecho, nota, por: eu?.name ?? null },
        update: { desfecho, nota, por: eu?.name ?? null, em: new Date() },
      });
    }
    return { ok: true };
  } catch (erro) {
    console.error("[retencao] marcar", erro);
    return { ok: false, erro: "O banco não aceitou agora. Tente de novo." };
  }
}

/** A chance de cancelar de um caso, para a ficha (1.113). */
export async function lerRiscoDoCaso(caseId: string): Promise<ReclamacaoComRisco | null> {
  const ctx = await tryRole("LEITURA").catch(() => null);
  if (!ctx || !/^[\w-]{6,60}$/.test(caseId)) return null;
  try {
    const [um] = await lerReclamacoesComRisco(ctx.prisma, { caseId, incluirBaixo: true });
    return um ?? null;
  } catch (erro) {
    console.error("[retencao] risco do caso", erro);
    return null;
  }
}
