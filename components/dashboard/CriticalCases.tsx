"use client";

import Link from "next/link";

import { useMemo } from "react";

import { ArrowUpRight, ShieldAlert } from "lucide-react";

import { useCases } from "@/lib/context/CaseContext";
import { getCriticalCases } from "@/lib/services/case.service";

import SurfaceCard from "@/components/shared/SurfaceCard";

export default function CriticalCases() {

  const { cases } = useCases();

  const critical = useMemo(
    () => getCriticalCases(cases).slice(0, 5),
    [cases]
  );

  return (
    <SurfaceCard
      title="Precisa de atenção"
      description="Casos críticos ou com risco de cancelamento."
      action={
        <Link
          href="/reclame-aqui"
          className="shrink-0 text-sm font-medium text-violet-600 hover:text-violet-700"
        >
          Ver todos
        </Link>
      }
    >

      {critical.length === 0 ? (

        <div className="flex flex-col items-center py-8 text-center">

          <ShieldAlert className="text-emerald-500" size={26} />

          <p className="mt-3 text-sm font-medium text-zinc-700">
            Nenhum caso crítico em aberto.
          </p>

          <p className="mt-1 text-xs text-zinc-500">
            A operação está sob controle.
          </p>

        </div>

      ) : (

        <ul className="space-y-2">

          {critical.map((item) => (

            <li key={item.id}>

              <Link
                href={`/reclame-aqui/${item.id}`}
                className="group flex items-center gap-3 rounded-xl border border-zinc-100 p-3 transition-colors hover:border-violet-200 hover:bg-violet-50/40"
              >

                <span
                  className={`h-9 w-1 shrink-0 rounded-full ${
                    item.priority === "Crítica"
                      ? "bg-rose-500"
                      : "bg-amber-500"
                  }`}
                />

                <div className="min-w-0 flex-1">

                  <p className="truncate text-sm font-medium text-zinc-800">
                    {item.title}
                  </p>

                  <p className="mt-0.5 truncate text-xs text-zinc-500">
                    {item.company} · {item.owner ?? "Sem responsável"} · SLA{" "}
                    {item.sla}
                  </p>

                </div>

                {item.churnRisk && (
                  <span className="shrink-0 rounded-full bg-rose-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-rose-600">
                    Churn
                  </span>
                )}

                <ArrowUpRight
                  size={16}
                  className="shrink-0 text-zinc-300 transition-colors group-hover:text-violet-500"
                />

              </Link>

            </li>

          ))}

        </ul>

      )}

    </SurfaceCard>
  );
}
