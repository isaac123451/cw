"use client";

import {
  createContext,
  useContext,
  useMemo,
  ReactNode,
} from "react";

import {
  CategoryOption,
  ChecklistItem,
  SubcategoryOption,
  TeamOption,
} from "@/lib/models/settings";

// Só o tipo: os dados vêm do banco pela carga compartilhada.
import type { CaseTag } from "@/lib/data/mockTags";

import {
  removeCategory as apagarCategoria,
  removeChecklistItem as apagarChecklist,
  removeSubcategory as apagarSubcategoria,
  removeTag as apagarTag,
  saveCategory as gravarCategoria,
  saveChecklistItem as gravarChecklist,
  saveSubcategory as gravarSubcategoria,
  saveTag as gravarTag,
} from "@/lib/actions/registry";

import { useWorkspaceSlice } from "@/lib/context/useWorkspace";
import { sincronizar } from "@/lib/context/sync";

interface SettingsContextType {
  categories: CategoryOption[];
  subcategories: SubcategoryOption[];
  teams: TeamOption[];
  checklist: ChecklistItem[];
  tags: CaseTag[];

  /** Carga inicial ainda em andamento. */
  loading: boolean;

  saveCategory: (data: CategoryOption) => void;
  removeCategory: (id: string) => void;

  saveSubcategory: (data: SubcategoryOption) => void;
  removeSubcategory: (id: string) => void;

  saveTeam: (data: TeamOption) => void;
  removeTeam: (id: string) => void;

  saveChecklistItem: (data: ChecklistItem) => void;
  removeChecklistItem: (id: string) => void;

  saveTag: (data: CaseTag) => void;
  removeTag: (id: string) => void;
}

const SettingsContext =
  createContext<SettingsContextType | null>(null);

/** Insere ou atualiza mantendo a ordenação por `order`. */
function upsert<T extends { id: string; order: number }>(
  list: T[],
  data: T
) {
  const exists = list.some(
    (item) => item.id === data.id
  );

  const next = exists
    ? list.map((item) =>
        item.id === data.id ? data : item
      )
    : [...list, data];

  return next.sort((a, b) => a.order - b.order);
}

export function SettingsProvider({
  children,
}: {
  children: ReactNode;
}) {

  const [categories, setCategories, loading] =
    useWorkspaceSlice(
      (dados) => dados.categories,
      [] as CategoryOption[]
    );

  const [subcategories, setSubcategories] =
    useWorkspaceSlice(
      (dados) => dados.subcategories,
      [] as SubcategoryOption[]
    );

  const [teams, setTeams] = useWorkspaceSlice(
    (dados) => dados.teamOptions,
    [] as TeamOption[]
  );

  const [checklist, setChecklist] = useWorkspaceSlice(
    (dados) => dados.checklist,
    [] as ChecklistItem[]
  );

  const [tags, setTags] = useWorkspaceSlice(
    (dados) => dados.tags,
    [] as CaseTag[]
  );

  const value = useMemo<SettingsContextType>(
    () => ({
      categories,
      subcategories,
      teams,
      checklist,
      tags,
      loading,

      saveCategory: (data) => {
        setCategories((prev) => upsert(prev, data));
        sincronizar(() => gravarCategoria(data));
      },

      removeCategory: (id) => {
        setCategories((prev) =>
          prev.filter((item) => item.id !== id)
        );
        sincronizar(() => apagarCategoria(id));
      },

      saveSubcategory: (data) => {
        setSubcategories((prev) => upsert(prev, data));
        sincronizar(() => gravarSubcategoria(data));
      },

      removeSubcategory: (id) => {
        setSubcategories((prev) =>
          prev.filter((item) => item.id !== id)
        );
        sincronizar(() => apagarSubcategoria(id));
      },

      /**
       * Time aqui é só o rótulo usado nos seletores. O cadastro real de
       * pessoas vive em `TeamsContext`, que grava na tabela `Team`;
       * duplicar a gravação criaria dois donos do mesmo registro.
       */
      saveTeam: (data) =>
        setTeams((prev) => upsert(prev, data)),

      removeTeam: (id) =>
        setTeams((prev) =>
          prev.filter((item) => item.id !== id)
        ),

      saveChecklistItem: (data) => {
        setChecklist((prev) => upsert(prev, data));
        sincronizar(() => gravarChecklist(data));
      },

      removeChecklistItem: (id) => {
        setChecklist((prev) =>
          prev.filter((item) => item.id !== id)
        );
        sincronizar(() => apagarChecklist(id));
      },

      saveTag: (data) => {
        setTags((prev) => upsert(prev, data));
        sincronizar(() => gravarTag(data));
      },

      removeTag: (id) => {
        setTags((prev) =>
          prev.filter((item) => item.id !== id)
        );
        sincronizar(() => apagarTag(id));
      },
    }),
    [
      categories,
      subcategories,
      teams,
      checklist,
      tags,
      loading,
      setCategories,
      setSubcategories,
      setTeams,
      setChecklist,
      setTags,
    ]
  );

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);

  if (!context) {
    throw new Error(
      "useSettings deve estar dentro de SettingsProvider."
    );
  }

  return context;
}
