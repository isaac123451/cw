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

interface CaseContextType {
  cases: Case[];

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

  const value = useMemo(
    () => ({
      cases,

      setCases,

      createCase,

      updateCase,

      deleteCase,

      moveCase,
    }),
    [cases]
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