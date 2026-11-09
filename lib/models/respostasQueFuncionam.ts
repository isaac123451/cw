/**
 * Respostas que funcionam (09/11/2026) — uma das novidades do plano de
 * novembro: a nota que o consumidor deu depois de cada resposta pronta.
 *
 * Para cada texto, os casos em que ele foi usado e que foram avaliados
 * **depois** do primeiro uso; cada caso conta uma vez. Abaixo de
 * `MINIMO_DE_AVALIACOES`, nada é mostrado: uma média de duas notas diz
 * mais sobre os dois casos do que sobre o texto.
 */

export const MINIMO_DE_AVALIACOES = 3;

export interface UsoAvaliado {
  macroId: string;
  caseId: string;
  usadoEm: string;
  /** Quando o consumidor avaliou, se avaliou. */
  avaliadoEm?: string | null;
  nota?: number | null;
}

export interface EfeitoDaResposta {
  avaliacoes: number;
  media: number;
}

export function efeitoPorResposta(usos: UsoAvaliado[], minimo = MINIMO_DE_AVALIACOES): Record<string, EfeitoDaResposta> {
  /* O primeiro uso de cada texto em cada caso. */
  const primeiro = new Map<string, UsoAvaliado>();
  for (const u of usos) {
    const chave = `${u.macroId}|${u.caseId}`;
    const atual = primeiro.get(chave);
    if (!atual || u.usadoEm < atual.usadoEm) primeiro.set(chave, u);
  }
  const notas = new Map<string, number[]>();
  for (const u of primeiro.values()) {
    if (u.nota == null || !u.avaliadoEm || u.avaliadoEm.slice(0, 10) < u.usadoEm.slice(0, 10)) continue;
    notas.set(u.macroId, [...(notas.get(u.macroId) ?? []), u.nota]);
  }
  const efeito: Record<string, EfeitoDaResposta> = {};
  for (const [macroId, lista] of notas) {
    if (lista.length < minimo) continue;
    efeito[macroId] = { avaliacoes: lista.length, media: Math.round((lista.reduce((s, n) => s + n, 0) / lista.length) * 10) / 10 };
  }
  return efeito;
}
