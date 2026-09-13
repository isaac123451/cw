import type { PrismaClient } from "@prisma/client";

import {
  PRAZOS_DE_AREA_PADRAO,
  type PrazosDeArea,
} from "@/lib/models/movement";

import {
  EXPEDIENTE_PADRAO,
  Expediente,
  expedienteValido,
} from "@/lib/services/horasUteis";

/**
 * O expediente da operação, como o banco o guarda.
 *
 * Sem linha gravada vale o padrão — segunda a sexta, 08h às 18h —, e
 * uma linha que não faça sentido também: um relógio que não acha minuto
 * útil nunca termina de contar. Ver `expedienteValido`.
 */
export function expedienteDoBanco(
  r?: {
    expedienteInicio: number;
    expedienteFim: number;
    diasUteis: number[];
    pularFacultativos: boolean;
  } | null
): Expediente {

  if (!r) return EXPEDIENTE_PADRAO;

  return expedienteValido({
    inicioMin: r.expedienteInicio,
    fimMin: r.expedienteFim,
    dias: r.diasUteis,
    pularFacultativos: r.pularFacultativos,
  });
}

/** Os prazos das áreas internas por criticidade — ver `PRAZOS_DE_AREA_PADRAO`. */
export function prazosDeAreaDoBanco(
  r?: { prazoAreaUrgente: number; prazoAreaAlta: number; prazoAreaNormal: number } | null
): PrazosDeArea {

  if (!r) return PRAZOS_DE_AREA_PADRAO;

  const valido = (n: number, padrao: number) => (Number.isFinite(n) && n > 0 && n <= 24 * 30 ? n : padrao);

  return {
    Urgente: valido(r.prazoAreaUrgente, PRAZOS_DE_AREA_PADRAO.Urgente),
    Alta: valido(r.prazoAreaAlta, PRAZOS_DE_AREA_PADRAO.Alta),
    Normal: valido(r.prazoAreaNormal, PRAZOS_DE_AREA_PADRAO.Normal),
  };
}

let guardado: { valor: Expediente; ate: number } | null = null;

/**
 * Para as rotas que não passam pelo workspace — a extensão, a rotina.
 *
 * Um minuto de memória: o expediente muda uma vez por ano, e cada painel
 * aberto na extensão pediria a mesma linha de novo.
 */
export async function lerExpediente(
  prisma: PrismaClient
): Promise<Expediente> {

  if (guardado && guardado.ate > Date.now()) return guardado.valor;

  const linha = await prisma.operacaoConfig
    .findUnique({ where: { id: "unico" } })
    .catch(() => null);

  const valor = expedienteDoBanco(linha);

  guardado = { valor, ate: Date.now() + 60_000 };

  return valor;
}

/** Depois de salvar, a próxima leitura vai ao banco. */
export function esquecerExpediente() {
  guardado = null;
}
