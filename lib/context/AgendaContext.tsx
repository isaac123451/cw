"use client";

import {
  createContext,
  useContext,
  useMemo,
  ReactNode,
} from "react";

import { AgendaTask } from "@/lib/models/agenda";

import {
  removeAgendaTask,
  saveAgendaTask,
} from "@/lib/actions/registry";

import { useWorkspaceSlice } from "@/lib/context/useWorkspace";
import { sincronizar } from "@/lib/context/sync";

export type TaskDraft = Omit<AgendaTask, "id">;

interface AgendaContextType {
  tasks: AgendaTask[];

  /** Carga inicial ainda em andamento. */
  loading: boolean;

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

  const [tasks, setTasks, loading] = useWorkspaceSlice(
    (dados) => ordenar(dados.agenda),
    [] as AgendaTask[]
  );

  const value = useMemo<AgendaContextType>(
    () => ({
      tasks,
      loading,

      createTask: (data) => {

        const nova: AgendaTask = {
          ...data,
          id: crypto.randomUUID(),
        };

        setTasks((prev) => ordenar([nova, ...prev]));
        sincronizar(() => saveAgendaTask(nova));
      },

      updateTask: (data) => {
        setTasks((prev) =>
          ordenar(
            prev.map((item) =>
              item.id === data.id ? data : item
            )
          )
        );
        sincronizar(() => saveAgendaTask(data));
      },

      removeTask: (id) => {
        setTasks((prev) =>
          prev.filter((item) => item.id !== id)
        );
        sincronizar(() => removeAgendaTask(id));
      },

      toggleTask: (id) => {

        const atual = tasks.find(
          (item) => item.id === id
        );

        if (!atual) return;

        const alterada = { ...atual, done: !atual.done };

        setTasks((prev) =>
          prev.map((item) =>
            item.id === id ? alterada : item
          )
        );

        sincronizar(() => saveAgendaTask(alterada));
      },

      moveTask: (id, dueDate) => {

        const atual = tasks.find(
          (item) => item.id === id
        );

        if (!atual) return;

        const movida = { ...atual, dueDate };

        setTasks((prev) =>
          ordenar(
            prev.map((item) =>
              item.id === id ? movida : item
            )
          )
        );

        sincronizar(() => saveAgendaTask(movida));
      },
    }),
    [tasks, loading, setTasks]
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
