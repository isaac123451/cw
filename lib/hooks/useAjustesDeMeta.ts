"use client";

import { useCallback, useSyncExternalStore } from "react";

import { leitura } from "@/lib/lote";

import { SEM_AJUSTES, type AjustesDeMeta } from "@/lib/models/ajusteDeMeta";

/* Em lote, por rota (1.116): sai junto com as outras leituras da tela, em paralelo e fora da fila. */
const lerAjustesDeMeta = leitura("ajustesDeMeta");

/**
 * Os ajustes de metas da pessoa (1.114) — um pedido só para as metas de
 * hoje e as do ciclo, e recarregável depois de salvar.
 */
type Estado = { dia: AjustesDeMeta; ciclo: AjustesDeMeta; carregado: boolean };

let atual: Estado = { dia: SEM_AJUSTES, ciclo: SEM_AJUSTES, carregado: false };
const ouvintes = new Set<() => void>();
let pedido: Promise<void> | null = null;

function carregar() {
  pedido = lerAjustesDeMeta()
    .then((r) => {
      atual = { ...r, carregado: true };
      ouvintes.forEach((o) => o());
    })
    .catch(() => {
      atual = { ...atual, carregado: true };
      ouvintes.forEach((o) => o());
    })
    .finally(() => {
      pedido = null;
    });
  return pedido;
}

function assinar(ouvinte: () => void) {
  ouvintes.add(ouvinte);
  if (!atual.carregado && !pedido) void carregar();
  return () => {
    ouvintes.delete(ouvinte);
  };
}

const VAZIO: Estado = { dia: SEM_AJUSTES, ciclo: SEM_AJUSTES, carregado: false };

export function useAjustesDeMeta() {
  const estado = useSyncExternalStore(assinar, () => atual, () => VAZIO);
  const recarregar = useCallback(() => carregar(), []);
  return { ...estado, recarregar };
}
