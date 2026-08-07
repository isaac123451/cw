"use client";

import { useState } from "react";

import { RotateCcw, Target } from "lucide-react";

import SurfaceCard from "@/components/shared/SurfaceCard";

import {
  GoalKey,
  useGoals,
} from "@/lib/context/GoalsContext";

import { ptBR } from "@/lib/services/reputation.service";

const fields: {
  key: GoalKey;
  label: string;
  unit: "%" | "nota";
  max: number;
  step: number;
}[] = [
  {
    key: "resposta",
    label: "Índice de resposta",
    unit: "%",
    max: 100,
    step: 1,
  },
  {
    key: "consumidor",
    label: "Nota do consumidor",
    unit: "nota",
    max: 10,
    step: 0.1,
  },
  {
    key: "solucao",
    label: "Índice de solução",
    unit: "%",
    max: 100,
    step: 1,
  },
  {
    key: "novos-negocios",
    label: "Voltaria a fazer negócio",
    unit: "%",
    max: 100,
    step: 1,
  },
];

export default function GoalEditor() {

  const { goals, setGoal, resetGoals, customized } =
    useGoals();

  const [open, setOpen] = useState(false);

  return (
    <SurfaceCard
      title="Metas da operação"
      description={
        customized
          ? "Metas ajustadas manualmente pela operação."
          : "Usando os critérios públicos do selo RA1000."
      }
      action={
        <div className="flex shrink-0 items-center gap-2">

          {customized && (
            <button
              onClick={resetGoals}
              title="Voltar aos critérios do RA1000"
              className="flex items-center gap-1.5 rounded-xl border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50"
            >
              <RotateCcw size={14} />
              Restaurar
            </button>
          )}

          <button
            onClick={() => setOpen((value) => !value)}
            className="flex items-center gap-2 rounded-xl border border-violet-200 px-3.5 py-2 text-sm font-medium text-violet-700 transition-colors hover:bg-violet-50"
          >
            <Target size={15} />
            {open ? "Fechar" : "Definir metas"}
          </button>

        </div>
      }
    >

      {open ? (

        <div className="grid gap-4 sm:grid-cols-2">

          {fields.map((field) => (

            <div key={field.key}>

              <label className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-zinc-400">

                {field.label}

                <span className="tabular-nums text-violet-700">
                  {ptBR(goals[field.key])}
                  {field.unit === "%" ? "%" : ""}
                </span>

              </label>

              <input
                type="range"
                min={0}
                max={field.max}
                step={field.step}
                value={goals[field.key]}
                onChange={(e) =>
                  setGoal(
                    field.key,
                    Number(e.target.value)
                  )
                }
                className="mt-2 w-full accent-violet-700"
              />

              <input
                type="number"
                min={0}
                max={field.max}
                step={field.step}
                value={goals[field.key]}
                onChange={(e) =>
                  setGoal(
                    field.key,
                    Number(e.target.value)
                  )
                }
                className="mt-1.5 h-10 w-full rounded-xl border border-zinc-200 px-3 text-sm tabular-nums outline-none transition-colors focus:border-violet-400"
              />

            </div>

          ))}

        </div>

      ) : (

        <div className="grid gap-3 sm:grid-cols-4">

          {fields.map((field) => (

            <div
              key={field.key}
              className="rounded-xl bg-zinc-50 px-3.5 py-3"
            >

              <p className="text-[11px] uppercase tracking-wide text-zinc-400">
                {field.label}
              </p>

              <p className="mt-1 text-lg font-semibold tabular-nums text-zinc-900">
                {ptBR(goals[field.key])}
                {field.unit === "%" ? "%" : ""}
              </p>

            </div>

          ))}

        </div>

      )}

    </SurfaceCard>
  );
}
