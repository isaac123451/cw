"use client";

import { CalendarDays } from "lucide-react";

import {
  formatRange,
  PeriodKey,
  PeriodMode,
  periodModeLabels,
  PeriodRange,
} from "@/lib/services/reputation.service";

interface Props {
  period: PeriodKey;
  mode: PeriodMode;
  range: PeriodRange;
  periods: PeriodKey[];
  labels: Record<string, string>;
  onPeriod: (value: PeriodKey) => void;
  onMode: (value: PeriodMode) => void;
}

/**
 * Seletor de janela de apuração. O modo `próximo` é justamente o que a
 * calculadora do Hugme não oferece.
 */
export default function PeriodPicker({
  period,
  mode,
  range,
  periods,
  labels,
  onPeriod,
  onMode,
}: Props) {
  return (
    <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">

      <div className="flex flex-wrap items-center gap-3">

        <div className="flex items-center rounded-xl border border-zinc-200 p-1">

          {periods.map((key) => (

            <button
              key={key}
              onClick={() => onPeriod(key)}
              className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${
                period === key
                  ? "bg-zinc-900 text-white"
                  : "text-zinc-600 hover:bg-zinc-100"
              }`}
            >
              {labels[key]}
            </button>

          ))}

        </div>

        <div className="flex items-center rounded-xl border border-zinc-200 p-1">

          {(
            Object.keys(periodModeLabels) as PeriodMode[]
          ).map((key) => (

            <button
              key={key}
              onClick={() => onMode(key)}
              title={
                key === "vigente"
                  ? "Janela de meses fechados considerada hoje"
                  : "A janela que passa a valer quando o mês atual fechar"
              }
              className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${
                mode === key
                  ? "bg-violet-700 text-white"
                  : "text-zinc-600 hover:bg-zinc-100"
              }`}
            >
              {periodModeLabels[key]}
            </button>

          ))}

        </div>

      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-zinc-100 pt-3 text-xs text-zinc-500">

        <span className="flex items-center gap-2">

          <CalendarDays size={14} className="text-zinc-400" />

          Período:{" "}
          <strong className="font-semibold text-zinc-700">
            {formatRange(range.start, range.end)}
          </strong>

        </span>

        {range.partial && (
          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700 ring-1 ring-inset ring-amber-100">
            Mês corrente ainda aberto — projeção
          </span>
        )}

      </div>

    </div>
  );
}
