"use server";

import { requireRole, SemPermissao, tryRole } from "@/lib/auth/guard";
import { chaveDaReclamacao, resumoDeRetencao, SETORES, type ClienteEmCancelamento, type DesfechoManual, type ResumoDeRetencao } from "@/lib/models/cancelamento";
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
export async function marcarDesfecho(chave: string, desfecho: DesfechoManual | null, setor?: string, todasAsChaves?: string[]): Promise<{ ok: true } | Falha> {
  return gravarDesfecho(chave, desfecho, setor, todasAsChaves);
}

/**
 * A gravação de fato, fora das ações exportadas. Uma ação não pode chamar
 * outra ação exportada do mesmo arquivo: na página que só registrou a
 * primeira, a segunda é uma referência vazia — e o "Retido" da ficha caía
 * em "Cannot read properties of undefined (reading 'apply')" (20/10).
 */
async function gravarDesfecho(chave: string, desfecho: DesfechoManual | null, setor?: string, todasAsChaves?: string[]): Promise<{ ok: true } | Falha> {
  let ctx;
  try {
    ctx = await requireRole("AGENTE");
  } catch (erro) {
    return { ok: false, erro: erro instanceof SemPermissao ? erro.message : "Não foi possível confirmar sua sessão." };
  }
  if (!ctx) return { ok: false, erro: "Sem banco configurado." };
  const valida = (k: string) => /^(conta|doc|email|caso|tel|nps|conversa):.{1,200}$/.test(k);
  if (!valida(chave) || (todasAsChaves ?? []).some((k) => !valida(k))) return { ok: false, erro: "Cliente inválido." };
  if (desfecho !== null && !["retido", "cancelado", "cancelado-outro-setor", "nao-e-cancelamento"].includes(desfecho)) return { ok: false, erro: "Desfecho inválido." };
  /* O setor que cancelou mora na nota; só os da lista. */
  const nota = desfecho === "cancelado-outro-setor" ? ((SETORES as readonly string[]).includes(setor ?? "") ? setor! : "Outro setor") : null;

  try {
    if (desfecho === null) {
      /* Voltar ao automático apaga a marca de todas as chaves do cliente — inclusive a de uma reclamação marcada na ficha. */
      await ctx.prisma.desfechoDeCancelamento.deleteMany({ where: { chave: { in: [chave, ...(todasAsChaves ?? [])].slice(0, 50) } } });
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

/** "nao-e-cancelamento" = o cliente não solicitou o cancelamento. */
export type MarcaDaReclamacao = "retido" | "cancelado" | "cancelado-outro-setor" | "nao-e-cancelamento";

export interface ReclamacaoMarcada {
  protocolo: string;
  cliente: string;
  /** A marca à mão desta reclamação, se houver. */
  marca: MarcaDaReclamacao | null;
  setor?: string;
  por?: string;
}

/**
 * Acha a reclamação por protocolo ("RA-…"), id da tela, id do banco ou o
 * link do Reclame Aqui (".../titulo_AbC123/").
 */
async function acharReclamacao(prisma: NonNullable<Awaited<ReturnType<typeof tryRole>>>["prisma"], ref: string) {
  let r = ref.trim();
  if (/reclameaqui\.com\.br/i.test(r)) r = r.replace(/[?#].*$/, "").replace(/\/+$/, "").split("/").pop()?.split("_").pop() ?? "";
  if (!/^[\w-]{4,80}$/.test(r)) return null;
  return prisma.case.findFirst({
    where: { OR: [{ id: r }, { externalId: r }, { protocol: r }, { protocol: `RA-${r}` }] },
    select: { protocol: true, customer: true, establishment: { select: { name: true } } },
  });
}

/** A marca de uma reclamação (para a ficha do caso mostrar o botão certo). */
export async function lerMarcaDaReclamacao(ref: string): Promise<ReclamacaoMarcada | null> {
  const ctx = await tryRole("LEITURA").catch(() => null);
  if (!ctx) return null;
  try {
    const caso = await acharReclamacao(ctx.prisma, ref);
    if (!caso) return null;
    const linha = await ctx.prisma.desfechoDeCancelamento.findUnique({ where: { chave: chaveDaReclamacao(caso.protocol) } }).catch(() => null);
    const marca = linha ? (linha.desfecho as MarcaDaReclamacao) : null;
    return { protocolo: caso.protocol, cliente: caso.establishment?.name || caso.customer, marca, setor: linha?.nota ?? undefined, por: linha?.por ?? undefined };
  } catch (erro) {
    console.error("[retencao] marca da reclamação", erro);
    return null;
  }
}

/**
 * Marca uma reclamação como retido ou churn (cancelou) — da ficha do caso
 * ou do "Adicionar reclamação" da Retenção (20/10/2026: "preciso de um
 * botão para adicionar a reclamação para churn e retido"). A reclamação
 * entra na conta mesmo que o texto não fale em cancelar. `null` tira.
 */
export async function marcarReclamacao(ref: string, marca: MarcaDaReclamacao | null, setor?: string): Promise<({ ok: true } & ReclamacaoMarcada) | Falha> {
  let ctx;
  try {
    ctx = await requireRole("AGENTE");
  } catch (erro) {
    return { ok: false, erro: erro instanceof SemPermissao ? erro.message : "Não foi possível confirmar sua sessão." };
  }
  if (!ctx) return { ok: false, erro: "Sem banco configurado." };
  const caso = await acharReclamacao(ctx.prisma, ref).catch(() => null);
  if (!caso) return { ok: false, erro: "Não achei essa reclamação. Use o protocolo (RA-…) ou o link do Reclame Aqui." };
  const r = await gravarDesfecho(chaveDaReclamacao(caso.protocol), marca, setor);
  if (!r.ok) return r;
  return { ok: true, protocolo: caso.protocol, cliente: caso.establishment?.name || caso.customer, marca, setor: marca === "cancelado-outro-setor" ? setor : undefined };
}

/**
 * As marcas de várias reclamações de uma vez — a lista do Reclame Aqui
 * mostra o botão de cada linha já preenchido, sem uma consulta por linha.
 */
export async function lerMarcasDasReclamacoes(protocolos: string[]): Promise<Record<string, { marca: MarcaDaReclamacao; setor?: string }>> {
  const ctx = await tryRole("LEITURA").catch(() => null);
  if (!ctx || !Array.isArray(protocolos) || !protocolos.length) return {};
  try {
    const chaves = protocolos.slice(0, 1000).map((p) => chaveDaReclamacao(String(p)));
    const linhas = await ctx.prisma.desfechoDeCancelamento.findMany({ where: { chave: { in: chaves } }, select: { chave: true, desfecho: true, nota: true } });
    return Object.fromEntries(linhas.map((l) => [l.chave.slice(5), { marca: l.desfecho as MarcaDaReclamacao, setor: l.nota ?? undefined }]));
  } catch (erro) {
    console.error("[retencao] marcas das reclamações", erro);
    return {};
  }
}
