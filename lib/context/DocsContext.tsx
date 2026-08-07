"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  ReactNode,
} from "react";

import {
  mockPlaybooks,
  Playbook,
} from "@/lib/data/mockPlaybooks";

export type PlaybookDraft = Omit<Playbook, "id" | "slug">;

interface DocsContextType {
  playbooks: Playbook[];
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

  const [playbooks, setPlaybooks] =
    useState<Playbook[]>(mockPlaybooks);

  const value = useMemo<DocsContextType>(
    () => ({
      playbooks,

      createPlaybook: (data) => {

        const id = crypto.randomUUID();

        // Slug único: dois documentos podem ter o mesmo título.
        const base = toSlug(data.title) || "documento";

        const slug = playbooks.some(
          (item) => item.slug === base
        )
          ? `${base}-${id.slice(0, 4)}`
          : base;

        setPlaybooks((prev) => [
          { ...data, id, slug },
          ...prev,
        ]);

        return slug;
      },

      updatePlaybook: (data) =>
        setPlaybooks((prev) =>
          prev.map((item) =>
            item.id === data.id ? data : item
          )
        ),

      removePlaybook: (id) =>
        setPlaybooks((prev) =>
          prev.filter((item) => item.id !== id)
        ),
    }),
    [playbooks]
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
