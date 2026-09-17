"use client";

import { useSyncExternalStore } from "react";

/**
 * Preferências de cada pessoa no navegador, lidas sem efeito.
 *
 * Saiu do menu lateral quando a página de Novidades passou a precisar do
 * mesmo armazenamento: gravar a última versão vista precisa apagar, na
 * hora, o ponto ao lado da versão no menu — os dois ouvem o mesmo lugar.
 */
const ouvintes = new Set<() => void>();

export function lerLocal(chave: string) {
  try {
    return localStorage.getItem(chave);
  } catch {
    return null;
  }
}

export function gravarLocal(chave: string, valor: string) {
  try {
    localStorage.setItem(chave, valor);
  } catch {
    /* Sem armazenamento, a escolha vale até fechar a aba. */
  }
  ouvintes.forEach((o) => o());
}

export function usePreferenciaLocal(chave: string) {
  return useSyncExternalStore(
    (ouvir) => {
      ouvintes.add(ouvir);
      return () => ouvintes.delete(ouvir);
    },
    () => lerLocal(chave),
    () => null
  );
}
