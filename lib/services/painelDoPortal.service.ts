import type { PrismaClient } from "@prisma/client";

import { hojeNaOperacao } from "@/lib/services/reputation.service";

/**
 * O painel oficial do Reclame Aqui (1.86).
 *
 * O vigia lê o painel da própria lista do portal e manda para cá; a tela
 * Índice mostra este número como "no portal" e o calculado como "com o
 * que já foi feito". A diferença entre os dois é o atraso do portal — em
 * 29/09 o painel ainda contava 9 sem resposta no semestre, com 4 de
 * verdade, e mostrava 8,8 onde a conta dava 8,86.
 */
export interface PainelDoPortal {
  tipo: string;
  inicio: string;
  fim: string;
  recebidas: number | null;
  respondidas: number | null;
  aguardando: number | null;
  avaliadas: number | null;
  resposta: number | null;
  solucao: number | null;
  voltaria: number | null;
  notaConsumidor: number | null;
  nota: number | null;
  selo: string;
  tempoMedio: string;
  lidoEm?: string;
}

const TIPOS = new Set(["SIX_MONTHS", "TWELVE_MONTHS", "LAST_YEAR", "PREVIOUS_YEAR", "CURRENT_YEAR", "GENERAL", "ALL"]);
const DIA = /^\d{4}-\d{2}-\d{2}$/;

function numero(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n >= 0 && n < 1e7 ? n : null;
}

/** O que a extensão mandou, conferido campo a campo — nada de gravar o que vier. */
export function validarPainel(bruto: unknown): PainelDoPortal | null {
  if (!bruto || typeof bruto !== "object") return null;
  const p = bruto as Record<string, unknown>;
  const tipo = String(p.tipo ?? "");
  const inicio = String(p.inicio ?? "");
  const fim = String(p.fim ?? "");
  if (!/^[A-Z_]{2,30}$/.test(tipo) || !DIA.test(fim) || (inicio && !DIA.test(inicio))) return null;
  const nota = numero(p.nota);
  if (nota !== null && nota > 10) return null;
  return {
    tipo: TIPOS.has(tipo) ? tipo : tipo.slice(0, 30),
    inicio,
    fim,
    recebidas: numero(p.recebidas),
    respondidas: numero(p.respondidas),
    aguardando: numero(p.aguardando),
    avaliadas: numero(p.avaliadas),
    resposta: numero(p.resposta),
    solucao: numero(p.solucao),
    voltaria: numero(p.voltaria),
    notaConsumidor: numero(p.notaConsumidor),
    nota,
    selo: String(p.selo ?? "").slice(0, 40),
    tempoMedio: String(p.tempoMedio ?? "").slice(0, 60),
  };
}

/**
 * Grava por período, janela **e dia** (1.97): a planilha do ciclo pede o
 * número oficial de cada dia — o "aguardando resposta" muda no meio do mês
 * sem a janela mudar. Ler de novo no mesmo dia só atualiza.
 */
export async function gravarPaineis(prisma: PrismaClient, paineis: PainelDoPortal[]) {
  const agora = new Date();
  const dia = hojeNaOperacao();
  for (const p of paineis) {
    const id = `${p.tipo}:${p.fim}:${dia}`;
    const dados = { ...p };
    delete dados.lidoEm;
    await prisma.painelDoPortal.upsert({
      where: { id },
      create: { id, tipo: p.tipo, inicio: p.inicio, fim: p.fim, dados, lidoEm: agora },
      update: { dados, lidoEm: agora, inicio: p.inicio },
    });
  }
  return paineis.length;
}

/** O painel mais recente de cada período, e o histórico do semestre (mês a mês). */
export async function lerPaineis(prisma: PrismaClient): Promise<{
  atuais: Record<string, PainelDoPortal>;
  historico: PainelDoPortal[];
}> {
  const delegate = (prisma as unknown as { painelDoPortal?: PrismaClient["painelDoPortal"] }).painelDoPortal;
  if (!delegate) return { atuais: {}, historico: [] };
  const linhas = await delegate.findMany({ orderBy: [{ fim: "desc" }, { lidoEm: "desc" }], take: 120 });
  const atuais: Record<string, PainelDoPortal> = {};
  const historico: PainelDoPortal[] = [];
  for (const l of linhas) {
    const p = { ...(l.dados as unknown as PainelDoPortal), lidoEm: l.lidoEm.toISOString() };
    if (!atuais[l.tipo]) atuais[l.tipo] = p;
    if (l.tipo === "SIX_MONTHS") historico.push(p);
  }
  return { atuais, historico: historico.slice(0, 12) };
}

/** O último painel lido em cada dia, de um período — para a planilha do ciclo (1.97). */
export async function paineisPorDia(prisma: PrismaClient, tipo: string, de: string, ate: string): Promise<Record<string, PainelDoPortal>> {
  const linhas = await prisma.painelDoPortal.findMany({
    where: { tipo, lidoEm: { gte: new Date(`${de}T03:00:00Z`), lt: new Date(Date.parse(`${ate}T03:00:00Z`) + 86_400_000) } },
    orderBy: { lidoEm: "asc" },
  });
  const porDia: Record<string, PainelDoPortal> = {};
  for (const l of linhas) {
    const dia = new Date(l.lidoEm.getTime() - 3 * 3_600_000).toISOString().slice(0, 10);
    porDia[dia] = { ...(l.dados as unknown as PainelDoPortal), lidoEm: l.lidoEm.toISOString() };
  }
  return porDia;
}
