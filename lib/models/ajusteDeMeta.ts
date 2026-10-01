/**
 * O ajuste das metas (1.114): "as metas do dia são para serem geradas
 * automaticamente, mas deve ser possível alterar".
 *
 * A plataforma gera o número; a pessoa pode trocar só para hoje (ou só
 * para este ciclo) ou deixar um número como padrão daqui para frente. O
 * mais específico vence: o de hoje, depois o padrão, depois o gerado.
 */

export type EscopoDaMeta = "dia" | "ciclo";

export interface AjustesDeMeta {
  /** Só hoje (ou só este ciclo), por chave. */
  doPeriodo: Record<string, number>;
  /** Daqui para frente, por chave. */
  padrao: Record<string, number>;
}

export const SEM_AJUSTES: AjustesDeMeta = { doPeriodo: {}, padrao: {} };

export type OrigemDoAlvo = "automatico" | "periodo" | "padrao";

/**
 * O alvo de uma meta com os ajustes. `gerar(teto)` é a conta automática; o
 * padrão da pessoa entra como o teto dessa conta (no dia, a meta nunca
 * passa do que existe para fazer), e o ajuste do período vale como veio.
 */
export function alvoComAjuste(chave: string, ajustes: AjustesDeMeta | undefined, gerar: (teto?: number) => number): { alvo: number; automatico: number; origem: OrigemDoAlvo } {
  const automatico = gerar();
  const doPeriodo = ajustes?.doPeriodo[chave];
  if (doPeriodo !== undefined) return { alvo: doPeriodo, automatico, origem: "periodo" };
  const padrao = ajustes?.padrao[chave];
  if (padrao !== undefined) return { alvo: gerar(padrao), automatico, origem: "padrao" };
  return { alvo: automatico, automatico, origem: "automatico" };
}

/** O número que a pessoa digitou, conferido: inteiro de 0 a 500. */
export function alvoValido(v: unknown): number | null {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 0 && n <= 500 ? n : null;
}
