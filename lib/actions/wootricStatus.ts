"use server";

import { tryRole } from "@/lib/auth/guard";

/**
 * O retrato do Wootric, em três perguntas (Fase 10 — "todo aviso leva
 * ao que resolve").
 *
 * **O relato.** "O Wootric não está funcionando." Medido em 16/09/2026,
 * no banco: a importação trazia respostas do dia, e o "concluir" já
 * tinha marcado 14 respostas lá — o que não saía era **a nota** com os
 * detalhes do caso, recusada 8 vezes com "a nota precisa de um login de
 * usuário". Três coisas diferentes com o mesmo nome, e a que falhava é a
 * única que depende de uma configuração que só o dono da conta pode
 * fazer.
 *
 * Este retrato separa as três, com números do banco, e diz exatamente o
 * que falta — em vez de a pessoa descobrir abrindo ficha por ficha.
 *
 * Nada aqui fala com o Wootric: é leitura do que ficou gravado das
 * tentativas, para a tela abrir na hora e não gastar cota da API.
 */

export interface RetratoDoWootric {
  importacao: {
    configurada: boolean;
    /** Quando entrou a resposta mais recente trazida do Wootric. */
    ultimaEm: string | null;
    respostasHoje: number;
  };
  conclusao: {
    concluidas: number;
    ultimaEm: string | null;
  };
  nota: {
    loginConfigurado: boolean;
    enviadas: number;
    recusadas: number;
    /** A frase mais recente que o Wootric (ou a configuração) devolveu. */
    ultimoErro: string | null;
  };
}

export async function retratoDoWootric(): Promise<RetratoDoWootric | null> {

  const ctx = await tryRole("LEITURA", "nps");

  if (!ctx) return null;

  const { prisma } = ctx;

  const inicioDoDia = new Date(
    `${new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" })}T03:00:00Z`
  );

  const [maisRecente, hoje, concluidas, ultimaConclusao, enviadas, recusadas, ultimoErro] =
    await Promise.all([
      prisma.npsResponse.findFirst({
        where: { externalId: { not: null } },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
      prisma.npsResponse.count({
        where: { externalId: { not: null }, createdAt: { gte: inicioDoDia } },
      }),
      prisma.npsResponse.count({ where: { wootricConcluidoEm: { not: null } } }),
      prisma.npsResponse.findFirst({
        where: { wootricConcluidoEm: { not: null } },
        orderBy: { wootricConcluidoEm: "desc" },
        select: { wootricConcluidoEm: true },
      }),
      prisma.npsResponse.count({ where: { wootricNotaEm: { not: null } } }),
      prisma.npsResponse.count({ where: { wootricErro: { not: null } } }),
      prisma.npsResponse.findFirst({
        where: { wootricErro: { not: null } },
        orderBy: { closedAt: "desc" },
        select: { wootricErro: true },
      }),
    ]);

  const definida = (nome: string) => (process.env[nome] ?? "").trim() !== "";

  return {
    importacao: {
      configurada:
        (definida("WOOTRIC_CLIENT_ID") && definida("WOOTRIC_CLIENT_SECRET")) ||
        definida("WOOTRIC_ACCESS_TOKEN"),
      ultimaEm: maisRecente?.createdAt.toISOString() ?? null,
      respostasHoje: hoje,
    },
    conclusao: {
      concluidas,
      ultimaEm: ultimaConclusao?.wootricConcluidoEm?.toISOString() ?? null,
    },
    nota: {
      loginConfigurado: definida("WOOTRIC_USUARIO") && definida("WOOTRIC_SENHA"),
      enviadas,
      recusadas,
      ultimoErro: ultimoErro?.wootricErro ?? null,
    },
  };
}
