"use server";

import { requireRole, SemPermissao, tryRole } from "@/lib/auth/guard";
import { MAXIMO_DE_CONCORRENTES, slugDoEndereco, type LinhaDoSegmento } from "@/lib/models/segmento";
import { lerComparacao } from "@/lib/services/segmento.service";

type Falha = { ok: false; erro: string };

const PERIODOS = new Set(["SIX_MONTHS", "TWELVE_MONTHS", "LAST_YEAR", "LAST_THREE_YEARS"]);

/** A tabela da comparação com o segmento, no período pedido (1.107). */
export async function lerComparacaoDoSegmento(tipo = "SIX_MONTHS"): Promise<{ ok: true; linhas: LinhaDoSegmento[]; concorrentes: string[] } | Falha> {
  const ctx = await tryRole("LEITURA", "reclame-aqui").catch(() => null);
  if (!ctx) return { ok: false, erro: "Entre na aplicação para ver a comparação." };
  try {
    return { ok: true, ...(await lerComparacao(ctx.prisma, PERIODOS.has(tipo) ? tipo : "SIX_MONTHS")) };
  } catch (erro) {
    console.error("[segmento]", erro);
    return { ok: false, erro: "O banco não respondeu agora. Tente de novo em instantes." };
  }
}

/**
 * Grava a lista de empresas parecidas. Aceita o link da página da empresa
 * no Reclame Aqui ou o endereço curto; o que não der para reconhecer volta
 * como erro, sem gravar nada.
 */
export async function salvarConcorrentes(entradas: string[]): Promise<{ ok: true; concorrentes: string[] } | Falha> {
  let ctx;
  try {
    ctx = await requireRole("AGENTE", "reclame-aqui");
  } catch (erro) {
    return { ok: false, erro: erro instanceof SemPermissao ? erro.message : "Não foi possível confirmar sua sessão." };
  }
  if (!ctx) return { ok: false, erro: "Sem banco configurado." };

  const lidas = entradas.map((e) => e.trim()).filter(Boolean);
  const invalidas = lidas.filter((e) => !slugDoEndereco(e));
  if (invalidas.length) return { ok: false, erro: `Não reconheci: ${invalidas.slice(0, 3).join(", ")}. Cole o link da página da empresa no Reclame Aqui.` };
  const concorrentes = [...new Set(lidas.map((e) => slugDoEndereco(e)!))];
  if (concorrentes.length > MAXIMO_DE_CONCORRENTES) return { ok: false, erro: `No máximo ${MAXIMO_DE_CONCORRENTES} empresas.` };

  try {
    await ctx.prisma.operacaoConfig.upsert({
      where: { id: "unico" },
      create: { id: "unico", concorrentesRA: concorrentes, updatedBy: ctx.userId },
      update: { concorrentesRA: concorrentes, updatedBy: ctx.userId },
    });
    return { ok: true, concorrentes };
  } catch (erro) {
    console.error("[segmento] salvar", erro);
    return { ok: false, erro: "O banco não aceitou a gravação agora. Tente de novo em instantes." };
  }
}
