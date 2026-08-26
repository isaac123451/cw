"use client";

import {
  createContext,
  useContext,
  useMemo,
  ReactNode,
} from "react";

import { Macro } from "@/lib/models/macro";

import {
  removeMacro,
  saveMacro,
} from "@/lib/actions/registry";

import { useWorkspaceSlice } from "@/lib/context/useWorkspace";
import { sincronizar } from "@/lib/context/sync";

import { hojeNaOperacao } from "@/lib/services/reputation.service";

export type MacroDraft = Omit<
  Macro,
  "id" | "uses" | "updatedAt"
>;

interface MacrosContextType {
  macros: Macro[];

  /** Carga inicial ainda em andamento. */
  loading: boolean;

  createMacro: (data: MacroDraft) => void;
  updateMacro: (data: Macro) => void;
  removeMacro: (id: string) => void;

  /** Conta o uso quando o texto é inserido em uma resposta. */
  registerUse: (id: string) => void;
}

const MacrosContext =
  createContext<MacrosContextType | null>(null);

export function MacrosProvider({
  children,
}: {
  children: ReactNode;
}) {

  const [macros, setMacros, loading] =
    useWorkspaceSlice(
      (dados) => dados.macros,
      [] as Macro[]
    );

  const value = useMemo<MacrosContextType>(
    () => ({
      macros,
      loading,

      createMacro: (data) => {

        const novo: Macro = {
          ...data,
          id: crypto.randomUUID(),
          uses: 0,
          updatedAt: hojeNaOperacao(),
        };

        setMacros((prev) => [novo, ...prev]);
        sincronizar(() => saveMacro(novo));
      },

      updateMacro: (data) => {

        const alterado = {
          ...data,
          updatedAt: hojeNaOperacao(),
        };

        setMacros((prev) =>
          prev.map((item) =>
            item.id === data.id ? alterado : item
          )
        );

        sincronizar(() => saveMacro(alterado));
      },

      removeMacro: (id) => {
        setMacros((prev) =>
          prev.filter((item) => item.id !== id)
        );
        sincronizar(() => removeMacro(id));
      },

      registerUse: (id) => {

        const atual = macros.find(
          (item) => item.id === id
        );

        if (!atual) return;

        const usado = {
          ...atual,
          uses: atual.uses + 1,
        };

        setMacros((prev) =>
          prev.map((item) =>
            item.id === id ? usado : item
          )
        );

        sincronizar(() => saveMacro(usado));
      },
    }),
    [macros, loading, setMacros]
  );

  return (
    <MacrosContext.Provider value={value}>
      {children}
    </MacrosContext.Provider>
  );
}

export function useMacros() {
  const context = useContext(MacrosContext);

  if (!context) {
    throw new Error(
      "useMacros deve estar dentro de MacrosProvider."
    );
  }

  return context;
}
