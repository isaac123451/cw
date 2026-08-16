"use client";

import { CalendarDays, Info, TriangleAlert } from "lucide-react";

import {
  CustomRange,
  formatRange,
  OFFICIAL_PERIODS,
  PeriodKey,
  periodLabels,
  PeriodMode,
  periodModeLabels,
  PeriodRange,
} from "@/lib/services/reputation.service";

const hints: Record<PeriodKey, string> = {
  "30d": "Últimos 30 dias corridos, até hoje — inclui o mês corrente.",
  "3m": "Trimestre fechado, para ver tendência sem ruído de um mês isolado.",
  "6m": "Janela oficial que define a nota pública do Reclame Aqui.",
  "12m": "Janela oficial de 12 meses, usada na nota anual.",
  custom: "Intervalo livre entre duas datas.",
};

interface Props {
  period: PeriodKey;
  onPeriodChange: (value: PeriodKey) => void;

  /** Janela resolvida, só para exibir as datas e o aviso de parcial. */
  range: PeriodRange;

  custom: CustomRange;
  onCustomChange: (value: CustomRange) => void;

  /** Vigente × próximo período — só faz sentido nas janelas oficiais. */
  mode?: PeriodMode;
  onModeChange?: (value: PeriodMode) => void;

  /**
   * Quando true, avisa que períodos fora dos oficiais não reproduzem
   * a nota do painel do Reclame Aqui.
   */
  warnUnofficial?: boolean;

  /** Texto extra à direita da linha de datas. */
  note?: string;
}

const options: PeriodKey[] = [
  "30d",
  "3m",
  "6m",
  "12m",
  "custom",
];

export default function PeriodPicker({
  period,
  onPeriodChange,
  range,
  custom,
  onCustomChange,
  mode,
  onModeChange,
  warnUnofficial = false,
  note,
}: Props) {

  const oficial = OFFICIAL_PERIODS.includes(period);

  return (
    <div>

      <div className="flex flex-wrap items-center gap-3">

        <div className="flex flex-wrap items-center gap-1.5">

          {options.map((key) => (

            <button
              key={key}
              onClick={() => onPeriodChange(key)}
              title={hints[key]}
              className={`rounded-xl px-3.5 py-2 text-sm font-medium transition-colors ring-1 ring-inset ${
                period === key
                  ? "bg-violet-50 text-violet-700 ring-violet-200"
                  : "text-zinc-600 ring-zinc-200 hover:bg-zinc-50"
              }`}
            >
              {periodLabels[key]}
            </button>

          ))}

        </div>

        {/*
          Vigente/próximo só existe em janela de meses fechados. "30
          dias" é de dias corridos e termina hoje, então não tem "próximo
          período" — mostrar o toggle ali era um botão que não mudava
          nada.
        */}
        {mode &&
          onModeChange &&
          period !== "custom" &&
          period !== "30d" && (

          <div className="flex items-center rounded-xl border border-zinc-200 p-1">

            {(
              Object.keys(periodModeLabels) as PeriodMode[]
            ).map((key) => (

              <button
                key={key}
                onClick={() => onModeChange(key)}
                title={
                  key === "vigente"
                    ? "Janela de meses fechados que o Reclame Aqui considera hoje"
                    : "A mesma janela deslocada um mês, quando o mês atual fechar"
                }
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  mode === key
                    ? "bg-violet-700 text-white"
                    : "text-zinc-600 hover:bg-zinc-100"
                }`}
              >
                {periodModeLabels[key]}
              </button>

            ))}

          </div>

        )}

      </div>

      {period === "custom" && (

        <div className="mt-3 flex flex-wrap items-end gap-3">

          <label className="block">

            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              De
            </span>

            <input
              type="date"
              value={custom.start}
              max={custom.end}
              onChange={(e) =>
                onCustomChange({
                  ...custom,
                  start: e.target.value,
                })
              }
              className="h-10 rounded-xl border border-zinc-200 px-3 text-sm outline-none transition-colors focus:border-violet-400"
            />

          </label>

          <label className="block">

            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Até
            </span>

            <input
              type="date"
              value={custom.end}
              min={custom.start}
              onChange={(e) =>
                onCustomChange({
                  ...custom,
                  end: e.target.value,
                })
              }
              className="h-10 rounded-xl border border-zinc-200 px-3 text-sm outline-none transition-colors focus:border-violet-400"
            />

          </label>

        </div>

      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-zinc-100 pt-3 text-xs text-zinc-500">

        <span className="flex items-center gap-2">

          <CalendarDays
            size={14}
            className="text-zinc-400"
          />

          Período:{" "}
          <strong className="font-semibold text-zinc-700">
            {formatRange(range.start, range.end)}
          </strong>

        </span>

        <span>
          Comparação:{" "}
          {formatRange(
            range.previousStart,
            range.previousEnd
          )}
        </span>

        {range.partial && (
          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700 ring-1 ring-inset ring-amber-100">
            Janela ainda aberta — parcial
          </span>
        )}

        {warnUnofficial && !oficial && (
          <span
            className="flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700 ring-1 ring-inset ring-amber-100"
            title="O Reclame Aqui apura a nota pública em janelas de 6 e 12 meses fechados."
          >
            <TriangleAlert size={11} />
            Fora da janela oficial — não reproduz a nota do
            painel
          </span>
        )}

        {note && (
          <span className="flex items-center gap-1.5">
            <Info size={13} className="text-zinc-400" />
            {note}
          </span>
        )}

      </div>

    </div>
  );
}
