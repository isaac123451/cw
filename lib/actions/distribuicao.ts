"use server";

import { updateTag } from "next/cache";

import { CASES_TAG, WORKSPACE_TAG } from "@/lib/actions/tags";
import { requireRole, SemPermissao, tryRole } from "@/lib/auth/guard";
import {
  FRENTES_DA_FILA,
  planejarDistribuicao,
  type FrenteDaFila,
  type ItemDaFila,
  type PessoaDoTime,
  type PlanoDeDistribuicao,
} from "@/lib/models/distribuicao";
import { lerItensAbertos, lerPessoasDoTime, moduloDaFrente } from "@/lib/services/distribuicao.service";
import { hojeNaOperacao } from "@/lib/services/reputation.service";

type Falha = { ok: false; erro: string };

/** "sem-dono" ou o id de uma pessoa: de onde sai a fila a distribuir. */
export type OrigemDaFila = string;

export interface Distribuicao {
  ok: true;
  hoje: string;
  eu: string;
  admin: boolean;
  pessoas: PessoaDoTime[];
  /** Abertos sem responsável — ou com alguém que não está mais ativo. */
  semDono: Record<FrenteDaFila, number>;
}

/** A carga de cada pessoa e o que está sem responsável, agora. */
export async function lerDistribuicao(): Promise<Distribuicao | Falha> {
  const ctx = await tryRole("LEITURA").catch(() => null);
  if (!ctx) return { ok: false, erro: "Entre na aplicação para ver a distribuição do time." };
  try {
    const hoje = hojeNaOperacao();
    const itens = await lerItensAbertos(ctx.prisma);
    const pessoas = await lerPessoasDoTime(ctx.prisma, itens, hoje);
    const ativos = new Set(pessoas.map((p) => p.id));
    const semDono = { "reclame-aqui": 0, redes: 0, nps: 0 } as Record<FrenteDaFila, number>;
    for (const i of itens) if (!i.donoId || !ativos.has(i.donoId)) semDono[i.frente] += 1;
    return { ok: true, hoje, eu: ctx.userId, admin: ctx.role === "ADMIN", pessoas, semDono };
  } catch (erro) {
    console.error("[distribuicao]", erro);
    return { ok: false, erro: "O banco não respondeu agora. Tente de novo em instantes." };
  }
}

/**
 * Marca ou tira a ausência. A própria pessoa marca a sua; a de outra
 * pessoa, só administrador.
 */
export async function salvarAusencia(userId: string, ate: string | null): Promise<{ ok: true; ausenteAte: string | null } | Falha> {
  let ctx;
  try {
    ctx = await requireRole("AGENTE");
  } catch (erro) {
    return { ok: false, erro: erro instanceof SemPermissao ? erro.message : "Não foi possível confirmar sua sessão." };
  }
  if (!ctx) return { ok: false, erro: "Sem banco configurado." };
  if (userId !== ctx.userId && ctx.role !== "ADMIN") return { ok: false, erro: "Só administrador marca a ausência de outra pessoa." };
  if (ate !== null && !/^\d{4}-\d{2}-\d{2}$/.test(ate)) return { ok: false, erro: "Data inválida." };
  if (ate !== null && ate < hojeNaOperacao()) return { ok: false, erro: "A volta precisa ser hoje ou depois." };

  try {
    await ctx.prisma.user.update({ where: { id: userId }, data: { ausenteAte: ate ? new Date(`${ate}T00:00:00Z`) : null } });
    updateTag(WORKSPACE_TAG);
    return { ok: true, ausenteAte: ate };
  } catch (erro) {
    console.error("[distribuicao] ausência", erro);
    return { ok: false, erro: "O banco não aceitou a gravação agora. Tente de novo em instantes." };
  }
}

interface PedidoDeDistribuicao {
  origem: OrigemDaFila;
  frentes: FrenteDaFila[];
  destinos: string[];
}

/** A fila da origem, os destinos válidos e o plano — a mesma conta para prever e para gravar. */
async function montarPlano(prisma: Parameters<typeof lerItensAbertos>[0], pedido: PedidoDeDistribuicao) {
  const hoje = hojeNaOperacao();
  const itens = await lerItensAbertos(prisma);
  const pessoas = await lerPessoasDoTime(prisma, itens, hoje);
  const ativos = new Set(pessoas.map((p) => p.id));
  const frentes = new Set(pedido.frentes.filter((f) => FRENTES_DA_FILA.includes(f)));

  const daOrigem = (i: ItemDaFila) => (pedido.origem === "sem-dono" ? !i.donoId || !ativos.has(i.donoId) : i.donoId === pedido.origem);
  const fila = itens.filter((i) => frentes.has(i.frente) && daOrigem(i));
  const destinos = pessoas.filter((p) => pedido.destinos.includes(p.id) && !p.ausente && p.id !== pedido.origem);
  const abertosDoTime = itens.filter((i) => i.donoId && !daOrigem(i)).map((i) => ({ donoId: i.donoId, cliente: i.cliente }));

  return { fila, destinos, plano: planejarDistribuicao(fila, destinos, abertosDoTime), pessoas };
}

