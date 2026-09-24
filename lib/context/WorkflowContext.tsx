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
import {
  sincronizar,
  type Gravacao,
} from "@/lib/context/sync";

interface WorkflowContextProps {
  workflow: WorkflowStatus[];

  /** Carga inicial ainda em andamento. */
  loading: boolean;

  addStatus: (item: WorkflowStatus) => Promise<Gravacao>;
  /** Devolve o resultado: a tela de etapas grava por botão. */
  updateStatus: (item: WorkflowStatus) => Promise<Gravacao>;
  deleteStatus: (id: string) => void;
  toggleStatus: (id: string) => void;

  /**
   * Criar e renomear do seletor de situação da reclamação: a etapa só
   * aparece (ou muda de nome) depois de o servidor gravar. Renomear leva
   * as reclamações da etapa junto — ver `saveWorkflowStatus`.
   */
  criarEtapa: (nome: string) => Promise<boolean>;
  renomearEtapa: (id: string, nome: string) => Promise<boolean>;
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
    return sincronizar(() => saveWorkflowStatus(item));
  }

  function updateStatus(item: WorkflowStatus) {
    setWorkflow((current) =>
      current.map((status) =>
        status.id === item.id ? item : status
      )
    );
    return sincronizar(() => saveWorkflowStatus(item));
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

  async function criarEtapa(nome: string) {
    const nova: WorkflowStatus = {
      id: crypto.randomUUID(),
      name: nome,
      color: "#7C3AED",
      order: Math.max(0, ...workflow.map((s) => s.order)) + 1,
      active: true,
    };
    const r = await sincronizar(() => saveWorkflowStatus(nova));
    if (r.ok) setWorkflow((current) => [...current, nova]);
    return r.ok;
  }

  async function renomearEtapa(id: string, nome: string) {
    const atual = workflow.find((s) => s.id === id);
    if (!atual) return false;
    const r = await sincronizar(() => saveWorkflowStatus({ ...atual, name: nome }));
    if (r.ok) setWorkflow((current) => current.map((s) => (s.id === id ? { ...s, name: nome } : s)));
    return r.ok;
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
        criarEtapa,
        renomearEtapa,
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
