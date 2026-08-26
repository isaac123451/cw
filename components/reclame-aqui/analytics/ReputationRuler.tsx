"use client";

import { Check, Info, X } from "lucide-react";

import SurfaceCard from "@/components/shared/SurfaceCard";

import {
  displayBand,
  hasRA1000,
  ptBR,
  RA1000_TARGETS,
  ReputationSummary,
  scoreBands,
  textoSobre,
} from "@/lib/services/reputation.service";

interface Props {
  summary: ReputationSummary;
}

export default function ReputationRuler({
  summary,
}: Props) {

  const band = displayBand(summary);

  const selo = hasRA1000(summary);

  /** Posição do marcador na régua, em percentual da largura total. */
  const position = Math.min(
    Math.max((summary.raScore / 10) * 100, 4),
    96
  );

  const criterios = [
    {
      label: "Índice de resposta",
      value: summary.responseIndex,
      target: RA1000_TARGETS.resposta,
      unit: "%",
    },
    {
      label: "Nota do consumidor",
      value: summary.consumerScore,
      target: RA1000_TARGETS.consumidor,
      unit: "",
    },
    {
      label: "Índice de solução",
      value: summary.solutionIndex,
      target: RA1000_TARGETS.solucao,
      unit: "%",
    },
    {
      label: "Voltaria a fazer negócio",
      value: summary.wouldReturnIndex,
      target: RA1000_TARGETS["novos-negocios"],
      unit: "%",
    },
  ];

  const faltando = criterios.filter(
    (item) => item.value < item.target
  );

  return (
    <SurfaceCard
      title="Régua de reputação"
      description="Faixa da nota e situação do selo RA1000."
      action={
        <span
          className="shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold"
          style={{
            background: band.color,
            color: textoSobre(band.color),
          }}
          title={
            selo
              ? "Todos os critérios do selo atingidos"
              : `Faixa da nota ${ptBR(summary.raScore)}`
          }
        >
          {band.label}
        </span>
      }
    >

      <div className="relative pt-8">

        <span
          className="absolute top-0 -translate-x-1/2 rounded-full border-2 bg-white px-2.5 py-1 text-sm font-semibold tabular-nums"
          style={{
            left: `${position}%`,
            borderColor: band.color,
            color: band.color,
          }}
        >
          {ptBR(summary.raScore)}
        </span>

        <div className="flex gap-1.5">

          {scoreBands.map((item) => (

            <div key={item.label} className="flex-1">

              <div
                className="flex h-16 items-center justify-center rounded-xl px-1 text-center text-[10px] font-bold uppercase leading-tight text-white"
                style={{ background: item.color }}
                title={`${item.label}: nota ${item.range}`}
              >
                {item.label}
              </div>

              <p className="mt-1.5 text-center text-[11px] text-zinc-400">
                {item.range}
              </p>

            </div>

          ))}

        </div>

      </div>

      {/* Critérios do selo */}

      <div className="mt-5 rounded-2xl border border-zinc-100 p-4">

        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Critérios do selo RA1000
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              selo
                ? "bg-lime-100 text-lime-700"
                : "bg-zinc-100 text-zinc-500"
            }`}
          >
            {selo ? "Conquistado" : "Não atingido"}
          </span>
        </p>

        <ul className="mt-3 grid gap-2 sm:grid-cols-2">

          {criterios.map((item) => {

            const ok = item.value >= item.target;

            return (
              <li
                key={item.label}
                className="flex items-center gap-2.5 rounded-xl bg-zinc-50 px-3 py-2"
                title={
                  ok
                    ? `Meta de ${ptBR(item.target)}${item.unit} atingida.`
                    : `Meta: ${ptBR(item.target)}${item.unit} — ainda não atingida.`
                }
              >

                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                    ok
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-rose-100 text-rose-700"
                  }`}
                >
                  {ok ? <Check size={12} /> : <X size={12} />}
                </span>

                <span className="min-w-0 flex-1 truncate text-xs text-zinc-600">
                  {item.label}
                </span>

                <span
                  className={`shrink-0 text-xs font-semibold tabular-nums ${
                    ok ? "text-emerald-700" : "text-rose-700"
                  }`}
                >
                  {/* Percentuais com 1 casa; a nota do consumidor com 2. */}
                  {ptBR(item.value, item.unit === "%" ? 1 : 2)}
                  {item.unit}
                </span>

              </li>
            );
          })}

        </ul>

      </div>

      {!selo && faltando.length > 0 && (

        <p className="mt-3 flex items-start gap-2 rounded-xl bg-zinc-50 px-4 py-3 text-xs leading-relaxed text-zinc-600">

          <Info size={14} className="mt-px shrink-0 text-zinc-400" />

          <span>
            Falta{faltando.length > 1 ? "m" : ""}{" "}
            {faltando
              .map(
                (item) =>
                  `${item.label.toLowerCase()} (${ptBR(
                    Math.round(
                      (item.target - item.value) * 100
                    ) / 100,
                    2
                  )}${item.unit} abaixo)`
              )
              .join(" e ")}{" "}
            para o selo.
          </span>

        </p>

      )}

    </SurfaceCard>
  );
}