function validar(pedido: PedidoDeDistribuicao): string | null {
  if (!pedido.origem || (pedido.origem !== "sem-dono" && !/^[a-z0-9]{10,40}$/i.test(pedido.origem))) return "Escolha de quem é a fila.";
  if (!pedido.frentes.length) return "Escolha ao menos uma frente.";
  if (!pedido.destinos.length) return "Escolha ao menos uma pessoa para receber.";
  return null;
}

/** A prévia: para quem vai cada item, sem gravar nada. */
export async function preverDistribuicao(pedido: PedidoDeDistribuicao): Promise<{ ok: true; plano: PlanoDeDistribuicao } | Falha> {
  const ctx = await tryRole("LEITURA").catch(() => null);
  if (!ctx) return { ok: false, erro: "Entre na aplicação para distribuir." };
  const invalido = validar(pedido);
  if (invalido) return { ok: false, erro: invalido };
  try {
    const { plano } = await montarPlano(ctx.prisma, pedido);
    return { ok: true, plano };
  } catch (erro) {
    console.error("[distribuicao] prévia", erro);
    return { ok: false, erro: "O banco não respondeu agora. Tente de novo em instantes." };
  }
}

/**
 * Grava a distribuição que a pessoa viu na prévia.
 *
 * Refaz a conta no servidor e só grava os itens em que a prévia e a conta
 * de agora concordam — se alguém assumiu um caso entre a prévia e o
 * clique, aquele caso fica com quem assumiu. Cada item ganha uma anotação
 * dizendo de quem para quem passou, e as tarefas abertas do caso vão
 * junto com ele.
 */
export async function aplicarDistribuicao(pedido: PedidoDeDistribuicao & { vistos: { id: string; paraId: string }[] }): Promise<{ ok: true; gravados: number; ignorados: number } | Falha> {
  const invalido = validar(pedido);
  if (invalido) return { ok: false, erro: invalido };

  let ctx;
  try {
    ctx = await requireRole("AGENTE");
    for (const f of new Set(pedido.frentes)) await requireRole("AGENTE", moduloDaFrente(f));
  } catch (erro) {
    return { ok: false, erro: erro instanceof SemPermissao ? erro.message : "Não foi possível confirmar sua sessão." };
  }
  if (!ctx) return { ok: false, erro: "Sem banco configurado." };
  const prisma = ctx.prisma;
  if (pedido.origem !== "sem-dono" && pedido.origem !== ctx.userId && ctx.role !== "ADMIN") {
    return { ok: false, erro: "Só administrador redistribui a fila de outra pessoa." };
  }

  try {
    const { plano, pessoas } = await montarPlano(prisma, pedido);
    const visto = new Map(pedido.vistos.map((v) => [v.id, v.paraId]));
    const valem = plano.atribuicoes.filter((a) => visto.get(a.id) === a.paraId);
    if (valem.length === 0) return { ok: false, erro: "A fila mudou desde a prévia. Veja a prévia de novo." };

    const nome = new Map(pessoas.map((p) => [p.id, p.nome]));
    const quem = nome.get(ctx.userId) ?? "";
    const de = pedido.origem === "sem-dono" ? "sem responsável" : (nome.get(pedido.origem) ?? "quem saiu");
    const texto = (para: string) => `Distribuição do time: passou de ${de} para ${nome.get(para)}${quem ? ` (feito por ${quem})` : ""}.`;
    const eu = ctx.userId;
    const dono = pedido.origem === "sem-dono" ? undefined : pedido.origem;
    /* Confere de novo na gravação: só muda o que ainda está com a origem. */
    const daOrigem = dono ? { ownerId: dono } : { OR: [{ ownerId: null }, { ownerId: { notIn: pessoas.map((p) => p.id) } }] };

    const porDestino = new Map<string, { casos: string[]; nps: string[] }>();
    for (const a of valem) {
      const g = porDestino.get(a.paraId) ?? { casos: [], nps: [] };
      (a.tipo === "caso" ? g.casos : g.nps).push(a.id);
      porDestino.set(a.paraId, g);
    }

    let gravados = 0;
    await prisma.$transaction(async (tx) => {
      for (const [paraId, g] of porDestino) {
        if (g.casos.length) {
          const r = await tx.case.updateMany({ where: { id: { in: g.casos }, ...daOrigem }, data: { ownerId: paraId } });
          gravados += r.count;
          await tx.caseComment.createMany({ data: g.casos.map((caseId) => ({ caseId, body: texto(paraId), authorId: eu, authorName: quem || null })) });
          if (dono) await tx.agendaTask.updateMany({ where: { caseId: { in: g.casos }, done: false, ownerId: dono }, data: { ownerId: paraId } });
        }
        if (g.nps.length) {
          const r = await tx.npsResponse.updateMany({ where: { id: { in: g.nps }, ...daOrigem }, data: { ownerId: paraId } });
          gravados += r.count;
          await tx.npsNote.createMany({ data: g.nps.map((responseId) => ({ responseId, body: texto(paraId), authorId: eu, actor: quem })) });
        }
      }
    }, { timeout: 30_000 });

    updateTag(CASES_TAG);
    updateTag(WORKSPACE_TAG);
    return { ok: true, gravados, ignorados: pedido.vistos.length - valem.length };
  } catch (erro) {
    console.error("[distribuicao] gravar", erro);
    return { ok: false, erro: "O banco não aceitou a gravação agora. Nada foi mudado — tente de novo em instantes." };
  }
}
