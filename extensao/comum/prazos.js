/**
 * Prazo estourando avisa (1.80) — a decisão, sem Chrome.
 *
 * O service worker pergunta os prazos e chama isto para saber o que
 * avisar. Separado para a conferência rodar sem navegador
 * (`npm run check:prazos-extensao`).
 *
 * Regras: só os casos da pessoa e os sem responsável; um aviso por caso
 * a cada mudança (entrou em atenção, estourou); três ou mais de uma vez
 * viram um aviso só; das 8h às 20h de Brasília.
 */

/** A hora de Brasília, 0 a 23. */
export function horaDeBrasilia(agora = new Date()) {
  return Number(agora.toLocaleString("en-US", { hour: "numeric", hourCycle: "h23", timeZone: "America/Sao_Paulo" }));
}

export function dentroDoHorario(hora) {
  return hora >= 8 && hora < 20;
}

/**
 * @param {{ casos: Array<{protocolo:string, situacao:string, meu?:boolean, responsavel?:string|null}>, avisados: Record<string,string> }} entrada
 * @returns {{ individuais: any[], grupo: any[] | null, estado: Record<string,string> }}
 */
export function decidirAvisosDePrazo({ casos, avisados }) {
  const daPessoa = (casos ?? []).filter((c) => c.meu || !c.responsavel);
  const novos = daPessoa.filter((c) => (avisados ?? {})[c.protocolo] !== c.situacao);
  /* Guarda só o que ainda pede atenção: o caso que saiu volta a avisar se entrar de novo. */
  const estado = Object.fromEntries(daPessoa.map((c) => [c.protocolo, c.situacao]));
  if (novos.length === 0) return { individuais: [], grupo: null, estado };
  if (novos.length <= 2) return { individuais: novos, grupo: null, estado };
  return { individuais: [], grupo: novos, estado };
}
