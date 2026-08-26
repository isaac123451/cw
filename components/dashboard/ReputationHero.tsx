"use client";

import Link from "next/link";

import { useMemo } from "react";

import {
  ArrowRight,
  Check,
  Timer,
  X,
} from "lucide-react";

import { useScopedCases } from "@/lib/context/useScopedCases";
import { useGoals } from "@/lib/context/GoalsContext";

import {
  displayBand,
  formatElapsed,
  formatRange,
  getRange,
  getReputation,
  hasRA1000,
  inRange,
  ptBR,
  textoSobre,
} from "@/lib/services/reputation.service";

/**
 * Bloco principal do Dashboard: a nota pública e o que a sustenta.
 * É o número que a liderança cobra, então abre a tela.
 */
export default function ReputationHero() {

  const { cases } = useScopedCases("reclame-aqui");
  const { goals } = useGoals();

  const range = useMemo(() => getRange("6m"), []);

  const previousRange = useMemo(
    () => ({
      start: range.previousStart,
      end: range.previousEnd,
    }),
    [range]
  );

  const atual = useMemo(
    () =>
      getReputation(
        cases.filter((item) =>
          inRange(item, range.start, range.end)
        )
      ),
    [cases, range]
  );

  const anterior = useMemo(
    () =>
      getReputation(
        cases.filter((item) =>
          inRange(
            item,
            previousRange.start,
            previousRange.end
          )
        )
      ),
    [cases, previousRange]
  );

  const band = displayBand(atual);
  const selo = hasRA1000(atual);

  const delta =
    anterior.received === 0
      ? null
      : Math.round(
          (atual.raScore - anterior.raScore) * 10
        ) / 10;

  const indicadores = [
    {
      label: "Índice de resposta",
      value: atual.responseIndex,
      meta: goals.resposta,
      unit: "%",
    },
    {
      label: "Nota do consumidor",
      value: atual.consumerScore,
      meta: goals.consumidor,
      unit: "",
    },
    {
      label: "Índice de solução",
      value: atual.solutionIndex,
      meta: goals.solucao,
      unit: "%",
    },
    {
      label: "Voltaria a fazer negócio",
      value: atual.wouldReturnIndex,
      meta: goals["novos-negocios"],
      unit: "%",
    },
  ];

  return (
    <section className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">

      <div className="grid lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">

        {/* Nota */}

        <div
          className="relative flex flex-col justify-between p-6"
          style={{
            background: `linear-gradient(160deg, ${band.color}14, transparent 70%)`,
          }}
        >

          <div className="flex items-start justify-between gap-3">

            <div>

              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
                Reputação no Reclame Aqui
              </p>

              <p className="mt-1 text-xs text-zinc-500">
                {formatRange(range.start, range.end)}
              </p>

            </div>

            <span
              className="shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold"
              style={{
                background: band.color,
                color: textoSobre(band.color),
              }}
              title={
                selo
                  ? "Todos os critérios do selo atingidos"
                  : "Faixa correspondente à nota"
              }
            >
              {band.label}
            </span>

          </div>

          <div className="mt-6">

            <p className="text-6xl font-semibold tracking-tight tabular-nums text-zinc-900">
              {ptBR(atual.raScore)}
              <span className="ml-1.5 text-2xl font-normal text-zinc-300">
                /10
              </span>
            </p>

            {delta === null ? (
              <p className="mt-2 text-xs text-zinc-400">
                Sem base no período anterior
              </p>
            ) : (
              <p
                className={`mt-2 text-sm font-semibold ${
                  delta >= 0
                    ? "text-emerald-600"
                    : "text-rose-600"
                }`}
              >
                {delta >= 0 ? "+" : "−"}
                {ptBR(Math.abs(delta))} vs período anterior
              </p>
            )}

          </div>

          <Link
            href="/reclame-aqui/analytics"
            className="mt-6 flex items-center gap-1.5 text-sm font-medium text-violet-700 transition-colors hover:text-violet-900"
          >
            Ver detalhamento
            <ArrowRight size={15} />
          </Link>

        </div>

        {/* Composição */}

        <div className="border-t border-zinc-100 p-6 lg:border-l lg:border-t-0">

          <div className="flex flex-wrap items-center justify-between gap-3">

            <p className="text-sm font-semibold text-zinc-800">
              O que sustenta a nota
            </p>

            <span className="flex items-center gap-1.5 rounded-lg bg-zinc-50 px-2.5 py-1 text-[11px] font-medium text-zinc-600">
              <Timer size={12} />
              resposta em{" "}
              {formatElapsed(atual.responseMinutes)}
            </span>

          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">

            {indicadores.map((item) => {

              const max = item.unit === "%" ? 100 : 10;
              const ok = item.value >= item.meta;

              return (
                <div
                  key={item.label}
                  title={`Meta: ${ptBR(item.meta)}${item.unit}`}
                >

                  <div className="flex items-baseline justify-between gap-2">

                    <span className="text-xs font-medium text-zinc-600">
                      {item.label}
                    </span>

                    <span className="flex items-center gap-1.5 text-sm font-semibold tabular-nums text-zinc-900">

                      {ptBR(
                        item.value,
                        item.unit === "%" ? 1 : 2
                      )}
                      {item.unit}

                      <span
                        className={`flex h-4 w-4 items-center justify-center rounded-full ${
                          ok
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-rose-100 text-rose-700"
                        }`}
                      >
                        {ok ? (
                          <Check size={9} />
                        ) : (
                          <X size={9} />
                        )}
                      </span>

                    </span>

                  </div>

                  <div className="relative mt-1.5 h-2 rounded-full bg-zinc-100">

                    <div
                      className="h-full rounded-full transition-[width] duration-500"
                      style={{
                        width: `${Math.min(
                          (item.value / max) * 100,
                          100
                        )}%`,
                        background: ok
                          ? "#22C55E"
                          : "#F59E0B",
                      }}
                    />

                    <span
                      className="absolute -top-0.5 h-3 w-0.5 rounded-full bg-zinc-900/50"
                      style={{
                        left: `${(item.meta / max) * 100}%`,
                      }}
                    />

                  </div>

                </div>
              );
            })}

          </div>

          <div className="mt-5 grid grid-cols-3 gap-3 border-t border-zinc-100 pt-4">

            {[
              {
                label: "Reclamações",
                value: atual.received,
              },
              {
                label: "Respondidas",
                value: atual.answered,
              },
              {
                label: "Avaliadas",
                value: atual.evaluated,
              },
            ].map((item) => (

              <div key={item.label}>

                <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                  {item.label}
                </p>

                <p className="mt-0.5 text-lg font-semibold tabular-nums text-zinc-900">
                  {item.value}
                </p>

              </div>

            ))}

          </div>

        </div>

      </div>

    </section>
  );
}
