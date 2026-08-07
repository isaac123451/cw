"use client";

import { useMemo } from "react";

import { useCases } from "@/lib/context/CaseContext";
import { isOpen } from "@/lib/services/case.service";

import SurfaceCard from "@/components/shared/SurfaceCard";

interface OwnerLoad {
  owner: string;
  open: number;
  resolved: number;
  total: number;
}

export default function PerformanceCards() {

  const { cases } = useCases();

  const owners = useMemo<OwnerLoad[]>(() => {

    const map = new Map<string, OwnerLoad>();

    for (const item of cases) {

      const owner = item.owner?.trim() || "Sem responsável";

      const current =
        map.get(owner) ??
        { owner, open: 0, resolved: 0, total: 0 };

      map.set(owner, {
        owner,
        open: current.open + (isOpen(item) ? 1 : 0),
        resolved:
          current.resolved + (item.resolved ? 1 : 0),
        total: current.total + 1,
      });

    }

    return [...map.values()].sort(
      (a, b) => b.total - a.total
    );

  }, [cases]);

  return (
    <SurfaceCard
      title="Carga por responsável"
      description="Distribuição de casos abertos e resolvidos no time."
    >

      <ul className="space-y-3">

        {owners.map((item) => {

          const rate =
            item.total === 0
              ? 0
              : Math.round(
                  (item.resolved / item.total) * 100
                );

          return (
            <li
              key={item.owner}
              className="flex items-center gap-4 rounded-xl border border-zinc-100 px-4 py-3"
            >

              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-50 text-xs font-semibold text-violet-700">
                {item.owner
                  .split(" ")
                  .map((part) => part[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase()}
              </span>

              <div className="min-w-0 flex-1">

                <p className="truncate text-sm font-medium text-zinc-800">
                  {item.owner}
                </p>

                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-zinc-100">
                  <div
                    className="h-full rounded-full bg-emerald-500"
                    style={{ width: `${rate}%` }}
                  />
                </div>

              </div>

              <div className="shrink-0 text-right">

                <p className="text-sm font-semibold tabular-nums text-zinc-900">
                  {item.open}
                </p>

                <p className="text-[11px] text-zinc-400">
                  em aberto
                </p>

              </div>

            </li>
          );
        })}

      </ul>

    </SurfaceCard>
  );
}
