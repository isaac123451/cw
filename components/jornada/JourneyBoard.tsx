"use client";

import { useState } from "react";

import {
  MessagesSquare,
  Star,
  TriangleAlert,
} from "lucide-react";

import { CustomerJourney } from "@/lib/services/journey.service";
import { JourneyStage } from "@/lib/models/journey";

interface Props {
  journeys: CustomerJourney[];
  stages: JourneyStage[];
  placement: Record<string, string>;
  selected: string | null;
  onSelect: (company: string) => void;
  onMove: (company: string, stageId: string) => void;
}

/** Etapa efetiva: ajuste manual tem precedência sobre a sugestão. */
export function stageOf(
  journey: CustomerJourney,
  stages: JourneyStage[],
  placement: Record<string, string>
) {
  const manual = placement[journey.company];

  if (manual) {
    const found = stages.find(
      (item) => item.id === manual
    );

    if (found) return found;
  }

  return (
    stages.find(
      (item) => item.name === journey.suggestedStage
    ) ?? stages[0]
  );
}

export default function JourneyBoard({
  journeys,
  stages,
  placement,
  selected,
  onSelect,
  onMove,
}: Props) {

  const [over, setOver] = useState<string | null>(null);

  const active = stages.filter((item) => item.active);

  return (
    <div className="overflow-x-auto pb-1">

      <div className="flex h-[540px] gap-4">

        {active.map((stage) => {

          const items = journeys.filter(
            (journey) =>
              stageOf(journey, stages, placement)?.id ===
              stage.id
          );

          const isOver = over === stage.id;

          return (
            <div
              key={stage.id}
              onDragOver={(event) => {
                event.preventDefault();
                setOver(stage.id);
              }}
              onDragLeave={() => setOver(null)}
              onDrop={(event) => {
                event.preventDefault();
                setOver(null);

                const company =
                  event.dataTransfer.getData("text/plain");

                if (company) onMove(company, stage.id);
              }}
              className={`flex w-[280px] shrink-0 flex-col rounded-2xl border transition-colors ${
                isOver
                  ? "border-violet-400 bg-violet-50/70"
                  : "border-zinc-200/80 bg-zinc-50/80"
              }`}
            >

              <div
                className="border-b border-zinc-200/80 px-4 py-3"
                title={stage.description}
              >

                <div className="flex items-center justify-between gap-2">

                  <span className="flex min-w-0 items-center gap-2.5">

                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: stage.color }}
                    />

                    <span className="truncate text-sm font-semibold text-zinc-800">
                      {stage.name}
                    </span>

                  </span>

                  <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold tabular-nums text-zinc-600 ring-1 ring-inset ring-zinc-200">
                    {items.length}
                  </span>

                </div>

                <p className="mt-1 truncate text-[11px] text-zinc-400">
                  {stage.description}
                </p>

              </div>

              <div className="flex-1 space-y-2 overflow-y-auto p-2.5">

                {items.length === 0 ? (

                  <p className="rounded-xl border border-dashed border-zinc-200 py-8 text-center text-xs text-zinc-400">
                    {isOver
                      ? "Solte aqui"
                      : "Nenhum cliente"}
                  </p>

                ) : (

                  items.map((journey) => (

                    <button
                      key={journey.company}
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.setData(
                          "text/plain",
                          journey.company
                        );
                        event.dataTransfer.effectAllowed =
                          "move";
                      }}
                      onClick={() =>
                        onSelect(journey.company)
                      }
                      title={`${journey.company} — ${journey.total} caso(s)`}
                      className={`w-full cursor-grab rounded-xl border bg-white p-3 text-left transition-all active:cursor-grabbing hover:-translate-y-0.5 hover:shadow-[0_8px_20px_-8px_rgba(91,42,134,0.3)] ${
                        selected === journey.company
                          ? "border-violet-400 ring-2 ring-violet-100"
                          : "border-zinc-200 hover:border-violet-300"
                      }`}
                    >

                      <div className="flex items-start justify-between gap-2">

                        <p className="min-w-0 truncate text-sm font-semibold text-zinc-900">
                          {journey.company}
                        </p>

                        {journey.churnRisk && (
                          <TriangleAlert
                            size={13}
                            className="shrink-0 text-rose-500"
                          />
                        )}

                      </div>

                      <div className="mt-1.5 flex items-center gap-2.5 text-[11px] text-zinc-500">

                        <span className="flex items-center gap-1">
                          <Star
                            size={10}
                            className="fill-amber-400 text-amber-400"
                          />
                          {journey.averageScore}
                        </span>

                        <span>{journey.total} casos</span>

                        {journey.open > 0 && (
                          <span className="text-amber-600">
                            {journey.open} aberto(s)
                          </span>
                        )}

                      </div>

                      <div className="mt-2 flex items-center gap-1.5">

                        {journey.reclameAqui > 0 && (
                          <span
                            className="rounded-md bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-700"
                            title="Casos do Reclame Aqui"
                          >
                            RA {journey.reclameAqui}
                          </span>
                        )}

                        {journey.social > 0 && (
                          <span
                            className="flex items-center gap-1 rounded-md bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-sky-700"
                            title="Casos de redes sociais"
                          >
                            <MessagesSquare size={9} />
                            {journey.social}
                          </span>
                        )}

                      </div>

                    </button>

                  ))

                )}

              </div>

            </div>
          );
        })}

      </div>

    </div>
  );
}
