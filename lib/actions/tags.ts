/**
 * Etiquetas do cache de dados.
 *
 * Vivem fora dos arquivos `"use server"` porque um módulo de server
 * action só pode exportar função assíncrona — exportar a constante de
 * lá quebra o build com "Ecmascript file had an error".
 */

/** Lista de reclamações. Invalidada em cada gravação de caso. */
export const CASES_TAG = "casos";

/** Cadastros da operação: fluxo, categorias, times, prazos, jornada. */
export const WORKSPACE_TAG = "workspace";
