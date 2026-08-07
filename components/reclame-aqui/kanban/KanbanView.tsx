"use client";

import { useMemo, useState } from "react";

import { useScopedCases } from "@/lib/context/useScopedCases";
import { useWorkflow } from "@/lib/context/WorkflowContext";

import KanbanColumn from "./KanbanColumn";

export default function KanbanView() {
  const { filteredCases, moveCase } =
    useScopedCases("reclame-aqui");

  const { workflow } = useWorkflow();

  /** Caso sendo arrastado no momento (id), para destacar a coluna alvo. */
  const [draggingId, setDraggingId] = useState<
    string | null
  >(null);

  const sortedWorkflow = useMemo(
    () =>
      [...workflow]
        .filter((item) => item.active)
        .sort((a, b) => a.order - b.order),
    [workflow]
  );

  function handleDrop(id: string, status: string) {
    moveCase(id, status);
    setDraggingId(null);
  }

  return (
    <div className="h-full overflow-x-auto overflow-y-hidden pb-1">

      <div className="flex h-full gap-4">

        {sortedWorkflow.map((status) => (

          <KanbanColumn
            key={status.id}
            workflow={status}
            items={filteredCases.filter(
              (item) => item.status === status.name
            )}
            isDragging={draggingId !== null}
            onDragStartCase={setDraggingId}
            onDragEndCase={() => setDraggingId(null)}
            onDropCase={handleDrop}
          />

        ))}

      </div>

    </div>
  );
}
