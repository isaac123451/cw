"use client";

import {
  createContext,
  useContext,
  useMemo,
  ReactNode,
} from "react";

// Só o tipo: os dados vêm do banco pela carga compartilhada.
import type { Playbook } from "@/lib/models/playbook";

import { useWorkspaceSlice } from "@/lib/context/useWorkspace";

/**
 * Os documentos da operação.
 *
 * Até a 0.55 o contexto criava, editava e excluía na hora e mandava ao
 * servidor por trás (`sincronizar`) — a tela mostrava "salvo" antes de o
 * banco responder. Agora quem grava é a tela, pelas ações de
 * `lib/actions/documentos.ts`, e o contexto só recebe o que o servidor
 * devolveu: a lista nunca mostra um documento que o banco não tem.
 */
interface DocsContextType {
  playbooks: Playbook[];

  /** Carga inicial ainda em andamento. */
  loading: boolean;
  /** O que o servidor gravou (importação, edição do texto): entra ou substitui pelo id. */
  aplicarDoServidor: (docs: Playbook[]) => void;
  /** Tira da lista o documento que o servidor confirmou ter excluído. */
  retirarDaLista: (id: string) => void;
}

const DocsContext =
  createContext<DocsContextType | null>(null);

export function DocsProvider({
  children,
}: {
  children: ReactNode;
}) {

  const [playbooks, setPlaybooks, loading] =
    useWorkspaceSlice(
      (dados) => dados.playbooks,
      [] as Playbook[]
    );

  const value = useMemo<DocsContextType>(
    () => ({
      playbooks,
      loading,

      aplicarDoServidor: (docs) => {
        setPlaybooks((prev) => {
          const porId = new Map(prev.map((p) => [p.id, p]));
          for (const d of docs) porId.set(d.id, d);
          return [...porId.values()];
        });
      },

      retirarDaLista: (id) => {
        setPlaybooks((prev) =>
          prev.filter((item) => item.id !== id)
        );
      },
    }),
    [playbooks, loading, setPlaybooks]
  );

  return (
    <DocsContext.Provider value={value}>
      {children}
    </DocsContext.Provider>
  );
}

export function useDocs() {
  const context = useContext(DocsContext);

  if (!context) {
    throw new Error(
      "useDocs deve estar dentro de DocsProvider."
    );
  }

  return context;
}
