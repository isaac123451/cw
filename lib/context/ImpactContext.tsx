"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  ReactNode,
} from "react";

import { ImpactRecord } from "@/lib/models/impact";
import { mockImpact } from "@/lib/data/mockImpact";

export type ImpactDraft = Omit<ImpactRecord, "id">;

interface ImpactContextType {
  records: ImpactRecord[];
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

  const [records, setRecords] = useState<ImpactRecord[]>(
    // Mais recentes primeiro, que é como a tela lista.
    [...mockImpact].sort((a, b) =>
      b.date.localeCompare(a.date)
    )
  );

  const value = useMemo<ImpactContextType>(
    () => ({
      records,

      createRecord: (data) =>
        setRecords((prev) =>
          [
            { ...data, id: crypto.randomUUID() },
            ...prev,
          ].sort((a, b) =>
            b.date.localeCompare(a.date)
          )
        ),

      updateRecord: (data) =>
        setRecords((prev) =>
          prev
            .map((item) =>
              item.id === data.id ? data : item
            )
            .sort((a, b) =>
              b.date.localeCompare(a.date)
            )
        ),

      removeRecord: (id) =>
        setRecords((prev) =>
          prev.filter((item) => item.id !== id)
        ),
    }),
    [records]
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
