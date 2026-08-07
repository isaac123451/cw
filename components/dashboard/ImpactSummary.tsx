"use client";

import Link from "next/link";

import { useMemo } from "react";

import { ArrowRight } from "lucide-react";

import SurfaceCard from "@/components/shared/SurfaceCard";

import { useImpact } from "@/lib/context/ImpactContext";

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

const typeTone: Record<string, string> = {
  "Cancelamento evitado": "text-emerald-600",
  "Cliente recuperado": "text-violet-600",
  "Módulo contratado": "text-sky-600",
  "Valor recuperado": "text-amber-600",
  "Oferta concedida": "text-rose-600",
};

export default function ImpactSummary() {

  const { records } = useImpact();

  const { entradas, custos, liquido, recentes } =
    useMemo(() => {

      const entradas = records
        .filter((item) => item.amount > 0)
        .reduce((sum, item) => sum + item.amount, 0);

      const custos = records
        .filter((item) => item.amount < 0)
        .reduce((sum, item) => sum + item.amount, 0);

      return {
        entradas,
        custos,
        liquido: entradas + custos,
        recentes: records.slice(0, 4),
      };

    }, [records]);

  return (
    <SurfaceCard
      title="Impacto no negócio"
      description="Resultado financeiro gerado pela operação."
      action={
        <Link
          href="/impacto"
          className="flex shrink-0 items-center gap-1.5 text-sm font-medium text-violet-700 transition-colors hover:text-violet-900"
        >
          Ver tudo
          <ArrowRight size={14} />
        </Link>
      }
    >

      <div className="grid grid-cols-3 gap-3">

        {[
          {
            label: "Entradas",
            value: entradas,
            tone: "text-emerald-700",
            bg: "bg-emerald-50/60 ring-emerald-100",
          },
          {
            label: "Ofertas",
            value: custos,
            tone: "text-rose-700",
            bg: "bg-rose-50/60 ring-rose-100",
          },
          {
            label: "Líquido",
            value: liquido,
            tone: "text-violet-700",
            bg: "bg-violet-50/60 ring-violet-100",
          },
        ].map((item) => (

          <div
            key={item.label}
            className={`rounded-xl p-3.5 ring-1 ring-inset ${item.bg}`}
          >

            <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              {item.label}
            </p>

            <p
              className={`mt-1 text-base font-semibold tabular-nums ${item.tone}`}
            >
              {money.format(item.value)}
            </p>

          </div>

        ))}

      </div>

      {recentes.length > 0 && (

        <ul className="mt-4 space-y-2 border-t border-zinc-100 pt-4">

          {recentes.map((item) => (

            <li
              key={item.id}
              className="flex items-center gap-3 text-sm"
            >

              <span className="min-w-0 flex-1">

                <span className="block truncate font-medium text-zinc-700">
                  {item.company}
                </span>

                <span
                  className={`text-[11px] ${
                    typeTone[item.type] ?? "text-zinc-500"
                  }`}
                >
                  {item.type}
                </span>

              </span>

              <span
                className={`shrink-0 text-sm font-semibold tabular-nums ${
                  item.amount < 0
                    ? "text-rose-600"
                    : "text-emerald-600"
                }`}
              >
                {money.format(item.amount)}
              </span>

            </li>

          ))}

        </ul>

      )}

    </SurfaceCard>
  );
}
