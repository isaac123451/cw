"use server";

import { tryRole } from "@/lib/auth/guard";
import { confiancaRecuperada, type ConfiancaDoPeriodo } from "@/lib/models/okr";
import { detratoresDoPeriodo } from "@/lib/services/okr.service";

/**
 * A confiança recuperada num período (17/11/2026): "a parte do nps não
 * mostra quantos casos teve recuperação de confiança". A mesma conta do
 * KR1 do OKR (`confiancaRecuperada`): por conta, detrator com a solução
 * confirmada e "Sim" na pesquisa de confiança. Aqui sem corte de entrada —
 * o período é o da tela.
 */
export async function lerConfiancaDoPeriodo(
  inicio: string,
  fim: string
): Promise<{ ok: true; confianca: ConfiancaDoPeriodo; semTabela: boolean } | { ok: false; erro: string }> {
  const ctx = await tryRole("LEITURA").catch(() => null);
  if (!ctx) return { ok: false, erro: "Entre na aplicação para ver a confiança recuperada." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(inicio) || !/^\d{4}-\d{2}-\d{2}$/.test(fim)) return { ok: false, erro: "Período inválido." };
  try {
    const { detratores, semTabela } = await detratoresDoPeriodo(ctx.prisma, inicio, fim);
    return { ok: true, confianca: confiancaRecuperada(detratores, { inicio, corte: null, ate: fim }), semTabela };
  } catch (erro) {
    console.error("[nps] confiança do período", erro);
    return { ok: false, erro: "O banco não respondeu agora." };
  }
}
