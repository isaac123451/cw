"use client";

import {
  createContext,
  useContext,
  useMemo,
  ReactNode,
} from "react";

import {
  JourneyEntry,
  JourneyStage,
  JourneyTopic,
} from "@/lib/models/journey";

import {
  removeJourneyEntry,
  removeJourneyStage,
  removeJourneyTopic,
  saveJourneyEntry,
  saveJourneyPlacement,
  saveJourneyStage,
  saveJourneyTopic,
} from "@/lib/actions/registry";

import { useWorkspaceSlice } from "@/lib/context/useWorkspace";
import {
  sincronizar,
  type Gravacao,
} from "@/lib/context/sync";

import { hojeNaOperacao } from "@/lib/services/reputation.service";

interface JourneyContextType {
  stages: JourneyStage[];
  topics: JourneyTopic[];
  entries: JourneyEntry[];

  /** Carga inicial ainda em andamento. */
  loading: boolean;

  /** Etapa atual de cada cliente. Sem registro = primeira etapa. */
  placement: Record<string, string>;

  moveCompany: (company: string, stageId: string) => void;

  saveStage: (data: JourneyStage) => void;
  removeStage: (id: string) => void;

  /** Devolve o resultado: a tela de tópicos grava por botão. */
  saveTopic: (data: JourneyTopic) => Promise<Gravacao>;
  removeTopic: (id: string) => void;

  addEntry: (
    data: Omit<JourneyEntry, "id" | "createdAt">
  ) => void;
  updateEntry: (id: string, text: string) => void;
  removeEntry: (id: string) => void;
}

const JourneyContext =
  createContext<JourneyContextType | null>(null);

function upsert<T extends { id: string; order: number }>(
  list: T[],
  data: T
) {
  const exists = list.some(
    (item) => item.id === data.id
  );

  return (
    exists
      ? list.map((item) =>
          item.id === data.id ? data : item
        )
      : [...list, data]
  ).sort((a, b) => a.order - b.order);
}

export function JourneyProvider({
  children,
}: {
  children: ReactNode;
}) {

  const [stages, setStages, loading] = useWorkspaceSlice(
    (dados) => dados.journeyStages,
    [] as JourneyStage[]
  );

  const [topics, setTopics] = useWorkspaceSlice(
    (dados) => dados.journeyTopics,
    [] as JourneyTopic[]
  );

  const [entries, setEntries] = useWorkspaceSlice(
    (dados) => dados.journeyEntries,
    [] as JourneyEntry[]
  );

  const [placement, setPlacement] = useWorkspaceSlice(
    (dados) => dados.journeyPlacements,
    {} as Record<string, string>
  );

  const value = useMemo<JourneyContextType>(
    () => ({
      stages,
      topics,
      entries,
      placement,
      loading,

      /**
       * Em qual etapa cada cliente está. Vai para o banco
       * (`JourneyPlacement`): antes se perdia no reload.
       */
      moveCompany: (company, stageId) => {
        setPlacement((prev) => ({
          ...prev,
          [company]: stageId,
        }));

        sincronizar(() =>
          saveJourneyPlacement(company, stageId)
        );
      },

      saveStage: (data) => {
        setStages((prev) => upsert(prev, data));
        sincronizar(() => saveJourneyStage(data));
      },

      removeStage: (id) => {
        setStages((prev) =>
          prev.filter((item) => item.id !== id)
        );
        sincronizar(() => removeJourneyStage(id));
      },

      saveTopic: (data) => {
        setTopics((prev) => upsert(prev, data));
        return sincronizar(() => saveJourneyTopic(data));
      },

      removeTopic: (id) => {
        setTopics((prev) =>
          prev.filter((item) => item.id !== id)
        );

        // Sem o tópico os registros ficariam órfãos. No banco a
        // exclusão em cascata cuida disso.
        setEntries((prev) =>
          prev.filter((item) => item.topicId !== id)
        );

        sincronizar(() => removeJourneyTopic(id));
      },

      addEntry: (data) => {

        const nova: JourneyEntry = {
          ...data,
          id: crypto.randomUUID(),
          createdAt: hojeNaOperacao(),
        };

        setEntries((prev) => [nova, ...prev]);
        sincronizar(() => saveJourneyEntry(nova));
      },

      updateEntry: (id, text) => {

        const atual = entries.find(
          (item) => item.id === id
        );

        if (!atual) return;

        const alterada = { ...atual, text };

        setEntries((prev) =>
          prev.map((item) =>
            item.id === id ? alterada : item
          )
        );

        sincronizar(() => saveJourneyEntry(alterada));
      },

      removeEntry: (id) => {
        setEntries((prev) =>
          prev.filter((item) => item.id !== id)
        );
        sincronizar(() => removeJourneyEntry(id));
      },
    }),
    [
      stages,
      topics,
      entries,
      placement,
      loading,
      setStages,
      setTopics,
      setEntries,
      setPlacement,
    ]
  );

  return (
    <JourneyContext.Provider value={value}>
      {children}
    </JourneyContext.Provider>
  );
}

export function useJourney() {
  const context = useContext(JourneyContext);

  if (!context) {
    throw new Error(
      "useJourney deve estar dentro de JourneyProvider."
    );
  }

  return context;
}
