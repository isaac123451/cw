"use server";

import { revalidatePath } from "next/cache";

import { requireRole, tryRole } from "@/lib/auth/guard";
import type { Modulo } from "@/lib/auth/modules";

import { getSession } from "@/lib/auth/session";

/**
 * Analytics não é módulo próprio na régua de permissões — a reputação
 * que ele mede é a do Reclame Aqui, e é esse acesso que faz sentido
 * exigir. Inventar um módulo aqui criaria uma permissão que ninguém
 * cadastrou e que, por isso, cairia no papel da conta de qualquer jeito.
 */
const MODULO: Modulo = "reclame-aqui";

/**
 * O histórico diário de reputação, e o preenchimento do que falta.
 *
 * A leitura é aberta a quem tem acesso de leitura; a gravação exige
 * **AGENTE**, porque preencher visualizações do portal é registro da
 * operação e não consulta.
 */

export interface LinhaDeMetrica {
  dia: string;

  entrantes: number;
  notaReputacao: number;
  respondidas: number;
  naoRespondidas: number;
  notaConsumidor: number;
  voltariam: number;
  resolvidasPct: number;
  tempoMedioHoras: number;
  churn: number;
  retidos: number;

  /** Nulo é "ninguém preencheu" — nunca zero. */
  visualizacoes: number | null;
  ciclosComSelo: number | null;
  desativadas: number | null;
  resolvidasCiclo: number | null;

  preenchidoPor: string | null;
}

export async function lerMetricas(
  de: string,
  ate: string
): Promise<LinhaDeMetrica[]> {

  const ctx = await tryRole("LEITURA", MODULO);

  if (!ctx) return [];

  const linhas = await ctx.prisma.metricaDiaria.findMany({
    where: { dia: { gte: de, lte: ate } },
    orderBy: { dia: "asc" },
  });

  return linhas.map((l) => ({
    dia: l.dia,
    entrantes: l.entrantes,
    notaReputacao: l.notaReputacao,
    respondidas: l.respondidas,
    naoRespondidas: l.naoRespondidas,
    notaConsumidor: l.notaConsumidor,
    voltariam: l.voltariam,
    resolvidasPct: l.resolvidasPct,
    tempoMedioHoras: l.tempoMedioHoras,
    churn: l.churn,
    retidos: l.retidos,
    visualizacoes: l.visualizacoes,
    ciclosComSelo: l.ciclosComSelo,
    desativadas: l.desativadas,
    resolvidasCiclo: l.resolvidasCiclo,
    preenchidoPor: l.preenchidoPor,
  }));
}

export interface PreenchimentoManual {
  dia: string;
  visualizacoes?: number | null;
  ciclosComSelo?: number | null;
  desativadas?: number | null;
  resolvidasCiclo?: number | null;
}

/**
 * Grava os campos que só o portal sabe.
 *
 * **Só estes quatro.** Os automáticos são recalculados pela rotina a
 * partir da base; deixar a tela escrevê-los criaria dois donos para o
 * mesmo número, e o próximo cálculo apagaria o que alguém digitou sem
 * avisar.
 *
 * **Campo vazio apaga, e isso é deliberado.** `null` aqui é "não sei",
 * e precisa ser possível voltar a não saber — alguém que digitou o
 * número errado tem de conseguir limpar, e não só corrigir.
 */
export async function salvarMetricaManual(
  entrada: PreenchimentoManual
): Promise<{ erro?: string }> {

  const ctx = await requireRole("AGENTE", MODULO);

  if (!ctx) return { erro: "Sem banco configurado." };

  const sessao = await getSession();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(entrada.dia)) {
    return { erro: "Dia inválido." };
  }

  const existe = await ctx.prisma.metricaDiaria.findUnique(
    { where: { dia: entrada.dia }, select: { dia: true } }
  );

  if (!existe) {
    return {
      erro: "Esse dia ainda não foi medido. A rotina grava o dia corrente; para trás, use npm run metricas:preencher.",
    };
  }

  /** Número não negativo, ou `null` para "não sei". */
  const limpo = (valor: number | null | undefined) =>
    valor === null || valor === undefined
      ? null
      : Math.max(0, Math.round(valor));

  await ctx.prisma.metricaDiaria.update({
    where: { dia: entrada.dia },
    data: {
      visualizacoes: limpo(entrada.visualizacoes),
      ciclosComSelo: limpo(entrada.ciclosComSelo),
      desativadas: limpo(entrada.desativadas),
      resolvidasCiclo: limpo(entrada.resolvidasCiclo),
      preenchidoPor: sessao?.name ?? null,
      preenchidoEm: new Date(),
    },
  });

  revalidatePath("/analytics");

  return {};
}
