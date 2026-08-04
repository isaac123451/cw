"use client";

import {
  MoreVertical,
  Plus,
} from "lucide-react";

import { WorkflowStatus } from "@/lib/models/workflow";
import { Case } from "@/lib/models/case";

import KanbanCard from "./KanbanCard";

interface Props {
  workflow: WorkflowStatus;
  items: Case[];
}

export default function KanbanColumn({
  workflow,
  items,
}: Props) {
  return (
    <div
      className="
        flex
        h-full
        w-[320px]
        shrink-0
        flex-col
        rounded-2xl
        border
        border-zinc-200
        bg-zinc-100
      "
    >

      <div className="rounded-t-2xl border-b border-zinc-200 bg-white p-4">

        <div className="flex items-center justify-between">

          <div className="flex items-center gap-3">

            <div
              className="h-3 w-3 rounded-full"
              style={{
                background: workflow.color,
              }}
            />

            <h3 className="font-semibold">
              {workflow.name}
            </h3>

            <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs">

              {items.length}

            </span>

          </div>

          <div className="flex items-center gap-1">

            <button className="rounded-lg p-2 hover:bg-zinc-100">

              <Plus size={16} />

            </button>

            <button className="rounded-lg p-2 hover:bg-zinc-100">

              <MoreVertical size={16} />

            </button>

          </div>

        </div>

      </div>

      <div className="flex-1 overflow-y-auto p-3">

        <div className="space-y-3">

          {items.map((item) => (

            <KanbanCard
              key={item.id}
              item={item}
            />

          ))}

        </div>

      </div>

    </div>
  );
}