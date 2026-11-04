import type { PrismaClient } from "@prisma/client";

import { rodarIaDoDia } from "@/lib/services/iaDoDia.service";

/**
 * Quando a IA do dia roda de novo (04/11/2026).
 *
 * Dois relógios chamam a mesma rodada: a plataforma aberta (a cada 5 min,
 * pelo `VigiaDaIaDoDia`) e a extensão (a cada 30 min, pelo alarme do
 * vigia). Antes só existia o primeiro — de 31/10 em diante, com a
 * plataforma fechada a maior parte do dia, a IA caiu de 50–75 ações por
 * dia para 6–15: "isso já é pra ser feito no papel mas não ocorre".
 *
 * O intervalo é por pessoa e por instância do servidor; a rodada é
 * idempotente (cada ação tem a sua chave), então duas instâncias rodando
 * no mesmo minuto só gastam, não duplicam.
 */
export const INTERVALO_DA_IA_MS = 5 * 60_000;

const ultimaRodada = new Map<string, number>();

/** Roda se já passou o intervalo; devolve se rodou. */
export async function rodarSeJaPassou(prisma: PrismaClient, userId: string, agora = Date.now()) {
  if (agora - (ultimaRodada.get(userId) ?? 0) < INTERVALO_DA_IA_MS) return false;
  ultimaRodada.set(userId, agora);
  await rodarIaDoDia(prisma, userId);
  return true;
}
