"use client";

import Link from "next/link";

import { useState } from "react";

import { Case } from "@/lib/models/case";

interface Column {
  name: string;
  color: string;
}

interface Props {
  cases: Case[];
  columns: Column[];
  /** Move o caso para outro status ao soltar o cartão. */
  onMove: (id: string, status: string) => void;
}

/**
 * Quadro compacto: mesma mecânica de arrastar do Kanban principal,
 * porém em cartões reduzidos para caber junto de outros blocos.
 */
export default function MiniKanban({
  cases,
  columns,
  onMove,
}: Props) {

  const [over, setOver] = useState<string | null>(null);

  return (
    <div className="overflow-x-auto pb-1">

      <div className="flex gap-3">

        {columns.map((column) => {

          const items = cases.filter(
            (item) => item.status === column.name
          );

          const isOver = over === column.name;

          return (
            <div
              key={column.name}
              onDragOver={(event) => {
                event.preventDefault();
                setOver(column.name);
              }}
              onDragLeave={() => setOver(null)}
              onDrop={(event) => {
                event.preventDefault();
                setOver(null);

                const id =
                  event.dataTransfer.getData("text/plain");

                if (id) onMove(id, column.name);
              }}
              className={`flex max-h-[320px] w-[230px] shrink-0 flex-col rounded-xl border transition-colors ${
                isOver
                  ? "border-violet-400 bg-violet-50/70"
                  : "border-zinc-200 bg-zinc-50/70"
              }`}
            >

              <div className="flex items-center justify-between gap-2 border-b border-zinc-200/80 px-3 py-2">

                <span className="flex min-w-0 items-center gap-2">

                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: column.color }}
                  />

                  <span className="truncate text-xs font-semibold text-zinc-700">
                    {column.name}
                  </span>

                </span>

                <span className="shrink-0 rounded-full bg-white px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-zinc-600 ring-1 ring-inset ring-zinc-200">
                  {items.length}
                </span>

              </div>

              <div className="flex-1 space-y-1.5 overflow-y-auto p-2">

                {items.length === 0 ? (

                  <p className="rounded-lg border border-dashed border-zinc-200 py-5 text-center text-[11px] text-zinc-400">
                    {isOver ? "Solte aqui" : "Vazio"}
                  </p>

                ) : (

                  items.map((item) => (

                    <Link
                      key={item.id}
                      href={`/reclame-aqui/${item.id}`}
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.setData(
                          "text/plain",
                          item.id
                        );
                        event.dataTransfer.effectAllowed =
                          "move";
                      }}
                      title={`${item.title} — ${item.company}`}
                      className="block cursor-grab rounded-lg border border-zinc-200 bg-white p-2.5 transition-colors active:cursor-grabbing hover:border-violet-300 hover:bg-violet-50/40"
                    >

                      <p className="line-clamp-2 text-[11px] font-medium leading-snug text-zinc-800">
                        {item.title}
                      </p>

                      <p className="mt-1 truncate text-[10px] text-zinc-500">
                        {item.company} · {item.source}
                      </p>

                    </Link>

                  ))

                )}

              </div>

            </div>
          );
        })}

      </div>

    </div>
  );
}
