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
  /**
   * Torna o indicador clicável — vira `<button>` em vez de `<div>`.
   *
   * Existe porque um número numa tela de operação quase sempre é uma
   * pergunta ("quais são esses 84?"), e a resposta estava a dois passos
   * de distância. Sem `onClick`, o componente segue exatamente como era.
   */
  onClick?: () => void;
  /** Realce de quem está filtrando a lista agora. */
  ativo?: boolean;
}

const tones: Record<Tone, string> = {
  primary: "text-violet-500",
  success: "text-emerald-500",
  warning: "text-amber-500",
  danger: "text-rose-500",
  info: "text-sky-500",
};

export default function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  tone = "primary",
  description,
  trend,
  onClick,
  ativo,
}: Props) {

  const Elemento = onClick ? "button" : "div";

  return (
    <Elemento
      title={description}
      onClick={onClick}
      type={onClick ? "button" : undefined}
      aria-pressed={onClick ? Boolean(ativo) : undefined}
      className={cn(
        "group relative rounded-xl border bg-white px-4 py-3.5 text-left shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-colors",
        ativo
          ? "border-violet-300 ring-2 ring-violet-200"
          : "border-zinc-200/80",
        onClick && "cursor-pointer w-full hover:border-zinc-300"
      )}
    >

      <div className="flex items-start justify-between gap-3">

        <p className="text-xs font-medium text-zinc-500">
          {label}
        </p>

        <span
          className={cn(
            "shrink-0",
            tones[tone]
          )}
        >
          <Icon size={15} strokeWidth={2} />
        </span>

      </div>

      <p className="mt-1.5 text-[22px] font-semibold leading-none tracking-tight text-zinc-900 tabular-nums sm:text-[26px]">
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

      {/*
        O balão sai do layout enquanto está escondido.

        Era `opacity-0`: invisível, mas ocupando lugar — e um balão de
        240 px centrado no indicador da ponta passava da borda da tela.
        No celular isso dava rolagem lateral em 16 telas. Agora ele só
        existe no hover (ou com o foco no indicador) e nunca é mais largo
        que o próprio indicador.
      */}
      {description && (

        <span
          role="tooltip"
          className="pointer-events-none absolute bottom-[calc(100%+6px)] left-1/2 z-50 hidden w-max max-w-[min(240px,calc(100%+1rem))] -translate-x-1/2 rounded-lg bg-zinc-900 px-2.5 py-1.5 text-[11px] font-medium leading-snug text-white shadow-lg group-hover:block group-focus-visible:block"
        >
          {description}
        </span>

      )}

    </Elemento>
  );
}
