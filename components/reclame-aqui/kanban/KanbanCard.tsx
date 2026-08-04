"use client";

import {
  Building2,
  Clock3,
  MapPin,
  Star,
  User,
  BadgeCheck,
  BadgeX,
} from "lucide-react";

import { Case } from "@/lib/models/case";

interface Props {
  item: Case;
}

export default function KanbanCard({
  item,
}: Props) {
  return (
    <div className="cursor-pointer rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-violet-400 hover:shadow-lg">

      <div className="flex items-start justify-between">

        <div>

          <span className="text-[11px] uppercase tracking-wide text-zinc-400">

            {item.protocol}

          </span>

          <h3 className="mt-1 line-clamp-2 font-semibold">

            {item.title}

          </h3>

        </div>

        <span
          className={`rounded-full px-2 py-1 text-[11px] font-semibold
          ${
            item.priority === "Crítica"
              ? "bg-red-100 text-red-700"
              : item.priority === "Alta"
              ? "bg-orange-100 text-orange-700"
              : item.priority === "Média"
              ? "bg-yellow-100 text-yellow-700"
              : "bg-zinc-100 text-zinc-700"
          }`}
        >
          {item.priority}
        </span>

      </div>

      <div className="mt-4 space-y-2 text-sm">

        <div className="flex items-center gap-2">

          <Building2 size={15} />

          {item.company}

        </div>

        <div className="flex items-center gap-2">

          <User size={15} />

          {item.customer}

        </div>

        <div className="flex items-center gap-2">

          <MapPin size={15} />

          {item.city}/{item.state}

        </div>

      </div>

      <div className="mt-4 flex flex-wrap gap-2">

        {item.tags?.map((tag) => (

          <span
            key={tag}
            className="rounded-full bg-violet-100 px-2 py-1 text-[11px] text-violet-700"
          >

            {tag}

          </span>

        ))}

      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 rounded-xl bg-zinc-50 p-3">

        <div>

          <p className="text-[11px] text-zinc-500">

            Nota

          </p>

          <div className="mt-1 flex items-center gap-1">

            <Star
              size={14}
              className="fill-yellow-400 text-yellow-400"
            />

            <span className="font-medium">

              {item.score ?? "-"}

            </span>

          </div>

        </div>

        <div>

          <p className="text-[11px] text-zinc-500">

            SLA

          </p>

          <div className="mt-1 flex items-center gap-1">

            <Clock3 size={14} />

            <span className="font-medium">

              {item.sla}

            </span>

          </div>

        </div>

      </div>

      <div className="mt-4 flex items-center justify-between border-t pt-4">

        <div className="text-xs">

          <span className="text-zinc-500">

            Responsável

          </span>

          <p className="font-semibold">

            {item.owner}

          </p>

        </div>

        <div className="flex gap-3">

          {item.resolved ? (

            <BadgeCheck
              className="text-green-600"
              size={18}
            />

          ) : (

            <BadgeX
              className="text-red-500"
              size={18}
            />

          )}

          <span
            className={`text-xs font-semibold ${
              item.wouldDoBusiness
                ? "text-green-600"
                : "text-red-600"
            }`}
          >
            {item.wouldDoBusiness
              ? "Voltaria"
              : "Não voltaria"}
          </span>

        </div>

      </div>

    </div>
  );
}