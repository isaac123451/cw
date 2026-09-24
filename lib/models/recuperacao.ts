import { EXPEDIENTE_PADRAO, ehDiaUtil, proximoDiaUtil, type Expediente } from "@/lib/services/horasUteis";

/**
 * O plano de recuperação do acumulado (Fase 24).
 *
 * "149 NPS vencidos não cabem num dia." Com o acumulado inteiro na fila,
 * o dia parece perdido antes de começar. O plano divide em cotas — "30
 * por dia, zera na terça" — e diz se o ritmo de hoje está dando conta.
 *
 * Só conta: não muda a fila nem grava nada. A cota é de quem trabalha.
 */

/** Abaixo disso não há acumulado a dividir: é o dia normal. */
export const ACUMULADO_MINIMO = 10;

/** Em quantos dias úteis a cota sugerida zera o acumulado. */
export const DIAS_PARA_ZERAR = 5;

/** A cota que zera em uma semana útil, arredondada para cima de 5 em 5. */
export function cotaSugerida(acumulado: number) {
  if (acumulado <= 0) return 0;
  return Math.max(5, Math.ceil(acumulado / DIAS_PARA_ZERAR / 5) * 5);
}

/** As cotas oferecidas: a sugerida primeiro, e as redondas em volta, sem repetir. */
export function cotasOferecidas(acumulado: number) {
  const sugerida = cotaSugerida(acumulado);
  return [...new Set([sugerida, 10, 20, 30, 50].filter((c) => c > 0 && c <= Math.max(acumulado, sugerida)))].sort((a, b) => a - b);
}

/**
 * Em que dia útil o acumulado zera com `porDia` por dia útil.
 *
 * Hoje conta como o primeiro dia quando é útil. Sem cota, `null`.
 */
export function planoDeRecuperacao(
  acumulado: number,
  porDia: number,
  hoje: string,
  expediente: Expediente = EXPEDIENTE_PADRAO
): { dias: number; zeraEm: string } | null {
  if (acumulado <= 0 || porDia <= 0) return null;
  const dias = Math.ceil(acumulado / porDia);
  let dia = ehDiaUtil(hoje, expediente) ? hoje : proximoDiaUtil(hoje, expediente);
  for (let i = 1; i < dias; i++) dia = proximoDiaUtil(dia, expediente);
  return { dias, zeraEm: dia };
}

/**
 * O ritmo de hoje: quanto do acumulado saiu desde a primeira vez que o
 * dia foi aberto, contra a cota.
 *
 * O que entrou de novo no acumulado durante o dia (um NPS que venceu à
 * tarde) desconta do que saiu — por isso "saiu" nunca fica negativo, e
 * "dando conta" é bater a cota, não só trabalhar.
 */
export function ritmoDeHoje(inicio: number, agora: number, porDia: number) {
  const saiu = Math.max(0, inicio - agora);
  return { saiu, falta: Math.max(0, porDia - saiu), dandoConta: porDia > 0 && saiu >= porDia };
}
