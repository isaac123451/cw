"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  ReactNode,
} from "react";

import { AgendaTask } from "@/lib/models/agenda";
import { mockAgenda } from "@/lib/data/mockAgenda";

export type TaskDraft = Omit<AgendaTask, "id">;

interface AgendaContextType {
  tasks: AgendaTask[];
  createTask: (data: TaskDraft) => void;
  updateTask: (data: AgendaTask) => void;
  removeTask: (id: string) => void;
  toggleTask: (id: string) => void;
  /** Reagenda ao arrastar entre os dias do quadro. */
  moveTask: (id: string, dueDate: string) => void;
}

const AgendaContext =
  createContext<AgendaContextType | null>(null);

function ordenar(list: AgendaTask[]) {
  return [...list].sort((a, b) => {
    const data = a.dueDate.localeCompare(b.dueDate);
    if (data !== 0) return data;
    return (a.time ?? "").localeCompare(b.time ?? "");
  });
}

export function AgendaProvider({
  children,
}: {
  children: ReactNode;
}) {

  const [tasks, setTasks] = useState<AgendaTask[]>(
    ordenar(mockAgenda)
  );

  const value = useMemo<AgendaContextType>(
    () => ({
      tasks,

      createTask: (data) =>
        setTasks((prev) =>
          ordenar([
            { ...data, id: crypto.randomUUID() },
            ...prev,
          ])
        ),

      updateTask: (data) =>
        setTasks((prev) =>
          ordenar(
            prev.map((item) =>
              item.id === data.id ? data : item
            )
          )
        ),

      removeTask: (id) =>
        setTasks((prev) =>
          prev.filter((item) => item.id !== id)
        ),

      toggleTask: (id) =>
        setTasks((prev) =>
          prev.map((item) =>
            item.id === id
              ? { ...item, done: !item.done }
              : item
          )
        ),

      moveTask: (id, dueDate) =>
        setTasks((prev) =>
          ordenar(
            prev.map((item) =>
              item.id === id
                ? { ...item, dueDate }
                : item
            )
          )
        ),
    }),
    [tasks]
  );

  return (
    <AgendaContext.Provider value={value}>
      {children}
    </AgendaContext.Provider>
  );
}

export function useAgenda() {
  const context = useContext(AgendaContext);

  if (!context) {
    throw new Error(
      "useAgenda deve estar dentro de AgendaProvider."
    );
  }

  return context;
}
