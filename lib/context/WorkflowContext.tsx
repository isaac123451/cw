"use client";

import {
  createContext,
  useContext,
  ReactNode,
} from "react";

import { WorkflowStatus } from "@/lib/models/workflow";

import {
  removeWorkflowStatus,
  saveWorkflowStatus,
} from "@/lib/actions/registry";

import { useWorkspaceSlice } from "@/lib/context/useWorkspace";
import { sincronizar } from "@/lib/context/sync";

interface WorkflowContextProps {
  workflow: WorkflowStatus[];

  /** Carga inicial ainda em andamento. */
  loading: boolean;

  addStatus: (item: WorkflowStatus) => void;
  updateStatus: (item: WorkflowStatus) => void;
  deleteStatus: (id: string) => void;
  toggleStatus: (id: string) => void;
}

const WorkflowContext = createContext<
  WorkflowContextProps | undefined
>(undefined);

/**
 * Etapas do quadro.
 *
 * A lista vem do banco pela carga compartilhada; cada alteração é
 * aplicada na tela na hora e gravada em seguida, para o arrastar e o
 * editar continuarem instantâneos.
 */
export function WorkflowProvider({
  children,
}: {
  children: ReactNode;
}) {

  const [workflow, setWorkflow, loading] =
    useWorkspaceSlice(
      (dados) => dados.workflow,
      [] as WorkflowStatus[]
    );

  function addStatus(item: WorkflowStatus) {
    setWorkflow((current) => [...current, item]);
    sincronizar(() => saveWorkflowStatus(item));
  }

  function updateStatus(item: WorkflowStatus) {
    setWorkflow((current) =>
      current.map((status) =>
        status.id === item.id ? item : status
      )
    );
    sincronizar(() => saveWorkflowStatus(item));
  }

  function deleteStatus(id: string) {
    setWorkflow((current) =>
      current.filter((item) => item.id !== id)
    );
    sincronizar(() => removeWorkflowStatus(id));
  }

  function toggleStatus(id: string) {

    const atual = workflow.find(
      (item) => item.id === id
    );

    if (!atual) return;

    const alterado = {
      ...atual,
      active: !atual.active,
    };

    setWorkflow((current) =>
      current.map((item) =>
        item.id === id ? alterado : item
      )
    );

    sincronizar(() => saveWorkflowStatus(alterado));
  }

  return (
    <WorkflowContext.Provider
      value={{
        workflow,
        loading,
        addStatus,
        updateStatus,
        deleteStatus,
        toggleStatus,
      }}
    >
      {children}
    </WorkflowContext.Provider>
  );
}

export function useWorkflow() {

  const context = useContext(WorkflowContext);

  if (!context) {
    throw new Error(
      "useWorkflow deve estar dentro de WorkflowProvider."
    );
  }

  return context;
}
