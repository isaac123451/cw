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
  PRAZOS_DE_AREA_PADRAO,
  type PrazosDeArea,
} from "@/lib/models/movement";

import {
  removeMovementRule,
  saveMovementRule,
} from "@/lib/actions/registry";

import { useWorkspaceSlice } from "@/lib/context/useWorkspace";
import { sincronizar } from "@/lib/context/sync";

export type MovementRuleDraft = Omit<MovementRule, "id">;

interface MovementsContextType {
  movements: CaseMovement[];
  rules: MovementRule[];

  /** Prazo de retorno das áreas por criticidade, em horas úteis. */
  prazosDeArea: PrazosDeArea;
  setPrazosDeArea: (valor: PrazosDeArea) => void;

  /**
   * Põe na lista o que o servidor acabou de gravar.
   *
   * Acionar área, registrar retorno e escalonar gravam por ação própria
   * (`lib/actions/tratativa.ts`) e devolvem o registro pronto — a lista
   * só acompanha, sem segunda ida ao banco. Até 13/09/2026 a tela
   * gravava por `createMovement`/`closeMovement`, sem esperar resposta:
   * um acionamento recusado pelo servidor ficava na tela como feito.
   */
  aplicarMovimento: (movimento: CaseMovement) => void;

  /** Tira da lista o que o servidor acabou de apagar. */
  retirarMovimento: (id: string) => void;

  /** Carga inicial ainda em andamento. */
  loading: boolean;

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

  const [prazosDeArea, setPrazosDeArea] = useWorkspaceSlice(
    (dados) => dados.prazosDeArea ?? PRAZOS_DE_AREA_PADRAO,
    PRAZOS_DE_AREA_PADRAO
  );

  const value = useMemo<MovementsContextType>(
    () => ({
      movements,
      rules,
      loading,
      prazosDeArea,
      setPrazosDeArea: (valor) => setPrazosDeArea(valor),

      aplicarMovimento: (movimento) => {
        setMovements((prev) =>
          prev.some((m) => m.id === movimento.id)
            ? prev.map((m) => (m.id === movimento.id ? movimento : m))
            : [movimento, ...prev]
        );
      },

      retirarMovimento: (id) => {
        setMovements((prev) => prev.filter((m) => m.id !== id));
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
    [movements, rules, loading, setMovements, setRules, prazosDeArea, setPrazosDeArea]
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
