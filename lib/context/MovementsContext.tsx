"use client";

import {
  createContext,
  useContext,
  useMemo,
  ReactNode,
} from "react";

import {
  CaseMovement,
  MovementRule,
} from "@/lib/models/movement";

import {
  removeMovement,
  removeMovementRule,
  saveMovement,
  saveMovementRule,
} from "@/lib/actions/registry";

import { useWorkspaceSlice } from "@/lib/context/useWorkspace";
import { sincronizar } from "@/lib/context/sync";

export type MovementDraft = Omit<
  CaseMovement,
  "id" | "returnedAt" | "outcome"
>;

export type MovementRuleDraft = Omit<MovementRule, "id">;

interface MovementsContextType {
  movements: CaseMovement[];
  rules: MovementRule[];

  /** Carga inicial ainda em andamento. */
  loading: boolean;

  /** Encaminha o caso para uma área ou para o cliente. */
  createMovement: (data: MovementDraft) => void;

  /** Fecha o relógio: a área respondeu. */
  closeMovement: (
    id: string,
    outcome: string,
    returnedAt: string
  ) => void;

  removeMovement: (id: string) => void;

  createRule: (data: MovementRuleDraft) => void;
  updateRule: (data: MovementRule) => void;
  removeRule: (id: string) => void;
  toggleRule: (id: string) => void;
}

const MovementsContext =
  createContext<MovementsContextType | null>(null);

export function MovementsProvider({
  children,
}: {
  children: ReactNode;
}) {

  const [movements, setMovements, loading] =
    useWorkspaceSlice(
      (dados) => dados.movements,
      [] as CaseMovement[]
    );

  const [rules, setRules] = useWorkspaceSlice(
    (dados) => dados.movementRules,
    [] as MovementRule[]
  );

  const value = useMemo<MovementsContextType>(
    () => ({
      movements,
      rules,
      loading,

      createMovement: (data) => {

        const novo: CaseMovement = {
          ...data,
          id: crypto.randomUUID(),
        };

        setMovements((prev) => [novo, ...prev]);
        sincronizar(() => saveMovement(novo));
      },

      closeMovement: (id, outcome, returnedAt) => {

        const atual = movements.find(
          (item) => item.id === id
        );

        if (!atual) return;

        const fechada = {
          ...atual,
          outcome,
          returnedAt,
        };

        setMovements((prev) =>
          prev.map((item) =>
            item.id === id ? fechada : item
          )
        );

        sincronizar(() => saveMovement(fechada));
      },

      removeMovement: (id) => {
        setMovements((prev) =>
          prev.filter((item) => item.id !== id)
        );
        sincronizar(() => removeMovement(id));
      },

      createRule: (data) => {

        const novo: MovementRule = {
          ...data,
          id: crypto.randomUUID(),
        };

        setRules((prev) => [...prev, novo]);
        sincronizar(() => saveMovementRule(novo));
      },

      updateRule: (data) => {
        setRules((prev) =>
          prev.map((item) =>
            item.id === data.id ? data : item
          )
        );
        sincronizar(() => saveMovementRule(data));
      },

      removeRule: (id) => {
        setRules((prev) =>
          prev.filter((item) => item.id !== id)
        );
        sincronizar(() => removeMovementRule(id));
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

        sincronizar(() => saveMovementRule(alterado));
      },
    }),
    [movements, rules, loading, setMovements, setRules]
  );

  return (
    <MovementsContext.Provider value={value}>
      {children}
    </MovementsContext.Provider>
  );
}

export function useMovements() {
  const context = useContext(MovementsContext);

  if (!context) {
    throw new Error(
      "useMovements deve estar dentro de MovementsProvider."
    );
  }

  return context;
}
