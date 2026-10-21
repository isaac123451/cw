import type { Case } from "@/lib/models/case";

/**
 * O aviso de que um caso mudou fora do contexto (21/10/2026) — a mini
 * janela dos gráficos fica fora do `CaseProvider` e grava por ação; o
 * contexto ouve este evento e ajusta a lista na hora.
 */
export const EVENTO_AJUSTE_DO_CASO = "cw:ajuste-do-caso";

export function ajustarCasoNaTela(protocol: string, campos: Partial<Case>) {
  window.dispatchEvent(new CustomEvent(EVENTO_AJUSTE_DO_CASO, { detail: { protocol, campos } }));
}
