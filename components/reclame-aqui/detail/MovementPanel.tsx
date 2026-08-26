"use client";

import { useState } from "react";

import {
  CornerDownLeft,
  Share2,
  Timer,
  Trash2,
} from "lucide-react";

import { Case } from "@/lib/models/case";

import { useMovements } from "@/lib/context/MovementsContext";

import {
  movementStatus,
  movementsOf,
  openMovementOf,
} from "@/lib/services/movement.service";

import { toneOfSla } from "@/lib/services/sla.service";
import { formatHours } from "@/lib/models/sla";
import { hojeNaOperacao } from "@/lib/services/reputation.service";

import SurfaceCard from "@/components/shared/SurfaceCard";
import {
  inputClass,
  textareaClass,
} from "@/components/shared/Modal";

import MovementForm from "./MovementForm";

function br(date?: string) {
  if (!date) return "—";
  return date.split("-").reverse().join("/");
}

/**
 * Movimentações internas do caso.
 *
 * Uma de cada vez em aberto: encaminhar de novo sem registrar o retorno
 * deixaria dois relógios correndo sobre o mesmo caso, e nenhum diria
 * quem está com a bola.
 */
export default function MovementPanel({
  data,
}: {
  data: Case;
}) {

  const { movements, closeMovement, removeMovement } =
    useMovements();

  const [formOpen, setFormOpen] = useState(false);
  const [outcome, setOutcome] = useState("");
  const [returnedAt, setReturnedAt] =
    useState(hojeNaOperacao());

  const doCaso = movementsOf(data.id, movements);
  const aberta = openMovementOf(data.id, movements);

  const status = aberta
    ? movementStatus(aberta)
    : undefined;

  const historico = doCaso.filter(
    (item) => item.returnedAt
  );

  function registrarRetorno() {
    if (!aberta || outcome.trim() === "") return;

    closeMovement(
      aberta.id,
      outcome.trim(),
      returnedAt
    );

    setOutcome("");
    setReturnedAt(hojeNaOperacao());
  }

  return (
    <>
      <SurfaceCard
        title="Movimentações internas"
        description="Prazo de retorno das áreas e do cliente, contado por movimentação."
        hint="É um relógio separado do prazo público do Reclame Aqui: o caso pode estar no prazo com o consumidor e parado com uma área interna."
        action={
          !aberta && (
            <button
              onClick={() => setFormOpen(true)}
              title="Encaminhar este caso para uma área ou para o cliente"
              className="flex shrink-0 items-center gap-2 rounded-xl border border-violet-200 px-3.5 py-2 text-sm font-medium text-violet-700 transition-colors hover:bg-violet-50"
            >
              <Share2 size={15} />
              Encaminhar
            </button>
          )
        }
      >

        {aberta && status ? (

          <div className="rounded-2xl border border-zinc-200/80 p-4">

            <div className="flex flex-wrap items-start justify-between gap-3">

              <div className="min-w-0">

                <p className="text-sm font-semibold text-zinc-900">
                  Com {aberta.destination}
                </p>

                <p className="mt-1 text-xs text-zinc-500">
                  Encaminhado por {aberta.actor} em{" "}
                  {br(aberta.startedAt)} · prazo de{" "}
                  {formatHours(aberta.dueHours)}
                </p>

              </div>

              <span
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${toneOfSla(status.situation)}`}
                title={status.label}
              >
                <Timer size={12} />
                {status.situation === "estourado"
                  ? `${formatHours(Math.abs(status.remainingHours))} de atraso`
                  : `faltam ${formatHours(status.remainingHours)}`}
              </span>

            </div>

            <p className="mt-3 text-sm leading-relaxed text-zinc-700">
              {aberta.reason}
            </p>

            <div className="mt-4 space-y-3 border-t border-zinc-100 pt-4">

              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                Registrar retorno
              </p>

              <textarea
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
                rows={2}
                placeholder={`O que ${aberta.destination} respondeu?`}
                className={textareaClass}
              />

              <div className="flex flex-wrap items-center gap-2">

                <input
                  type="date"
                  value={returnedAt}
                  onChange={(e) =>
                    setReturnedAt(e.target.value)
                  }
                  title="Data do retorno"
                  className={`${inputClass} w-auto`}
                />

                <button
                  onClick={registrarRetorno}
                  disabled={outcome.trim() === ""}
                  className="flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-800 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400"
                >
                  <CornerDownLeft size={15} />
                  Fechar movimentação
                </button>

                <button
                  onClick={() => removeMovement(aberta.id)}
                  title="Excluir esta movimentação — use quando foi registrada por engano"
                  className="rounded-xl p-2.5 text-zinc-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                >
                  <Trash2 size={15} />
                </button>

              </div>

            </div>

          </div>

        ) : (

          <p className="rounded-xl border border-dashed border-zinc-200 py-8 text-center text-sm text-zinc-400">
            Nenhuma movimentação em aberto.
          </p>

        )}

        {historico.length > 0 && (

          <div className="mt-5 border-t border-zinc-100 pt-4">

            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
              Já retornaram
            </p>

            <ul className="mt-3 space-y-3">

              {historico.map((item) => {

                const status = movementStatus(item);

                return (
                  <li
                    key={item.id}
                    className="flex gap-3 text-sm"
                  >

                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-teal-500" />

                    <span className="min-w-0 flex-1">

                      <span className="block font-medium text-zinc-800">
                        {item.destination}

                        <span className="ml-2 text-[11px] font-normal text-zinc-400">
                          {br(item.startedAt)} →{" "}
                          {br(item.returnedAt)} ·{" "}
                          {formatHours(
                            status.elapsedHours
                          )}
                          {status.remainingHours < 0 &&
                            " · fora do prazo"}
                        </span>

                      </span>

                      <span className="mt-0.5 block text-xs leading-relaxed text-zinc-500">
                        {item.outcome}
                      </span>

                    </span>

                  </li>
                );
              })}

            </ul>

          </div>

        )}

      </SurfaceCard>

      {formOpen && (
        <MovementForm
          caseId={data.id}
          onClose={() => setFormOpen(false)}
        />
      )}
    </>
  );
}
