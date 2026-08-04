"use client";

import { useMemo } from "react";

import { useCases } from "@/lib/context/CaseContext";

import { mockWorkflow } from "@/lib/data/mockWorkflow";

import KanbanColumn from "./KanbanColumn";

export default function KanbanView() {
  const { cases } = useCases();

  const workflow = useMemo(
    () =>
      [...mockWorkflow].sort(
        (a, b) => a.order - b.order
      ),
    []
  );

  return (
    <div className="h-[calc(100vh-235px)] overflow-x-auto overflow-y-hidden">

      <div className="flex h-full gap-5">

        {workflow.map((status) => (

          <KanbanColumn
            key={status.id}
            workflow={status}
            items={cases.filter(
              (item) =>
                item.status === status.name
            )}
          />

        ))}

      </div>

    </div>
  );
}