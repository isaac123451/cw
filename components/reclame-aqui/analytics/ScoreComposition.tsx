"use client";

import SurfaceCard from "@/components/shared/SurfaceCard";

import { GoalKey, useGoals } from "@/lib/context/GoalsContext";

import {
  ptBR,
  ReputationSummary,
} from "@/lib/services/reputation.service";

interface Props {
  summary: ReputationSummary;
}

const colors: Record<string, string> = {
  resposta: "#22C55E",
  consumidor: "#0EA5E9",
  solucao: "#22C55E",
  "novos-negocios": "#7C3AED",
};

export default function ScoreComposition({
  summary,
}: Props) {

  const { goals, customized } = useGoals();

  return (
    <SurfaceCard
      title="Composição da nota"
      description={
        customized
          ? "Como cada indicador forma a nota final, comparado às metas definidas pela operação."
          : "Como cada indicador forma a nota final, comparado à meta RA1000."
      }
      action={
        <span className="shrink-0 rounded-full bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-100">
          {customized ? "Meta personalizada" : "Meta RA1000"}
        </span>
      }
    >

      <div className="space-y-5">

        {summary.breakdown.map((metric) => {

          const max = metric.unit === "%" ? 100 : 10;

          const semBase = metric.base === 0;

          const fill = semBase
            ? 0
            : Math.min((metric.value / max) * 100, 100);

          const target =
            goals[metric.key as GoalKey] ?? metric.target;

          const targetAt = (target / max) * 100;

          const delta =
            Math.round(
              (metric.value - target) * 10
            ) / 10;

          const above = delta >= 0;

          return (
            <div key={metric.key}>

              <div className="flex items-baseline justify-between gap-3">

                <span className="flex items-center gap-2 text-sm font-medium text-zinc-700">

                  {metric.label}

                  <span
                    className="text-[11px] font-normal text-zinc-400"
                    title="Peso efetivo no cálculo da nota"
                  >
                    peso{" "}
                    {Math.round(
                      metric.effectiveWeight * 100
                    )}
                    %
                  </span>

                </span>

                <span className="text-sm font-semibold tabular-nums text-zinc-900">
                  {semBase
                    ? "—"
                    : metric.unit === "%"
                    ? `${ptBR(metric.value)}%`
                    : ptBR(metric.value, 2)}
                </span>

              </div>

              <div className="relative mt-2 h-2.5 rounded-full bg-zinc-100">

                <div
                  className="h-full rounded-full transition-[width] duration-500"
                  style={{
                    width: `${fill}%`,
                    background: colors[metric.key],
                  }}
                />

                <span
                  className="absolute -top-0.5 h-3.5 w-0.5 rounded-full bg-orange-500"
                  style={{ left: `${targetAt}%` }}
                  title={`Meta: ${ptBR(target)}${
                    metric.unit === "%" ? "%" : ""
                  }`}
                />

              </div>

              {semBase ? (

                <p className="mt-1.5 text-xs font-medium text-zinc-400">
                  Sem base no período — não entra no cálculo
                </p>

              ) : (

                <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-xs">

                  <span
                    className={`font-medium ${
                      above
                        ? "text-emerald-600"
                        : "text-rose-600"
                    }`}
                  >
                    {above ? "" : "-"}
                    {ptBR(Math.abs(delta))}
                    {metric.unit === "%" ? " p.p." : ""}{" "}
                    {above ? "acima" : "abaixo"} da meta
                  </span>

                  <span className="text-zinc-400">
                    · contribui {ptBR(metric.contribution, 2)}{" "}
                    pts · base {metric.base}
                  </span>

                </p>

              )}

            </div>
          );
        })}

      </div>

      <div className="mt-5 flex items-center justify-between gap-3 border-t border-zinc-100 pt-4">

        <p className="text-xs leading-relaxed text-zinc-400">
          Indicadores sem base são excluídos e seus pesos
          redistribuídos entre os demais.
        </p>

        <p className="shrink-0 text-sm font-semibold tabular-nums text-zinc-900">
          = {ptBR(summary.raScore)}
        </p>

      </div>

    </SurfaceCard>
  );
}
