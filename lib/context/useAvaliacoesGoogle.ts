"use client";

import { useEffect, useSyncExternalStore } from "react";

import { listarAvaliacoesGoogle, type AvaliacaoGoogleView } from "@/lib/actions/avaliacoesGoogle";

/**
 * As avaliações do Google, uma busca para todas as telas.
 *
 * O Google entrou na Fase 4 com carga própria, só na tela dele. Com as
 * quatro frentes juntas no painel, na jornada e no Meu dia, cada tela
 * buscaria a lista de novo; aqui a lista é do módulo, como a do
 * workspace, e quem grava no Google atualiza a mesma cópia — as outras
 * telas veem sem recarregar.
 */

let lista: AvaliacaoGoogleView[] | null = null;
let pendente: Promise<void> | null = null;
const ouvintes = new Set<() => void>();

function avisar() {
  for (const o of ouvintes) o();
}

function carregar(forcar = false) {
  if (pendente && !forcar) return pendente;
  pendente = listarAvaliacoesGoogle()
    .then((l) => {
      lista = l;
      avisar();
    })
    .catch((erro) => {
      console.error("[google] carga falhou", erro);
      pendente = null;
    });
  return pendente;
}

/** Troca ou acrescenta uma avaliação que o servidor devolveu. */
export function aplicarAvaliacaoGoogle(a: AvaliacaoGoogleView) {
  const atual = lista ?? [];
  lista = atual.some((x) => x.id === a.id) ? atual.map((x) => (x.id === a.id ? a : x)) : [a, ...atual];
  avisar();
}

export function retirarAvaliacaoGoogle(id: string) {
  lista = (lista ?? []).filter((x) => x.id !== id);
  avisar();
}

export function useAvaliacoesGoogle() {

  const dados = useSyncExternalStore(
    (ouvir) => {
      ouvintes.add(ouvir);
      return () => ouvintes.delete(ouvir);
    },
    () => lista,
    () => null
  );

  useEffect(() => {
    carregar();
  }, []);

  return {
    avaliacoes: dados ?? [],
    carregando: dados === null,
    recarregar: () => carregar(true),
  };
}
