"use client";

import { useState } from "react";

import {
  Star,
  TriangleAlert,
} from "lucide-react";

import type { JornadaNasFrentes } from "@/lib/services/journey.service";
import LinhasCarregando from "@/components/shared/LinhasCarregando";
import { FRENTES_DA_OPERACAO } from "@/lib/models/frentes";
import IconeDaFrente from "@/components/shared/IconeDaFrente";
import { JourneyStage } from "@/lib/models/journey";
import { mostrarMais, pluralDe } from "@/lib/plural";

/**
 * Quantos cartões cada coluna desenha de saída.
 *
 * A base tem mil clientes, e "Primeiro contato" sozinho passava de 800:
 * a tela desenhava todos, quase 15 mil elementos, e travava ao arrastar
 * (out/2026). O contador da coluna continua dizendo o total.
 */
const LOTE = 30;
import { ptBR } from "@/lib/services/reputation.service";

interface Props {
  journeys: JornadaNasFrentes[];
  stages: JourneyStage[];
  placement: Record<string, string>;
  selected: string | null;
  onSelect: (company: string) => void;
  onMove: (company: string, stageId: string) => void;
  /** A base ainda chegando: a coluna vazia não diz "Nenhum cliente" (out/2026). */
  carregando?: boolean;
}

/** Etapa efetiva: ajuste manual tem precedência sobre a sugestão. */
export function stageOf(
  journey: JornadaNasFrentes,
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
  carregando = false,
}: Props) {

  const [over, setOver] = useState<string | null>(null);
  const [limite, setLimite] = useState<Record<string, number>>({});

  const active = stages.filter((item) => item.active);

  /* Uma passada só: antes cada coluna percorria a base inteira. */
  const porEtapa = new Map<string, JornadaNasFrentes[]>();
  for (const journey of journeys) {
    const id = stageOf(journey, stages, placement)?.id;
    if (!id) continue;
    const lista = porEtapa.get(id);
    if (lista) lista.push(journey);
    else porEtapa.set(id, [journey]);
  }

  return (
    /* Etapas em fileiras, como o quadro do Reclame Aqui: nada de rolar de lado. */
    <div className="pb-1">

      <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">

        {active.map((stage) => {

          const items = porEtapa.get(stage.id) ?? [];
          const quantos = limite[stage.id] ?? LOTE;
          const visiveis = items.slice(0, quantos);

          /* O cliente aberto ao lado fica à vista, mesmo além do lote. */
          const escolhido = selected ? items.find((j) => j.company === selected) : undefined;
          if (escolhido && !visiveis.includes(escolhido)) visiveis.push(escolhido);

          const restantes = items.length - quantos;

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
              className={`flex h-[540px] min-w-0 flex-col rounded-2xl border transition-colors ${
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

                {items.length === 0 && carregando ? (

                  <LinhasCarregando linhas={2} className="p-1" />

                ) : items.length === 0 ? (

                  <p className="rounded-xl border border-dashed border-zinc-200 py-8 text-center text-xs text-zinc-400">
                    {isOver
                      ? "Solte aqui"
                      : "Nenhum cliente"}
                  </p>

                ) : (

                  visiveis.map((journey) => (

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
                      title={`${journey.company} — ${journey.total} ${pluralDe(journey.total, "registro", "registros")} nas frentes`}
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

                        {journey.temNota && (
                          <span className="flex items-center gap-1">
                            <Star
                              size={10}
                              className="fill-amber-400 text-amber-400"
                            />
                            {ptBR(journey.averageScore)}
                          </span>
                        )}

                        <span>{journey.total} {pluralDe(journey.total, "registro", "registros")}</span>

                        {journey.open > 0 && (
                          <span className="text-amber-600">
                            {journey.open} {pluralDe(journey.open, "aberto", "abertos")}
                          </span>
                        )}

                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {FRENTES_DA_OPERACAO.filter((f) => journey.porFrente[f.id] > 0).map((f) => (
                          <span
                            key={f.id}
                            className="flex items-center gap-1 rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-700"
                            title={`${journey.porFrente[f.id]} em ${f.nome}`}
                          >
                            <IconeDaFrente frente={f.id} size={9} />
                            {journey.porFrente[f.id]}
                          </span>
                        ))}
                      </div>

                    </button>

                  ))

                )}

                {restantes > 0 && (
                  <button
                    type="button"
                    onClick={() => setLimite((atual) => ({ ...atual, [stage.id]: quantos + LOTE }))}
                    className="w-full rounded-xl border border-dashed border-zinc-300 py-2 text-xs font-medium text-zinc-600 hover:border-violet-300 hover:text-violet-700"
                  >
                    {mostrarMais(LOTE, restantes)}
                  </button>
                )}

              </div>

            </div>
          );
        })}

      </div>

    </div>
  );
}
