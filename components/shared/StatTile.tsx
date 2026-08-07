import { LucideIcon, TrendingDown, TrendingUp } from "lucide-react";

import { cn } from "@/lib/utils";

type Tone =
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "info";

interface Props {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  tone?: Tone;
  /** Explicação exibida ao passar o mouse sobre o indicador. */
  description?: string;
  trend?: {
    value: string;
    positive?: boolean;
  };
}

const tones: Record<Tone, string> = {
  primary: "bg-violet-50 text-violet-600 ring-violet-100",
  success: "bg-emerald-50 text-emerald-600 ring-emerald-100",
  warning: "bg-amber-50 text-amber-600 ring-amber-100",
  danger: "bg-rose-50 text-rose-600 ring-rose-100",
  info: "bg-sky-50 text-sky-600 ring-sky-100",
};

export default function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  tone = "primary",
  description,
  trend,
}: Props) {
  return (
    <div
      title={description}
      className="group relative rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-shadow hover:shadow-[0_1px_2px_rgba(16,24,40,0.04),0_12px_28px_-14px_rgba(16,24,40,0.18)]"
    >

      <div className="flex items-start justify-between gap-3">

        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
          {label}
        </p>

        <span
          className={cn(
            "rounded-xl p-2 ring-1 ring-inset transition-transform group-hover:scale-105",
            tones[tone]
          )}
        >
          <Icon size={16} strokeWidth={2.2} />
        </span>

      </div>

      <p className="mt-3 text-3xl font-semibold tracking-tight text-zinc-900 tabular-nums">
        {value}
      </p>

      <div className="mt-2 flex items-center gap-2">

        {trend && (
          <span
            className={cn(
              "inline-flex items-center gap-1 text-xs font-semibold",
              trend.positive
                ? "text-emerald-600"
                : "text-rose-600"
            )}
          >
            {trend.positive ? (
              <TrendingUp size={13} />
            ) : (
              <TrendingDown size={13} />
            )}
            {trend.value}
          </span>
        )}

        {hint && (
          <span className="text-xs text-zinc-400">
            {hint}
          </span>
        )}

      </div>

      {description && (

        <span
          role="tooltip"
          className="pointer-events-none absolute bottom-[calc(100%+6px)] left-1/2 z-50 w-max max-w-[240px] -translate-x-1/2 rounded-lg bg-zinc-900 px-2.5 py-1.5 text-[11px] font-medium leading-snug text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100"
        >
          {description}
        </span>

      )}

    </div>
  );
}
