"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from "react";

import type { CaseFilters } from "@/lib/context/CaseContext";

import {
  BUILT_IN_FILTERS,
  countCriteria,
  emptyCriteria,
  SavedFilter,
} from "@/lib/models/savedFilter";

const STORAGE_KEY = "cw:filtros-salvos";

interface SavedFiltersContextType {
  /** Pré-definidos primeiro, depois os que a pessoa criou. */
  filters: SavedFilter[];

  /** Guarda o critério atual. Nome repetido sobrescreve o anterior. */
  saveFilter: (
    name: string,
    criteria: CaseFilters
  ) => void;

  removeFilter: (id: string) => void;
}

const SavedFiltersContext =
  createContext<SavedFiltersContextType | null>(null);

/**
 * Os filtros do usuário ficam no localStorage, como as preferências:
 * são de quem está na máquina, e assim sobrevivem ao reload antes de o
 * banco existir (o modelo SavedFilter já está no schema do Prisma).
 */
export function SavedFiltersProvider({
  children,
}: {
  children: ReactNode;
}) {

  const [mine, setMine] = useState<SavedFilter[]>([]);

  // Só depois da montagem: no servidor não existe localStorage e ler no
  // primeiro render causaria divergência de hidratação.
  useEffect(() => {

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;

      const parsed = JSON.parse(saved) as SavedFilter[];

      if (!Array.isArray(parsed)) return;

      setMine(
        parsed.map((item) => ({
          ...item,
          // Critério antigo pode não ter os campos mais novos.
          criteria: {
            ...emptyCriteria,
            ...item.criteria,
          },
          builtIn: false,
        }))
      );
    } catch {
      // Filtro corrompido não pode derrubar a aplicação.
    }

  }, []);

  function persist(next: SavedFilter[]) {
    setMine(next);

    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(next)
      );
    } catch {
      // Modo privado pode bloquear a escrita — segue em memória.
    }
  }

  const value = useMemo<SavedFiltersContextType>(
    () => ({
      filters: [...BUILT_IN_FILTERS, ...mine],

      saveFilter: (name, criteria) => {

        const nome = name.trim();

        // Sem nome ou sem critério não há o que guardar — e um filtro
        // vazio aplicado depois pareceria um bug ("não filtrou nada").
        if (nome === "" || countCriteria(criteria) === 0) {
          return;
        }

        const existente = mine.find(
          (item) =>
            item.name.toLowerCase() ===
            nome.toLowerCase()
        );

        if (existente) {
          persist(
            mine.map((item) =>
              item.id === existente.id
                ? { ...item, criteria }
                : item
            )
          );
          return;
        }

        persist([
          ...mine,
          {
            id: crypto.randomUUID(),
            name: nome,
            criteria,
            builtIn: false,
            order: mine.length,
          },
        ]);
      },

      removeFilter: (id) =>
        persist(mine.filter((item) => item.id !== id)),
    }),
    [mine]
  );

  return (
    <SavedFiltersContext.Provider value={value}>
      {children}
    </SavedFiltersContext.Provider>
  );
}

export function useSavedFilters() {
  const context = useContext(SavedFiltersContext);

  if (!context) {
    throw new Error(
      "useSavedFilters deve estar dentro de SavedFiltersProvider."
    );
  }

  return context;
}
