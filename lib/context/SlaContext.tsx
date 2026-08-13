"use client";

import {
  createContext,
  useContext,
  useMemo,
  ReactNode,
} from "react";

import { SlaRule } from "@/lib/models/sla";

import {
  removeSlaRule,
  saveSlaRule,
} from "@/lib/actions/registry";

import { useWorkspaceSlice } from "@/lib/context/useWorkspace";
import { sincronizar } from "@/lib/context/sync";

export type SlaRuleDraft = Omit<SlaRule, "id">;

interface SlaContextType {
  rules: SlaRule[];

  /** Carga inicial ainda em andamento. */
  loading: boolean;
  createRule: (data: SlaRuleDraft) => void;
  updateRule: (data: SlaRule) => void;
  removeRule: (id: string) => void;
  toggleRule: (id: string) => void;
}

const SlaContext = createContext<SlaContextType | null>(
  null
);

export function SlaProvider({
  children,
}: {
  children: ReactNode;
}) {

  const [rules, setRules, loading] = useWorkspaceSlice(
    (dados) => dados.slaRules,
    [] as SlaRule[]
  );

  const value = useMemo<SlaContextType>(
    () => ({
      rules,
      loading,

      createRule: (data) => {

        const novo: SlaRule = {
          ...data,
          id: crypto.randomUUID(),
        };

        setRules((prev) => [...prev, novo]);
        sincronizar(() => saveSlaRule(novo));
      },

      updateRule: (data) => {
        setRules((prev) =>
          prev.map((item) =>
            item.id === data.id ? data : item
          )
        );
        sincronizar(() => saveSlaRule(data));
      },

      removeRule: (id) => {
        setRules((prev) =>
          prev.filter((item) => item.id !== id)
        );
        sincronizar(() => removeSlaRule(id));
      },

      toggleRule: (id) => {

        const atual = rules.find(
          (item) => item.id === id
        );

        if (!atual) return;

        const alterado = {
          ...atual,
          active: !atual.active,
        };

        setRules((prev) =>
          prev.map((item) =>
            item.id === id ? alterado : item
          )
        );

        sincronizar(() => saveSlaRule(alterado));
      },
    }),
    [rules, loading, setRules]
  );

  return (
    <SlaContext.Provider value={value}>
      {children}
    </SlaContext.Provider>
  );
}

export function useSla() {
  const context = useContext(SlaContext);

  if (!context) {
    throw new Error(
      "useSla deve estar dentro de SlaProvider."
    );
  }

  return context;
}
