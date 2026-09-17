"use client";

import { createContext, useContext, useEffect, useSyncExternalStore } from "react";

/**
 * Quais mini-janelas têm algo digitado e não salvo.
 *
 * Cada formulário de janela avisa daqui (`useRascunhoNaJanela`), e a
 * moldura usa para duas coisas: pedir confirmação antes de fechar, e
 * marcar na bandeja a minimizada que guarda um rascunho — ela continua
 * montada, e sem a marca ninguém lembraria de voltar a ela.
 */
const comRascunho = new Set<string>();
const ouvintes = new Set<() => void>();

/*
  Um retrato novo a cada mudança, e não o mesmo Set: o React Compiler
  memoriza o que é lido de um objeto que não muda de identidade, e a
  moldura continuava achando que não havia rascunho.
*/
let retrato: ReadonlySet<string> = new Set();

function avisar() {
  retrato = new Set(comRascunho);
  ouvintes.forEach((o) => o());
}

export const JanelaAtual = createContext<string | null>(null);

export function useRascunhoNaJanela(sujo: boolean) {
  const id = useContext(JanelaAtual);
  useEffect(() => {
    if (!id) return;
    const tinha = comRascunho.has(id);
    if (sujo && !tinha) {
      comRascunho.add(id);
      avisar();
    } else if (!sujo && tinha) {
      comRascunho.delete(id);
      avisar();
    }
  }, [id, sujo]);
  useEffect(() => {
    return () => {
      if (id && comRascunho.delete(id)) avisar();
    };
  }, [id]);
}

const VAZIO: ReadonlySet<string> = new Set();

export function useJanelasComRascunho(): ReadonlySet<string> {
  return useSyncExternalStore(
    (ouvir) => {
      ouvintes.add(ouvir);
      return () => ouvintes.delete(ouvir);
    },
    () => retrato,
    () => VAZIO
  );
}
