"use client";

import {
  createContext,
  useContext,
  useMemo,
  ReactNode,
} from "react";

// Só o tipo: os dados vêm do banco pela carga compartilhada.
import type { Playbook } from "@/lib/models/playbook";

import {
  removePlaybook,
  savePlaybook,
} from "@/lib/actions/registry";

import { useWorkspaceSlice } from "@/lib/context/useWorkspace";
import { sincronizar } from "@/lib/context/sync";

export type PlaybookDraft = Omit<Playbook, "id" | "slug">;

interface DocsContextType {
  playbooks: Playbook[];

  /** Carga inicial ainda em andamento. */
  loading: boolean;
  createPlaybook: (data: PlaybookDraft) => string;
  updatePlaybook: (data: Playbook) => void;
  removePlaybook: (id: string) => void;
}

const DocsContext =
  createContext<DocsContextType | null>(null);

function toSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

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

      createPlaybook: (data) => {

        const id = crypto.randomUUID();

        // Slug único: dois documentos podem ter o mesmo título.
        const base = toSlug(data.title) || "documento";

        const slug = playbooks.some(
          (item) => item.slug === base
        )
          ? `${base}-${id.slice(0, 4)}`
          : base;

        const novo: Playbook = { ...data, id, slug };

        setPlaybooks((prev) => [novo, ...prev]);
        sincronizar(() => savePlaybook(novo));

        return slug;
      },

      updatePlaybook: (data) => {
        setPlaybooks((prev) =>
          prev.map((item) =>
            item.id === data.id ? data : item
          )
        );
        sincronizar(() => savePlaybook(data));
      },

      removePlaybook: (id) => {
        setPlaybooks((prev) =>
          prev.filter((item) => item.id !== id)
        );
        sincronizar(() => removePlaybook(id));
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
