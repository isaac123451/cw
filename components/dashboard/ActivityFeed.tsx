"use client";

import Link from "next/link";

import { useMemo } from "react";

import { useCases } from "@/lib/context/CaseContext";
import { getRecentCases } from "@/lib/services/case.service";

import SurfaceCard from "@/components/shared/SurfaceCard";

const statusTone: Record<string, string> = {
  Novo: "bg-indigo-500",
  "Em Atendimento": "bg-amber-500",
  "Aguardando Cliente": "bg-sky-500",
  Resolvido: "bg-emerald-500",
  Fechado: "bg-zinc-400",
};

export default function ActivityFeed() {

  const { cases } = useCases();

  const recent = useMemo(
    () => getRecentCases(cases, 6),
    [cases]
  );

  return (
    <SurfaceCard
      title="Atividade recente"
      description="Últimos casos registrados na operação."
    >

      <ol className="relative space-y-5 before:absolute before:left-[5px] before:top-2 before:h-[calc(100%-1rem)] before:w-px before:bg-zinc-200 before:content-['']">

        {recent.map((item) => (

          <li key={item.id} className="relative pl-6">

            <span
              className={`absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-white ${
                statusTone[item.status] ?? "bg-zinc-400"
              }`}
            />

            <Link
              href={`/reclame-aqui/${item.id}`}
              className="block hover:underline"
            >
              <p className="text-sm font-medium text-zinc-800">
                {item.title}
              </p>
            </Link>

            <p className="mt-0.5 text-xs text-zinc-500">
              {item.company} · {item.status} ·{" "}
              {item.lastInteraction ?? item.createdAt}
            </p>

          </li>

        ))}

      </ol>

    </SurfaceCard>
  );
}
