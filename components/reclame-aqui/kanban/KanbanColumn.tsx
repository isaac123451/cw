"use client";

import { useState } from "react";

import { WorkflowStatus } from "@/lib/models/workflow";
import { Case } from "@/lib/models/case";

import KanbanCard from "./KanbanCard";

interface Props {
  workflow: WorkflowStatus;
  items: Case[];
  isDragging: boolean;
  onDragStartCase: (id: string) => void;
  onDragEndCase: () => void;
  onDropCase: (id: string, status: string) => void;
}

export default function KanbanColumn({
  workflow,
  items,
  isDragging,
  onDragStartCase,
  onDragEndCase,
  onDropCase,
}: Props) {

  const [isOver, setIsOver] = useState(false);

  const overLimit =
    typeof workflow.limit === "number" &&
    items.length > workflow.limit;

  return (
    <div
      onDragOver={(event) => {
        // Sem o preventDefault o navegador recusa o drop.
        event.preventDefault();
        setIsOver(true);
      }}
      onDragLeave={() => setIsOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsOver(false);

        // O id vem do dataTransfer, não de state: o drop precisa
        // funcionar mesmo que o React ainda não tenha re-renderizado.
        const id = event.dataTransfer.getData("text/plain");

        if (id) onDropCase(id, workflow.name);
      }}
      className={`flex h-full w-[300px] shrink-0 flex-col rounded-2xl border transition-colors ${
        isOver
          ? "border-violet-400 bg-violet-50/70"
          : isDragging
          ? "border-dashed border-zinc-300 bg-zinc-50/80"
          : "border-zinc-200/80 bg-zinc-50/80"
      }`}
    >

      <div className="flex items-center justify-between gap-2 border-b border-zinc-200/80 px-4 py-3">

        <div className="flex min-w-0 items-center gap-2.5">

          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ background: workflow.color }}
          />

          <h3 className="truncate text-sm font-semibold text-zinc-800">
            {workflow.name}
          </h3>

        </div>

        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${
            overLimit
              ? "bg-rose-100 text-rose-700"
              : "bg-white text-zinc-600 ring-1 ring-inset ring-zinc-200"
          }`}
        >
          {items.length}
        </span>

      </div>

      <div className="flex-1 overflow-y-auto p-2.5">

        {items.length === 0 ? (

          <p
            className={`rounded-xl border border-dashed py-8 text-center text-xs transition-colors ${
              isOver
                ? "border-violet-300 text-violet-600"
                : "border-zinc-200 text-zinc-400"
            }`}
          >
            {isOver
              ? "Solte aqui"
              : "Nenhum caso nesta etapa"}
          </p>

        ) : (

          <div className="space-y-2.5">

            {items.map((item) => (
              <KanbanCard
                key={item.id}
                item={item}
                onDragStart={onDragStartCase}
                onDragEnd={onDragEndCase}
              />
            ))}

          </div>

        )}

      </div>

    </div>
  );
}
