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
      className={`flex h-[min(480px,calc(100vh-280px))] min-h-[320px] min-w-0 flex-col rounded-xl transition-colors ${
        isOver
          ? "bg-violet-50 ring-2 ring-inset ring-violet-300"
          : isDragging
          ? "bg-zinc-100 ring-1 ring-inset ring-zinc-300"
          : "bg-zinc-200/60 ring-1 ring-inset ring-zinc-200/70"
      }`}
    >

      <div className="flex items-center justify-between gap-2 px-3 pb-2 pt-2.5">

        <div className="flex min-w-0 items-center gap-2.5">

          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ background: workflow.color }}
          />

          <h3 className="truncate text-[13px] font-semibold text-zinc-700">
            {workflow.name}
          </h3>

        </div>

        <span
          title={overLimit ? `Acima do limite de ${workflow.limit} desta etapa` : undefined}
          className={`shrink-0 rounded px-1.5 text-[11px] font-medium leading-5 tabular-nums ${
            overLimit ? "bg-rose-100 text-rose-700" : "text-zinc-500"
          }`}
        >
          {items.length}
        </span>

      </div>

      <div className="rolagem-fina flex-1 overflow-y-auto px-2 pb-2">

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

          <div className="space-y-2">

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
