"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  ReactNode,
} from "react";

import {
  CategoryOption,
  ChecklistItem,
  SubcategoryOption,
  TeamOption,
} from "@/lib/models/settings";

import { CaseTag, mockTags } from "@/lib/data/mockTags";

import {
  mockCategories,
  mockChecklist,
  mockSubcategories,
  mockTeamOptions,
} from "@/lib/data/mockSettings";

interface SettingsContextType {
  categories: CategoryOption[];
  subcategories: SubcategoryOption[];
  teams: TeamOption[];
  checklist: ChecklistItem[];
  tags: CaseTag[];

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
  const [categories, setCategories] = useState(
    mockCategories
  );

  const [subcategories, setSubcategories] = useState(
    mockSubcategories
  );

  const [teams, setTeams] = useState(mockTeamOptions);

  const [checklist, setChecklist] = useState(
    mockChecklist
  );

  const [tags, setTags] = useState(mockTags);

  const value = useMemo<SettingsContextType>(
    () => ({
      categories,
      subcategories,
      teams,
      checklist,
      tags,

      saveCategory: (data) =>
        setCategories((prev) => upsert(prev, data)),

      removeCategory: (id) =>
        setCategories((prev) =>
          prev.filter((item) => item.id !== id)
        ),

      saveSubcategory: (data) =>
        setSubcategories((prev) => upsert(prev, data)),

      removeSubcategory: (id) =>
        setSubcategories((prev) =>
          prev.filter((item) => item.id !== id)
        ),

      saveTeam: (data) =>
        setTeams((prev) => upsert(prev, data)),

      removeTeam: (id) =>
        setTeams((prev) =>
          prev.filter((item) => item.id !== id)
        ),

      saveChecklistItem: (data) =>
        setChecklist((prev) => upsert(prev, data)),

      removeChecklistItem: (id) =>
        setChecklist((prev) =>
          prev.filter((item) => item.id !== id)
        ),

      saveTag: (data) =>
        setTags((prev) => upsert(prev, data)),

      removeTag: (id) =>
        setTags((prev) =>
          prev.filter((item) => item.id !== id)
        ),
    }),
    [categories, subcategories, teams, checklist, tags]
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
