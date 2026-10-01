import type { FrenteId } from "@/lib/models/frentes";
import { EXPEDIENTE_PADRAO, ehDiaUtil, proximoDiaUtil, type Expediente } from "@/lib/services/horasUteis";

/**
 * O plano de recuperação do acumulado (Fase 24).
 *
 * "149 NPS vencidos não cabem num dia." Com o acumulado inteiro na fila,
 * o dia parece perdido antes de começar. O plano divide em cotas — "30
 * por dia, zera na terça" — e diz se o ritmo de hoje está dando conta.
 *
 * Só conta: não muda a fila nem grava nada. A cota é de quem trabalha.
 *
 * **Configurável (1.122, Fase 34: "cotas, prazos e frentes do jeito das
 * suas demandas").** Cada pessoa ajusta, por frente: se o plano aparece, a
 * partir de quantos itens fora do prazo, em quantos dias úteis zerar, e
 * uma cota fixa (ou a sugerida pelo prazo). Fica na conta, não no
 * navegador.
 */

/** Abaixo disso não há acumulado a dividir: é o dia normal. */
export const ACUMULADO_MINIMO = 10;

/** Em quantos dias úteis a cota sugerida zera o acumulado. */
export const DIAS_PARA_ZERAR = 5;

export interface AjusteDaFrente {
  /** O plano aparece para esta frente. */
  ligado: boolean;
  /** A partir de quantos itens fora do prazo. */
  minimo: number;
  /** Em quantos dias úteis a cota sugerida zera. */
  dias: number;
  /** Cota fixa por dia; `null` é a sugerida pelo prazo. */
  cota: number | null;
}

export type AjusteDaRecuperacao = Record<FrenteId, AjusteDaFrente>;

export const FRENTES_DA_RECUPERACAO: FrenteId[] = ["reclame-aqui", "redes", "nps", "google"];

export const AJUSTE_PADRAO: AjusteDaFrente = { ligado: true, minimo: ACUMULADO_MINIMO, dias: DIAS_PARA_ZERAR, cota: null };

/** Os limites de cada campo — o que a tela oferece e o que o servidor aceita. */
export const LIMITES = { minimo: [1, 500], dias: [1, 30], cota: [1, 500] } as const;

function dentro(valor: unknown, [min, max]: readonly [number, number], padrao: number) {
  const n = Math.round(Number(valor));
  return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : padrao;
}

/** O ajuste guardado, conferido campo a campo; o que faltar vale o padrão. */
export function ajusteValido(bruto: unknown): AjusteDaRecuperacao {
  const fonte = bruto && typeof bruto === "object" ? (bruto as Record<string, unknown>) : {};
  return Object.fromEntries(
    FRENTES_DA_RECUPERACAO.map((f) => {
      const a = fonte[f] && typeof fonte[f] === "object" ? (fonte[f] as Record<string, unknown>) : {};
      /* Cota 0, vazia ou que não é número volta a ser a sugerida — "zero por dia" não é plano. */
      const numero = a.cota === null || a.cota === "" ? NaN : Number(a.cota);
      const cota = Number.isFinite(numero) && numero >= 1 ? dentro(numero, LIMITES.cota, 1) : null;
      return [
        f,
        {
          ligado: typeof a.ligado === "boolean" ? a.ligado : AJUSTE_PADRAO.ligado,
          minimo: dentro(a.minimo, LIMITES.minimo, AJUSTE_PADRAO.minimo),
          dias: dentro(a.dias, LIMITES.dias, AJUSTE_PADRAO.dias),
          cota,
        },
      ];
    })
  ) as AjusteDaRecuperacao;
}

/** A cota que zera em `dias` úteis, arredondada para cima de 5 em 5. */
export function cotaSugerida(acumulado: number, dias = DIAS_PARA_ZERAR) {
  if (acumulado <= 0) return 0;
  return Math.max(5, Math.ceil(acumulado / Math.max(1, dias) / 5) * 5);
}

/** As cotas oferecidas: a sugerida (e a fixa, se houver) primeiro, e as redondas em volta, sem repetir. */
export function cotasOferecidas(acumulado: number, dias = DIAS_PARA_ZERAR, fixa: number | null = null) {
  const sugerida = cotaSugerida(acumulado, dias);
  const teto = Math.max(acumulado, sugerida, fixa ?? 0);
  return [...new Set([sugerida, ...(fixa ? [fixa] : []), 10, 20, 30, 50].filter((c) => c > 0 && c <= teto))].sort((a, b) => a - b);
}

/** A cota que vale para a frente: a fixa do ajuste, ou a sugerida pelo prazo dele. */
export function cotaDaFrente(acumulado: number, ajuste: AjusteDaFrente) {
  return ajuste.cota ?? cotaSugerida(acumulado, ajuste.dias);
}

/** As frentes que entram no plano, pelo ajuste de cada uma — a maior primeiro. */
export function frentesNoPlano(porFrente: Map<FrenteId, number>, ajuste: AjusteDaRecuperacao): [FrenteId, number][] {
  return [...porFrente.entries()].filter(([f, n]) => ajuste[f]?.ligado && n >= ajuste[f].minimo).sort((a, b) => b[1] - a[1]);
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
