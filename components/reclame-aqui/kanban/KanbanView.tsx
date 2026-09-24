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
    /*
      As colunas quebram em fileiras em vez de rolar de lado.

      São 7 etapas de 284 px: ~2.000 px de quadro para ~1.000 visíveis num
      notebook, com uma barra embaixo para ir de um lado ao outro — o que o
      Isaac apontou. Agora cada coluna tem no mínimo 250 px e a própria
      altura, com rolagem por dentro; o que não cabe na fileira desce para a
      próxima. Em tela larga, continua uma fileira só.
    */
    <div className="pb-1">

      <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-3">

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
