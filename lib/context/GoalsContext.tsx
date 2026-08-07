"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  ReactNode,
} from "react";

import { RA1000_TARGETS } from "@/lib/services/reputation.service";

export type GoalKey = keyof typeof RA1000_TARGETS;

export type Goals = Record<GoalKey, number>;

interface GoalsContextType {
  goals: Goals;
  setGoal: (key: GoalKey, value: number) => void;
  resetGoals: () => void;
  /** True quando alguma meta difere do padrão RA1000. */
  customized: boolean;
}

const GoalsContext =
  createContext<GoalsContextType | null>(null);

/**
 * Metas dos indicadores. Começam nos critérios públicos do RA1000 e
 * podem ser ajustadas manualmente pela operação.
 */
export function GoalsProvider({
  children,
}: {
  children: ReactNode;
}) {

  const [goals, setGoals] = useState<Goals>({
    ...RA1000_TARGETS,
  });

  const value = useMemo<GoalsContextType>(
    () => ({
      goals,

      setGoal: (key, value) =>
        setGoals((prev) => ({
          ...prev,
          [key]: value,
        })),

      resetGoals: () => setGoals({ ...RA1000_TARGETS }),

      customized: (
        Object.keys(RA1000_TARGETS) as GoalKey[]
      ).some(
        (key) => goals[key] !== RA1000_TARGETS[key]
      ),
    }),
    [goals]
  );

  return (
    <GoalsContext.Provider value={value}>
      {children}
    </GoalsContext.Provider>
  );
}

export function useGoals() {
  const context = useContext(GoalsContext);

  if (!context) {
    throw new Error(
      "useGoals deve estar dentro de GoalsProvider."
    );
  }

  return context;
}
