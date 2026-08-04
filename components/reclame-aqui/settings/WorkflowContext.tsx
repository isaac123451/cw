"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  ReactNode,
} from "react";

import { WorkflowStatus } from "@/lib/models/workflow";
import { mockWorkflow } from "@/lib/data/mockWorkflow";

interface WorkflowContextType {
  workflow: WorkflowStatus[];

  addStatus: (status: WorkflowStatus) => void;

  updateStatus: (status: WorkflowStatus) => void;

  deleteStatus: (id: string) => void;

  toggleStatus: (id: string) => void;

  reorderWorkflow: (workflow: WorkflowStatus[]) => void;
}

const WorkflowContext =
  createContext<WorkflowContextType | null>(null);

export function WorkflowProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [workflow, setWorkflow] =
    useState<WorkflowStatus[]>(mockWorkflow);

  function addStatus(status: WorkflowStatus) {
    setWorkflow((prev) =>
      [...prev, status].sort(
        (a, b) => a.order - b.order
      )
    );
  }

  function updateStatus(status: WorkflowStatus) {
    setWorkflow((prev) =>
      prev
        .map((item) =>
          item.id === status.id
            ? status
            : item
        )
        .sort(
          (a, b) =>
            a.order - b.order
        )
    );
  }

  function deleteStatus(id: string) {
    setWorkflow((prev) =>
      prev.filter(
        (item) => item.id !== id
      )
    );
  }

  function toggleStatus(id: string) {
    setWorkflow((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              active: !item.active,
            }
          : item
      )
    );
  }

  function reorderWorkflow(
    items: WorkflowStatus[]
  ) {
    setWorkflow(items);
  }

  const value = useMemo(
    () => ({
      workflow,

      addStatus,

      updateStatus,

      deleteStatus,

      toggleStatus,

      reorderWorkflow,
    }),
    [workflow]
  );

  return (
    <WorkflowContext.Provider
      value={value}
    >
      {children}
    </WorkflowContext.Provider>
  );
}

export function useWorkflow() {
  const context =
    useContext(WorkflowContext);

  if (!context) {
    throw new Error(
      "useWorkflow deve estar dentro de WorkflowProvider."
    );
  }

  return context;
}