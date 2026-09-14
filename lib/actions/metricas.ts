"use server";

import { revalidatePath } from "next/cache";

import { requireRole, tryRole } from "@/lib/auth/guard";
import type { Modulo } from "@/lib/auth/modules";

import { getSession } from "@/lib/auth/session";

import * as XLSX from "xlsx";

import { cicloDe } from "@/lib/models/ciclo";
import { formatElapsed, hojeNaOperacao } from "@/lib/services/reputation.service";

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
 * **Só estes dois: visualizações e desativadas.** "Resolvidas por
 * ciclo" e "ciclos com selo" passaram a ser calculados (Fase 5): o
 * primeiro nas janelas do documento, o segundo pelo histórico da nota.
 * Os automáticos são recalculados pela rotina a
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
      desativadas: limpo(entrada.desativadas),
      preenchidoPor: sessao?.name ?? null,
      preenchidoEm: new Date(),
    },
  });

  revalidatePath("/analytics");

  return {};
}

/**
 * A Planilha de Métricas Reputação, em .xlsx — a que o time preenchia à
 * mão, agora saindo da base.
 *
 * As colunas seguem a tabela de indicadores do documento, na ordem dele.
 * O tempo médio vai em horas (número, para somar e fazer gráfico) e no
 * texto do portal ("15 dias e 14 horas"). Visualizações e desativadas
 * saem em branco quando ninguém preencheu — em branco, e não zero.
 */
export async function exportarMetricas(
  de: string,
  ate: string
): Promise<{ ok: true; arquivo: string; nome: string; dias: number } | { ok: false; erro: string }> {

  if (!/^d{4}-d{2}-d{2}$/.test(de) || !/^d{4}-d{2}-d{2}$/.test(ate) || de > ate) {
    return { ok: false, erro: "Intervalo de datas inválido." };
  }

  const linhas = await lerMetricas(de, ate);

  if (linhas.length === 0) return { ok: false, erro: "Nenhum dia medido nesse intervalo." };

  const planilha = linhas.map((l) => ({
    Dia: l.dia.split("-").reverse().join("/"),
    Ciclo: cicloDe(l.dia).rotulo,
    "Reclamações entrantes (mês)": l.entrantes,
    "Nota de reputação (6 meses)": l.notaReputacao,
    "Respondidas (mês)": l.respondidas,
    "Não respondidas (mês)": l.naoRespondidas,
    "Nota média dos consumidores": l.notaConsumidor,
    "Voltariam a fazer negócio (%)": l.voltariam,
    "Resolvidas (%)": l.resolvidasPct,
    "Tempo médio (horas)": l.tempoMedioHoras,
    "Tempo médio": formatElapsed(l.tempoMedioHoras * 60),
    "Resolvidas no ciclo": l.resolvidasCiclo ?? "",
    "Ciclos com selo RA1000": l.ciclosComSelo ?? "",
    "Casos churn": l.churn,
    "Casos retidos": l.retidos,
    "Visualizações (portal)": l.visualizacoes ?? "",
    "Desativadas (portal)": l.desativadas ?? "",
    "Preenchido por": l.preenchidoPor ?? "",
  }));

  const sheet = XLSX.utils.json_to_sheet(planilha);
  sheet["!cols"] = Object.keys(planilha[0]).map((chave) => ({ wch: Math.max(chave.length + 2, 12) }));
  sheet["!freeze"] = { xSplit: 0, ySplit: 1 };

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Métricas Reputação");

  const buffer = XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;

  return {
    ok: true,
    arquivo: buffer.toString("base64"),
    nome: `metricas-reputacao-${de}-a-${ate}-${hojeNaOperacao()}.xlsx`,
    dias: linhas.length,
  };
}
