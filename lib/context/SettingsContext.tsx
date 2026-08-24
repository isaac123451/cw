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
import type { CaseTag } from "@/lib/models/tag";

import {
  removeCategory as apagarCategoria,
  removeChecklistItem as apagarChecklist,
  removeSubcategory as apagarSubcategoria,
  removeTag as apagarTag,
  removeTeamRecord as apagarTime,
  saveCategory as gravarCategoria,
  saveChecklistItem as gravarChecklist,
  saveSubcategory as gravarSubcategoria,
  saveTag as gravarTag,
  saveTeamOption as gravarTime,
} from "@/lib/actions/registry";

import { useWorkspaceSlice } from "@/lib/context/useWorkspace";
import {
  type Gravacao,
  sincronizar,
} from "@/lib/context/sync";

interface SettingsContextType {
  categories: CategoryOption[];
  subcategories: SubcategoryOption[];
  teams: TeamOption[];
  checklist: ChecklistItem[];
  tags: CaseTag[];

  /** Carga inicial ainda em andamento. */
  loading: boolean;

  /**
   * Gravar devolve o resultado.
   *
   * As telas com botão **Salvar** precisam saber se deu certo antes de
   * dizer "salvo" — ver `lib/hooks/useRascunho.ts`. Quem chama sem
   * esperar continua funcionando como antes.
   */
  saveCategory: (data: CategoryOption) => Promise<Gravacao>;
  removeCategory: (id: string) => Promise<Gravacao>;

  saveSubcategory: (
    data: SubcategoryOption
  ) => Promise<Gravacao>;
  removeSubcategory: (id: string) => Promise<Gravacao>;

  saveTeam: (data: TeamOption) => Promise<Gravacao>;
  removeTeam: (id: string) => Promise<Gravacao>;

  saveChecklistItem: (
    data: ChecklistItem
  ) => Promise<Gravacao>;
  removeChecklistItem: (id: string) => Promise<Gravacao>;

  saveTag: (data: CaseTag) => Promise<Gravacao>;
  removeTag: (id: string) => Promise<Gravacao>;
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
        return sincronizar(() => gravarCategoria(data));
      },

      removeCategory: (id) => {
        setCategories((prev) =>
          prev.filter((item) => item.id !== id)
        );
        return sincronizar(() => apagarCategoria(id));
      },

      saveSubcategory: (data) => {
        setSubcategories((prev) => upsert(prev, data));
        return sincronizar(() => gravarSubcategoria(data));
      },

      removeSubcategory: (id) => {
        setSubcategories((prev) =>
          prev.filter((item) => item.id !== id)
        );
        return sincronizar(() => apagarSubcategoria(id));
      },

      /**
       * Time aqui é o **rótulo** usado nos seletores; o cadastro de
       * pessoas vive em `TeamsContext`. São a mesma linha do banco, e
       * cada tela grava só os campos que edita — `saveTeamOption` toca
       * em nome, nome legado, ordem e ativo, e em mais nada.
       *
       * Antes esta aba não gravava coisa nenhuma, por medo de "dois
       * donos do mesmo registro". O efeito era pior do que o problema
       * que evitava: o que se cadastrava em Times sumia no reload.
       */
      saveTeam: (data) => {
        setTeams((prev) => upsert(prev, data));
        return sincronizar(() => gravarTime(data));
      },

      removeTeam: (id) => {
        setTeams((prev) =>
          prev.filter((item) => item.id !== id)
        );
        return sincronizar(() => apagarTime(id));
      },

      saveChecklistItem: (data) => {
        setChecklist((prev) => upsert(prev, data));
        return sincronizar(() => gravarChecklist(data));
      },

      removeChecklistItem: (id) => {
        setChecklist((prev) =>
          prev.filter((item) => item.id !== id)
        );
        return sincronizar(() => apagarChecklist(id));
      },

      saveTag: (data) => {
        setTags((prev) => upsert(prev, data));
        return sincronizar(() => gravarTag(data));
      },

      removeTag: (id) => {
        setTags((prev) =>
          prev.filter((item) => item.id !== id)
        );
        return sincronizar(() => apagarTag(id));
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
