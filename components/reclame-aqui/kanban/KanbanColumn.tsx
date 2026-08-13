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

/**
 * Cards montados de uma vez por coluna.
 *
 * Com a base real (327 casos) o quadro chegava a 11 mil nós no DOM e
 * cada tecla digitada na busca custava ~120 ms, porque todo card
 * re-renderizava. Vinte e cinco cobre a rolagem inicial de qualquer
 * coluna; o resto entra sob demanda.
 */
const LOTE = 25;

export default function KanbanColumn({
  workflow,
  items,
  isDragging,
  onDragStartCase,
  onDragEndCase,
  onDropCase,
}: Props) {

  const [isOver, setIsOver] = useState(false);
  const [visiveis, setVisiveis] = useState(LOTE);

  const overLimit =
    typeof workflow.limit === "number" &&
    items.length > workflow.limit;

  const mostrados = items.slice(0, visiveis);

  const restantes = items.length - mostrados.length;

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

            {mostrados.map((item) => (
              <KanbanCard
                key={item.id}
                item={item}
                onDragStart={onDragStartCase}
                onDragEnd={onDragEndCase}
              />
            ))}

            {restantes > 0 && (
              <button
                onClick={() =>
                  setVisiveis((valor) => valor + LOTE)
                }
                className="w-full rounded-xl border border-dashed border-zinc-300 py-2.5 text-xs font-medium text-zinc-500 transition-colors hover:border-violet-300 hover:bg-white hover:text-violet-700"
              >
                Mostrar mais {Math.min(restantes, LOTE)} de{" "}
                {restantes}
              </button>
            )}

          </div>

        )}

      </div>

    </div>
  );
}
