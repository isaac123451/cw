import { Distribution } from "@/lib/services/case.service";

interface Props {
  data: Distribution[];
  limit?: number;
  color?: string;
  emptyLabel?: string;
}

/**
 * Distribuição horizontal em barras. Usa largura percentual relativa
 * ao maior item para que a comparação visual fique correta.
 */
export default function BarList({
  data,
  limit = 6,
  color = "#7C3AED",
  emptyLabel = "Sem dados para exibir.",
}: Props) {

  const items = data.slice(0, limit);

  const max = Math.max(
    ...items.map((item) => item.value),
    1
  );

  if (items.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-zinc-400">
        {emptyLabel}
      </p>
    );
  }

  return (
    <ul className="space-y-4">

      {items.map((item) => (

        <li key={item.label}>

          <div className="mb-1.5 flex items-baseline justify-between gap-3">

            <span className="truncate text-sm font-medium text-zinc-700">
              {item.label}
            </span>

            <span className="flex shrink-0 items-baseline gap-1.5 text-sm font-semibold tabular-nums text-zinc-900">
              {item.value}
              <span className="text-xs font-normal text-zinc-400">
                ({item.percent}%)
              </span>
            </span>

          </div>

          <div className="h-2 overflow-hidden rounded-full bg-zinc-100">

            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{
                width: `${(item.value / max) * 100}%`,
                background: color,
              }}
            />

          </div>

        </li>

      ))}

    </ul>
  );
}
