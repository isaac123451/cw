"use client";

import { BadgeAlert, BadgeCheck } from "lucide-react";

import { Case } from "@/lib/models/case";

import { REFERENCE_DATE } from "@/lib/services/reputation.service";

import SurfaceCard from "@/components/shared/SurfaceCard";
import MacroPicker from "@/components/reclame-aqui/detail/MacroPicker";

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
        action={
          <MacroPicker
            data={data}
            onInsert={(text) =>
              onChange({
                // Acrescenta ao que já existe em vez de sobrescrever.
                publicResponse:
                  (data.publicResponse ?? "").trim() === ""
                    ? text
                    : `${data.publicResponse}\n\n${text}`,
              })
            }
          />
        }
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
                // "Não resolvido" é o estado real do portal — "Em
                // Atendimento" não existe no fluxo e deixava o caso sem
                // coluna no Kanban.
                status: next
                  ? "Resolvido"
                  : "Não resolvido",
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
                    // Ao marcar a nota sem data registrada, assume hoje —
                    // pode ser corrigido no campo abaixo.
                    evaluatedAt:
                      data.evaluatedAt ?? REFERENCE_DATE,
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
              Data da avaliação
            </label>

            <input
              type="date"
              value={data.evaluatedAt ?? ""}
              disabled={!data.evaluated}
              onChange={(e) =>
                onChange({
                  evaluatedAt: e.target.value || undefined,
                })
              }
              className={`mt-1.5 h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm outline-none transition-colors focus:border-violet-400 ${
                data.evaluated
                  ? ""
                  : "cursor-not-allowed bg-zinc-50 text-zinc-400"
              }`}
            />

            <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">
              {data.evaluated
                ? "O portal registra apenas o dia da avaliação, sem horário."
                : "Disponível depois que o consumidor avaliar."}
            </p>

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

          {data.evaluated && (

            <div className="mt-5 border-t border-zinc-100 pt-4">

              <button
                onClick={() =>
                  onChange({
                    scoreDisregarded:
                      !data.scoreDisregarded,
                  })
                }
                title="Tira esta avaliação do cálculo da nota, como o Reclame Aqui faz com as que invalida."
                className={`flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-colors ring-1 ring-inset ${data.scoreDisregarded ? "bg-amber-50 text-amber-800 ring-amber-200 hover:bg-amber-100" : "text-zinc-600 ring-zinc-200 hover:bg-zinc-50"}`}
              >

                {data.scoreDisregarded ? (
                  <BadgeAlert size={15} />
                ) : (
                  <BadgeCheck size={15} />
                )}

                {data.scoreDisregarded
                  ? "Nota desconsiderada"
                  : "Desconsiderar nota"}

              </button>

              {data.scoreDisregarded && (
                <p className="mt-2.5 rounded-xl bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-800 ring-1 ring-inset ring-amber-100">
                  Avaliação desconsiderada:{" "}
                  <strong className="font-semibold">
                    fica fora do cálculo da nota
                  </strong>
                  , como o Reclame Aqui faz com as que
                  invalida. O caso continua na lista, com a
                  nota registrada.
                </p>
              )}

            </div>

          )}

          <p className="mt-4 border-t border-zinc-100 pt-3 text-xs leading-relaxed text-zinc-400">
            Notas de 7 a 10 contam como promotor no cálculo da
            reputação.
          </p>

        </SurfaceCard>

      </div>

    </div>
  );
}
