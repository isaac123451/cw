"use client";

import { Case } from "@/lib/models/case";

import SurfaceCard from "@/components/shared/SurfaceCard";

interface Props {
  data: Case;
  onChange: (patch: Partial<Case>) => void;
}

const scores = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

function Choice({
  value,
  onSelect,
}: {
  value: boolean;
  onSelect: (next: boolean) => void;
}) {
  return (
    <div className="mt-1.5 grid grid-cols-2 gap-2">

      {[
        { label: "Sim", next: true },
        { label: "Não", next: false },
      ].map((option) => (

        <button
          key={option.label}
          onClick={() => onSelect(option.next)}
          className={`h-11 rounded-xl text-sm font-medium transition-colors ring-1 ring-inset ${
            value === option.next
              ? "bg-violet-50 text-violet-700 ring-violet-300"
              : "text-zinc-600 ring-zinc-200 hover:bg-zinc-50"
          }`}
        >
          {option.label}
        </button>

      ))}

    </div>
  );
}

export default function EvaluationTab({
  data,
  onChange,
}: Props) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">

      <SurfaceCard
        title="Resposta pública"
        description="Texto publicado no Reclame Aqui para esta reclamação."
      >

        <textarea
          value={data.publicResponse ?? ""}
          onChange={(e) =>
            onChange({ publicResponse: e.target.value })
          }
          rows={7}
          placeholder="Registre aqui a resposta oficial publicada no portal."
          className="w-full resize-y rounded-xl border border-zinc-200 p-3 text-sm leading-relaxed outline-none transition-colors placeholder:text-zinc-400 focus:border-violet-400"
        />

        <p className="mt-3 text-xs leading-relaxed text-zinc-400">
          {(data.publicResponse ?? "").trim() === ""
            ? "Sem resposta pública — este é o fator de maior peso no índice de resposta."
            : `Respondida em ${data.updatedAt ?? data.createdAt}.`}
        </p>

      </SurfaceCard>

      <div className="space-y-5">

        <SurfaceCard title="Resolução">

          <label className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
            Situação resolvida?
          </label>

          <Choice
            value={data.resolved}
            onSelect={(next) =>
              onChange({
                resolved: next,
                status: next ? "Resolvido" : "Em Atendimento",
                sla: next ? "Concluído" : data.sla,
              })
            }
          />

        </SurfaceCard>

        <SurfaceCard title="Avaliação do cliente">

          <label className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
            Nota da avaliação
          </label>

          <div className="mt-1.5 flex flex-wrap gap-1.5">

            <button
              onClick={() =>
                onChange({
                  evaluated: false,
                  score: undefined,
                })
              }
              className={`h-10 w-10 rounded-xl text-sm font-medium transition-colors ring-1 ring-inset ${
                !data.evaluated
                  ? "bg-violet-50 text-violet-700 ring-violet-300"
                  : "text-zinc-600 ring-zinc-200 hover:bg-zinc-50"
              }`}
            >
              –
            </button>

            {scores.map((score) => (

              <button
                key={score}
                onClick={() =>
                  onChange({
                    evaluated: true,
                    score,
                    wouldDoBusiness: score >= 7,
                  })
                }
                className={`h-10 w-10 rounded-xl text-sm font-medium tabular-nums transition-colors ring-1 ring-inset ${
                  data.evaluated && data.score === score
                    ? "bg-violet-50 text-violet-700 ring-violet-300"
                    : "text-zinc-600 ring-zinc-200 hover:bg-zinc-50"
                }`}
              >
                {score}
              </button>

            ))}

          </div>

          <div className="mt-5">

            <label className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
              Voltaria a fazer negócio?
            </label>

            <Choice
              value={data.wouldDoBusiness}
              onSelect={(next) =>
                onChange({ wouldDoBusiness: next })
              }
            />

          </div>

          <p className="mt-4 border-t border-zinc-100 pt-3 text-xs leading-relaxed text-zinc-400">
            Notas de 7 a 10 contam como promotor no cálculo da
            reputação.
          </p>

        </SurfaceCard>

      </div>

    </div>
  );
}
