"use server";

import { requireRole, SemPermissao, tryRole } from "@/lib/auth/guard";
import { alvoValido, SEM_AJUSTES, type AjustesDeMeta, type EscopoDaMeta } from "@/lib/models/ajusteDeMeta";
import { cicloDe } from "@/lib/models/ciclo";
import { hojeNaOperacao } from "@/lib/services/reputation.service";

type Falha = { ok: false; erro: string };

const CHAVES: Record<EscopoDaMeta, string[]> = {
  dia: ["primeiros-contatos", "respostas", "pedidos", "detratores"],
  ciclo: ["respostas", "avaliacoes", "pedidos", "detratores", "revertidos"],
};

/** O período de agora, pelo relógio do servidor: o dia, ou o id do ciclo. */
function periodoAtual(escopo: EscopoDaMeta) {
  const hoje = hojeNaOperacao();
  return escopo === "dia" ? hoje : cicloDe(hoje).id;
}

/** Os ajustes de metas de quem abriu a tela (1.114): os de hoje, os do ciclo e os padrões. */
export async function lerAjustesDeMeta(): Promise<{ dia: AjustesDeMeta; ciclo: AjustesDeMeta }> {
  const ctx = await tryRole("LEITURA").catch(() => null);
  if (!ctx) return { dia: SEM_AJUSTES, ciclo: SEM_AJUSTES };
  try {
    const linhas = await ctx.prisma.ajusteDeMeta.findMany({
      where: { userId: ctx.userId, periodo: { in: [periodoAtual("dia"), periodoAtual("ciclo"), "padrao"] } },
      select: { escopo: true, chave: true, periodo: true, alvo: true },
    });
    const montar = (escopo: EscopoDaMeta): AjustesDeMeta => ({
      doPeriodo: Object.fromEntries(linhas.filter((l) => l.escopo === escopo && l.periodo !== "padrao").map((l) => [l.chave, l.alvo])),
      padrao: Object.fromEntries(linhas.filter((l) => l.escopo === escopo && l.periodo === "padrao").map((l) => [l.chave, l.alvo])),
    });
    return { dia: montar("dia"), ciclo: montar("ciclo") };
  } catch (erro) {
    console.error("[metas] ler ajustes", erro);
    return { dia: SEM_AJUSTES, ciclo: SEM_AJUSTES };
  }
}

/**
 * Grava os números da pessoa. `null` numa chave volta ao automático
 * (apaga o ajuste daquele período). "atual" é hoje (ou este ciclo);
 * "padrao" vale daqui para frente — e tira o ajuste só de hoje da mesma
 * meta, para o número novo valer já.
 */
export async function salvarAjustesDeMeta(entrada: {
  escopo: EscopoDaMeta;
  periodo: "atual" | "padrao";
  alvos: Record<string, number | null>;
}): Promise<{ ok: true } | Falha> {
  let ctx;
  try {
    ctx = await requireRole("AGENTE");
  } catch (erro) {
    return { ok: false, erro: erro instanceof SemPermissao ? erro.message : "Não foi possível confirmar sua sessão." };
  }
  if (!ctx) return { ok: false, erro: "Sem banco configurado." };
  if (entrada.escopo !== "dia" && entrada.escopo !== "ciclo") return { ok: false, erro: "Meta inválida." };

  const chaves = Object.keys(entrada.alvos).filter((k) => CHAVES[entrada.escopo].includes(k));
  if (chaves.length === 0) return { ok: false, erro: "Nenhuma meta para salvar." };
  for (const k of chaves) {
    const v = entrada.alvos[k];
    if (v !== null && alvoValido(v) === null) return { ok: false, erro: "Use números inteiros de 0 a 500." };
  }

  const periodo = entrada.periodo === "padrao" ? "padrao" : periodoAtual(entrada.escopo);
  const userId = ctx.userId;
  try {
    await ctx.prisma.$transaction(async (tx) => {
      for (const chave of chaves) {
        const v = entrada.alvos[chave];
        const onde = { userId_escopo_chave_periodo: { userId, escopo: entrada.escopo, chave, periodo } };
        if (v === null) {
          await tx.ajusteDeMeta.deleteMany({ where: { userId, escopo: entrada.escopo, chave, periodo } });
        } else {
          const alvo = alvoValido(v)!;
          await tx.ajusteDeMeta.upsert({ where: onde, create: { userId, escopo: entrada.escopo, chave, periodo, alvo }, update: { alvo } });
        }
        /* O padrão novo vale já: o ajuste só deste período da mesma meta sai. */
        if (periodo === "padrao") {
          await tx.ajusteDeMeta.deleteMany({ where: { userId, escopo: entrada.escopo, chave, periodo: periodoAtual(entrada.escopo) } });
        }
      }
    });
    return { ok: true };
  } catch (erro) {
    console.error("[metas] salvar ajustes", erro);
    return { ok: false, erro: "O banco não aceitou a gravação agora. Tente de novo em instantes." };
  }
}
