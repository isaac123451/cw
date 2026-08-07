import { ReactNode } from "react";

interface Props {
  label: string;
  children: ReactNode;
  side?: "top" | "bottom";
  className?: string;
}

/**
 * Dica em hover/foco, só com CSS — sem estado, sem medição de DOM e
 * portanto sem risco de hidratação. `group` isola cada instância.
 */
export default function Tooltip({
  label,
  children,
  side = "top",
  className,
}: Props) {
  return (
    <span
      className={`group/tip relative inline-flex ${
        className ?? ""
      }`}
    >

      {children}

      <span
        role="tooltip"
        className={`pointer-events-none absolute left-1/2 z-50 w-max max-w-[240px] -translate-x-1/2 rounded-lg bg-zinc-900 px-2.5 py-1.5 text-[11px] font-medium leading-snug text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover/tip:opacity-100 group-focus-within/tip:opacity-100 ${
          side === "top"
            ? "bottom-[calc(100%+6px)]"
            : "top-[calc(100%+6px)]"
        }`}
      >
        {label}
      </span>

    </span>
  );
}
