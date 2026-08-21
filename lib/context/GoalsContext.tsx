"use client";

import {
  createContext,
  useContext,
  useMemo,
  ReactNode,
} from "react";

import { RA1000_TARGETS } from "@/lib/services/reputation.service";

import {
  resetReputationGoals,
  saveReputationGoal,
} from "@/lib/actions/registry";

import { useWorkspaceSlice } from "@/lib/context/useWorkspace";
import { sincronizar } from "@/lib/context/sync";

export type GoalKey = keyof typeof RA1000_TARGETS;

export type Goals = Record<GoalKey, number>;

interface GoalsContextType {
  goals: Goals;
  setGoal: (key: GoalKey, value: number) => void;
  resetGoals: () => void;
  /** True quando alguma meta difere do padrão RA1000. */
  customized: boolean;
  /** Carga inicial ainda em andamento. */
  loading: boolean;
}

const GoalsContext =
  createContext<GoalsContextType | null>(null);

const CHAVES = Object.keys(
  RA1000_TARGETS
) as GoalKey[];

/**
 * Metas dos indicadores.
 *
 * Começam nos critérios públicos do RA1000 e podem ser apertadas pela
 * operação. **O banco guarda só o que foi ajustado** — o que não tem
 * linha segue o critério público, então uma mudança do Reclame Aqui
 * chega sozinha a quem nunca mexeu.
 *
 * Até 21/08/2026 isto vivia em `useState` e nada mais: a meta ajustada
 * voltava ao padrão em todo recarregamento, sem aviso nenhum — o
 * indicador simplesmente passava a cobrar outro número.
 */
export function GoalsProvider({
  children,
}: {
  children: ReactNode;
}) {

  const [ajustadas, setAjustadas, loading] =
    useWorkspaceSlice(
      (dados) => dados.reputationGoals,
      {} as Record<string, number>
    );

  const goals = useMemo<Goals>(() => {

    const saida = { ...RA1000_TARGETS } as Goals;

    for (const chave of CHAVES) {
      const valor = ajustadas[chave];

      // `typeof` e não `??`: meta 0 é ajuste válido, ainda que estranho.
      if (typeof valor === "number") {
        saida[chave] = valor;
      }
    }

    return saida;
  }, [ajustadas]);

  const value = useMemo<GoalsContextType>(
    () => ({
      goals,
      loading,

      setGoal: (key, value) => {

        const padrao = RA1000_TARGETS[key];

        setAjustadas((prev) => {

          const proximo = { ...prev };

          /**
           * Voltar ao valor de fábrica **apaga** o ajuste em vez de
           * gravá-lo igual ao padrão. É o que mantém a promessa acima:
           * sem linha, o indicador volta a seguir o critério público.
           */
          if (value === padrao) {
            delete proximo[key];
          } else {
            proximo[key] = value;
          }

          return proximo;
        });

        sincronizar(() =>
          saveReputationGoal(key, value, padrao)
        );
      },

      resetGoals: () => {
        setAjustadas({});
        sincronizar(() => resetReputationGoals());
      },

      customized: CHAVES.some(
        (key) => goals[key] !== RA1000_TARGETS[key]
      ),
    }),
    [goals, loading, setAjustadas]
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
