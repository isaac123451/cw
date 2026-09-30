import type { PrismaClient } from "@prisma/client";

import { respondida, type Case } from "@/lib/models/case";
import { cicloDe, type Ciclo } from "@/lib/models/ciclo";
import { fetchCases } from "@/lib/services/case.repository";
import { abaEm } from "@/lib/services/metricas.service";
import { paineisPorDia, type PainelDoPortal } from "@/lib/services/painelDoPortal.service";
import { diaNaOperacao, hasRA1000, hojeNaOperacao } from "@/lib/services/reputation.service";

/**
 * A planilha "Métricas do Reclame Aqui", aba do mês (Fase 37, 1.97).
 *
 * "Automações na planilha — preenchendo SOMENTE o que está vazio, não pode
 * mexer no que já está preenchido." O Apps Script da planilha
 * (\`docs/planilha/MetricasDoCW.gs\`) chama a rota que devolve isto e escreve
 * só nas células vazias.
 *
 * **Só as linhas conferidas contra o que a equipe já preencheu** (dias 1 a
 * 24 de setembro de 2026):
 *
 * - "Nº de reclamações entrantes (RA)" — publicadas no mês até o dia (17 de
 *   24 iguais, as outras a um de distância: a equipe anotou de manhã);
 * - "Reclamações respondidas" — respostas publicadas no mês até o dia (24
 *   de 24 iguais);
 * - "Ciclos com o selo ativo" — ciclos do mês já fechados com o selo (1 no
 *   dia 7, 2 no 14, 3 no 21);
 * - nota de reputação, nota dos consumidores, voltariam, resolvidas (%),
 *   tempo médio e não respondidas — do **painel oficial do portal lido
 *   naquele dia** (a equipe copia o número do portal, não a conta daqui).
 *   Dia sem leitura do painel fica vazio: não se inventa o número oficial.
 *
 * Ficam de fora, de propósito, as linhas cuja conta não bateu com a da
 * equipe (resolvidas por ciclo, detratores, redes) e as que só existem na
 * área da empresa (visualizações, desativadas).
 */

export const LINHAS_DA_PLANILHA = [
  "Nº de reclamações entrantes (RA)",
  "Nota de Reputação",
  "Reclamações respondidas",
  "Nota média dos consumidores",
  "Voltariam a fazer negócio",
  "Reclamações resolvidas (percentual)",
  "Tempo médio",
  "Ciclos com o selo ativo",
  "Reclamações não respondidas",
] as const;

export type LinhaDaPlanilha = (typeof LINHAS_DA_PLANILHA)[number];

export interface PlanilhaDoMes {
  mes: string;
  /** "Set/2026" — o que a célula A1 da aba traz. */
  cabecalho: string;
  dias: string[];
  /** Por linha, um valor por dia (na ordem de `dias`) — `null` é "não preencha". */
  valores: Record<LinhaDaPlanilha, (string | null)[]>;
}

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const virgula = (n: number, casas: number) => n.toFixed(casas).replace(".", ",");
/** "18 dias e 8 horas" → "18,8" — como a equipe escreve na planilha. */
export function tempoDaPlanilha(texto: string): string | null {
  const dias = texto.match(/(\d+)\s*dia/i)?.[1];
  if (!dias) return null;
  const horas = texto.match(/(\d+)\s*hora/i)?.[1] ?? "0";
  return `${dias},${horas}`;
}

function diasDoMes(mes: string, ate: string) {
  const [a, m] = mes.split("-").map(Number);
  const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate();
  const dias: string[] = [];
  for (let d = 1; d <= ultimo; d += 1) {
    const dia = `${mes}-${String(d).padStart(2, "0")}`;
    if (dia > ate) break;
    dias.push(dia);
  }
  return dias;
}

function ciclosDoMesFechados(mes: string, dia: string): Ciclo[] {
  const ciclos: Ciclo[] = [];
  let d = `${mes}-01`;
  while (d.slice(0, 7) === mes) {
    const c = cicloDe(d);
    if (c.fim <= dia) ciclos.push(c);
    d = new Date(Date.parse(`${c.fim}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  }
  return ciclos;
}

export function montarPlanilha(casos: Case[], paineis: Record<string, PainelDoPortal>, mes: string, hoje: string): PlanilhaDoMes {
  const ra = casos.filter((c) => c.protocol.startsWith("RA-"));
  const d = (x?: string) => (x ? diaNaOperacao(x) : "");
  const dias = diasDoMes(mes, hoje);
  const inicio = `${mes}-01`;

  const selos = new Map<string, boolean>();
  const seloNoFim = (c: Ciclo) => {
    if (!selos.has(c.fim)) selos.set(c.fim, hasRA1000(abaEm(ra, c.fim, 6).resumo));
    return selos.get(c.fim)!;
  };

  const valores = Object.fromEntries(LINHAS_DA_PLANILHA.map((l) => [l, [] as (string | null)[]])) as PlanilhaDoMes["valores"];

  for (const dia of dias) {
    const p = paineis[dia];
    valores["Nº de reclamações entrantes (RA)"].push(String(ra.filter((c) => d(c.createdAt) >= inicio && d(c.createdAt) <= dia).length));
    valores["Reclamações respondidas"].push(String(ra.filter((c) => respondida(c) && c.publicResponseAt && d(c.publicResponseAt) >= inicio && d(c.publicResponseAt) <= dia).length));
    valores["Ciclos com o selo ativo"].push(String(ciclosDoMesFechados(mes, dia).filter(seloNoFim).length));
    valores["Nota de Reputação"].push(p?.nota != null ? virgula(p.nota, 1) : null);
    valores["Nota média dos consumidores"].push(p?.notaConsumidor != null ? virgula(p.notaConsumidor, 2) : null);
    valores["Voltariam a fazer negócio"].push(p?.voltaria != null ? `${virgula(p.voltaria, 2)}%` : null);
    valores["Reclamações resolvidas (percentual)"].push(p?.solucao != null ? `${virgula(p.solucao, 2)}%` : null);
    valores["Tempo médio"].push(p?.tempoMedio ? tempoDaPlanilha(p.tempoMedio) : null);
    valores["Reclamações não respondidas"].push(p?.aguardando != null ? String(p.aguardando) : null);
  }

  const [a, m] = mes.split("-").map(Number);
  return { mes, cabecalho: `${MESES[m - 1]}/${a}`, dias, valores };
}

export async function planilhaDoMes(prisma: PrismaClient, mes: string): Promise<PlanilhaDoMes> {
  const hoje = hojeNaOperacao();
  const casos = await fetchCases(prisma);
  const paineis = await paineisPorDia(prisma, "SIX_MONTHS", `${mes}-01`, hoje);
  return montarPlanilha(casos, paineis, mes, hoje);
}
