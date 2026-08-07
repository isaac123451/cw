"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  ReactNode,
} from "react";

import {
  JourneyEntry,
  JourneyStage,
  JourneyTopic,
} from "@/lib/models/journey";

import {
  mockJourneyEntries,
  mockJourneyStages,
  mockJourneyTopics,
} from "@/lib/data/mockJourney";

interface JourneyContextType {
  stages: JourneyStage[];
  topics: JourneyTopic[];
  entries: JourneyEntry[];

  /** Etapa atual de cada cliente. Sem registro = primeira etapa. */
  placement: Record<string, string>;

  moveCompany: (company: string, stageId: string) => void;

  saveStage: (data: JourneyStage) => void;
  removeStage: (id: string) => void;

  saveTopic: (data: JourneyTopic) => void;
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

  const [stages, setStages] = useState(
    mockJourneyStages
  );

  const [topics, setTopics] = useState(
    mockJourneyTopics
  );

  const [entries, setEntries] = useState(
    mockJourneyEntries
  );

  const [placement, setPlacement] = useState<
    Record<string, string>
  >({});

  const value = useMemo<JourneyContextType>(
    () => ({
      stages,
      topics,
      entries,
      placement,

      moveCompany: (company, stageId) =>
        setPlacement((prev) => ({
          ...prev,
          [company]: stageId,
        })),

      saveStage: (data) =>
        setStages((prev) => upsert(prev, data)),

      removeStage: (id) =>
        setStages((prev) =>
          prev.filter((item) => item.id !== id)
        ),

      saveTopic: (data) =>
        setTopics((prev) => upsert(prev, data)),

      removeTopic: (id) => {
        setTopics((prev) =>
          prev.filter((item) => item.id !== id)
        );

        // Sem o tópico os registros ficariam órfãos.
        setEntries((prev) =>
          prev.filter((item) => item.topicId !== id)
        );
      },

      addEntry: (data) =>
        setEntries((prev) => [
          {
            ...data,
            id: crypto.randomUUID(),
            createdAt: new Date()
              .toISOString()
              .slice(0, 10),
          },
          ...prev,
        ]),

      updateEntry: (id, text) =>
        setEntries((prev) =>
          prev.map((item) =>
            item.id === id ? { ...item, text } : item
          )
        ),

      removeEntry: (id) =>
        setEntries((prev) =>
          prev.filter((item) => item.id !== id)
        ),
    }),
    [stages, topics, entries, placement]
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
