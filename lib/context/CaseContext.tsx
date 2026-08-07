"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  ReactNode,
} from "react";

import { Case } from "@/lib/models/case";
import { mockCases } from "@/lib/data/mockCases";

export interface CaseFilters {
  search: string;
  company: string;
  status: string;
  category: string;
  tag: string;
}

const emptyFilters: CaseFilters = {
  search: "",
  company: "",
  status: "",
  category: "",
  tag: "",
};

interface CaseContextType {
  cases: Case[];

  /** Casos após aplicar busca e filtros da Toolbar. */
  filteredCases: Case[];

  filters: CaseFilters;

  setFilter: (
    field: keyof CaseFilters,
    value: string
  ) => void;

  clearFilters: () => void;

  setCases: React.Dispatch<
    React.SetStateAction<Case[]>
  >;

  createCase: (data: Case) => void;

  updateCase: (data: Case) => void;

  deleteCase: (id: string) => void;

  moveCase: (
    id: string,
    status: string
  ) => void;

  toggleTag: (id: string, tag: string) => void;
}

const CaseContext =
  createContext<CaseContextType | null>(
    null
  );

export function CaseProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [cases, setCases] =
    useState<Case[]>(mockCases);

  const [filters, setFilters] =
    useState<CaseFilters>(emptyFilters);

  function setFilter(
    field: keyof CaseFilters,
    value: string
  ) {
    setFilters((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  function clearFilters() {
    setFilters(emptyFilters);
  }

  function createCase(data: Case) {
    setCases((prev) => [data, ...prev]);
  }

  function updateCase(data: Case) {
    setCases((prev) =>
      prev.map((item) =>
        item.id === data.id
          ? data
          : item
      )
    );
  }

  function deleteCase(id: string) {
    setCases((prev) =>
      prev.filter(
        (item) => item.id !== id
      )
    );
  }

  function moveCase(
    id: string,
    status: string
  ) {
    setCases((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              status,
            }
          : item
      )
    );
  }

  /** Aplica ou remove uma etiqueta do caso. */
  function toggleTag(id: string, tag: string) {
    setCases((prev) =>
      prev.map((item) => {

        if (item.id !== id) return item;

        const current = item.tags ?? [];

        return {
          ...item,
          tags: current.includes(tag)
            ? current.filter((value) => value !== tag)
            : [...current, tag],
        };
      })
    );
  }

  const filteredCases = useMemo(() => {

    const term = filters.search
      .trim()
      .toLowerCase();

    return cases.filter((item) => {

      if (
        filters.company &&
        item.company !== filters.company
      ) {
        return false;
      }

      if (
        filters.status &&
        item.status !== filters.status
      ) {
        return false;
      }

      if (
        filters.category &&
        item.category !== filters.category
      ) {
        return false;
      }

      if (
        filters.tag &&
        !(item.tags ?? []).includes(filters.tag)
      ) {
        return false;
      }

      if (!term) return true;

      return [
        item.protocol,
        item.title,
        item.company,
        item.customer,
        item.category,
        item.owner,
        item.city,
      ]
        .filter(Boolean)
        .some((field) =>
          String(field)
            .toLowerCase()
            .includes(term)
        );

    });

  }, [cases, filters]);

  const value = useMemo(
    () => ({
      cases,

      filteredCases,

      filters,

      setFilter,

      clearFilters,

      setCases,

      createCase,

      updateCase,

      deleteCase,

      moveCase,

      toggleTag,
    }),
    [cases, filteredCases, filters]
  );

  return (
    <CaseContext.Provider value={value}>
      {children}
    </CaseContext.Provider>
  );
}

export function useCases() {
  const context =
    useContext(CaseContext);

  if (!context) {
    throw new Error(
      "useCases deve estar dentro de CaseProvider."
    );
  }

  return context;
}
