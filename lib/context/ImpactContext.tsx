"use client";

import {
  createContext,
  useContext,
  useMemo,
  ReactNode,
} from "react";

import {
  ImpactRecord,
  ImpactTypeOption,
} from "@/lib/models/impact";

import {
  removeImpactRecord,
  removeImpactType,
  saveImpactRecord,
  saveImpactType,
} from "@/lib/actions/registry";

import { useWorkspaceSlice } from "@/lib/context/useWorkspace";
import {
  sincronizar,
  type Gravacao,
} from "@/lib/context/sync";

export type ImpactDraft = Omit<ImpactRecord, "id">;

interface ImpactContextType {
  records: ImpactRecord[];

  /** Tipos administrados pela operação. */
  types: ImpactTypeOption[];

  /** Carga inicial ainda em andamento. */
  loading: boolean;

  /**
   * Devolve o resultado da gravação.
   *
   * A tela de tipos passou a usar o botão Salvar, e o `useRascunho`
   * precisa saber se cada item foi gravado para decidir se limpa o
   * rascunho — confirmar "salvo" antes da resposta do servidor
   * confirmaria o clique, não a gravação.
   */
  saveType: (data: ImpactTypeOption) => Promise<Gravacao>;
  removeType: (id: string) => void;
  createRecord: (data: ImpactDraft) => void;
  updateRecord: (data: ImpactRecord) => void;
  removeRecord: (id: string) => void;
}

const ImpactContext =
  createContext<ImpactContextType | null>(null);

export function ImpactProvider({
  children,
}: {
  children: ReactNode;
}) {

  const [records, setRecords, loading] =
    useWorkspaceSlice(
      // Mais recentes primeiro, que é como a tela lista.
      (dados) =>
        [...dados.impact].sort((a, b) =>
          b.date.localeCompare(a.date)
        ),
      [] as ImpactRecord[]
    );

  const [types, setTypes] = useWorkspaceSlice(
    (dados) => dados.impactTypes,
    [] as ImpactTypeOption[]
  );

  const value = useMemo<ImpactContextType>(
    () => ({
      records,
      types,
      loading,

      saveType: (data) => {
        setTypes((prev) => {

          const existe = prev.some(
            (item) => item.id === data.id
          );

          return (
            existe
              ? prev.map((item) =>
                  item.id === data.id ? data : item
                )
              : [...prev, data]
          ).sort((a, b) => a.order - b.order);
        });

        return sincronizar(() => saveImpactType(data));
      },

      removeType: (id) => {
        setTypes((prev) =>
          prev.filter((item) => item.id !== id)
        );
        sincronizar(() => removeImpactType(id));
      },

      createRecord: (data) => {

        const novo: ImpactRecord = {
          ...data,
          id: crypto.randomUUID(),
        };

        setRecords((prev) =>
          [novo, ...prev].sort((a, b) =>
            b.date.localeCompare(a.date)
          )
        );

        sincronizar(() => saveImpactRecord(novo));
      },

      updateRecord: (data) => {
        setRecords((prev) =>
          prev
            .map((item) =>
              item.id === data.id ? data : item
            )
            .sort((a, b) =>
              b.date.localeCompare(a.date)
            )
        );
        sincronizar(() => saveImpactRecord(data));
      },

      removeRecord: (id) => {
        setRecords((prev) =>
          prev.filter((item) => item.id !== id)
        );
        sincronizar(() => removeImpactRecord(id));
      },
    }),
    [records, types, loading, setRecords, setTypes]
  );

  return (
    <ImpactContext.Provider value={value}>
      {children}
    </ImpactContext.Provider>
  );
}

export function useImpact() {
  const context = useContext(ImpactContext);

  if (!context) {
    throw new Error(
      "useImpact deve estar dentro de ImpactProvider."
    );
  }

  return context;
}
