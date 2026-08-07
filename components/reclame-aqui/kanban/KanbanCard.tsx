"use client";

import Link from "next/link";

import { useState } from "react";

import {
  Clock3,
  GripVertical,
  MapPin,
  Star,
  TriangleAlert,
} from "lucide-react";

import { Case } from "@/lib/models/case";
import { TagChips } from "@/components/shared/TagPicker";

interface Props {
  item: Case;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
}

const priorityTone: Record<string, string> = {
  Crítica: "bg-rose-50 text-rose-700 ring-rose-100",
  Alta: "bg-orange-50 text-orange-700 ring-orange-100",
  Média: "bg-amber-50 text-amber-700 ring-amber-100",
  Baixa: "bg-zinc-100 text-zinc-600 ring-zinc-200",
};

export default function KanbanCard({
  item,
  onDragStart,
  onDragEnd,
}: Props) {

  const [dragging, setDragging] = useState(false);

  return (
    <Link
      href={`/reclame-aqui/${item.id}`}
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData("text/plain", item.id);
        event.dataTransfer.effectAllowed = "move";
        setDragging(true);
        onDragStart(item.id);
      }}
      onDragEnd={() => {
        setDragging(false);
        onDragEnd();
      }}
      className={`group block cursor-grab rounded-xl border border-zinc-200 bg-white p-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-all duration-200 active:cursor-grabbing hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-[0_8px_20px_-8px_rgba(91,42,134,0.35)] ${
        dragging ? "opacity-40" : ""
      }`}
    >

      <div className="flex items-start justify-between gap-2">

        <span className="font-mono text-[10px] uppercase tracking-wide text-zinc-400">
          {item.protocol}
        </span>

        <div className="flex shrink-0 items-center gap-1">

          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${
              priorityTone[item.priority] ??
              "bg-zinc-100 text-zinc-600 ring-zinc-200"
            }`}
          >
            {item.priority}
          </span>

          <GripVertical
            size={13}
            className="text-zinc-300 opacity-0 transition-opacity group-hover:opacity-100"
          />

        </div>

      </div>

      <h3 className="mt-1.5 line-clamp-2 text-sm font-semibold leading-snug text-zinc-900">
        {item.title}
      </h3>

      <p className="mt-1.5 truncate text-xs text-zinc-500">
        {item.company} · {item.customer}
      </p>

      <div className="mt-2 flex items-center gap-3 text-[11px] text-zinc-400">

        <span className="flex items-center gap-1">
          <MapPin size={11} />
          {item.city}/{item.state}
        </span>

        <span className="flex items-center gap-1">
          <Clock3 size={11} />
          {item.sla}
        </span>

        <span className="flex items-center gap-1">
          <Star
            size={11}
            className="fill-amber-400 text-amber-400"
          />
          {item.score ?? "-"}
        </span>

      </div>

      {item.tags && item.tags.length > 0 && (
        <div className="mt-2.5">
          <TagChips tags={item.tags} />
        </div>
      )}

      <div className="mt-3 flex items-center justify-between border-t border-zinc-100 pt-2.5">

        <span className="flex items-center gap-1.5 text-[11px] text-zinc-500">

          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-100 text-[9px] font-semibold text-zinc-600">
            {(item.owner ?? "?").slice(0, 1).toUpperCase()}
          </span>

          {item.owner ?? "Sem responsável"}

        </span>

        {item.churnRisk ? (
          <span className="flex items-center gap-1 text-[10px] font-semibold text-rose-600">
            <TriangleAlert size={11} />
            Churn
          </span>
        ) : (
          <span
            className={`text-[10px] font-semibold ${
              item.resolved
                ? "text-emerald-600"
                : "text-zinc-400"
            }`}
          >
            {item.resolved ? "Resolvido" : "Em aberto"}
          </span>
        )}

      </div>

    </Link>
  );
}
