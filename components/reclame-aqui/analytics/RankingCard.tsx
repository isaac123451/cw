import SurfaceCard from "@/components/shared/SurfaceCard";

import {
  ptBR,
  RankingRow,
} from "@/lib/services/reputation.service";

interface Props {
  title: string;
  description: string;
  hint?: string;
  rows: RankingRow[];
  limit?: number;

  /** Quando informado, cada linha vira filtro da tela. */
  onSelect?: (label: string) => void;

  /** Linha atualmente aplicada como filtro. */
  active?: string;
}

export default function RankingCard({
  title,
  description,
  hint,
  rows,
  limit = 6,
  onSelect,
  active,
}: Props) {

  const items = rows.slice(0, limit);

  const max = Math.max(
    ...items.map((item) => item.value),
    1
  );

  return (
    <SurfaceCard
      title={title}
      description={description}
      hint={hint}
    >

      {items.length === 0 ? (

        <p className="py-8 text-center text-sm text-zinc-400">
          Sem classificações no período.
        </p>

      ) : (

        <ul className="space-y-1">

          {items.map((item) => (

            <li key={item.label}>

            <button
              onClick={() => onSelect?.(item.label)}
              disabled={!onSelect}
              title={
                onSelect
                  ? active === item.label
                    ? `Remover o filtro "${item.label}"`
                    : `Filtrar a tela por "${item.label}"`
                  : undefined
              }
              className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors ${
                onSelect ? "hover:bg-violet-50/60" : ""
              } ${
                active === item.label
                  ? "bg-violet-50 ring-1 ring-inset ring-violet-200"
                  : ""
              }`}
            >

              <span className="w-32 shrink-0 truncate text-sm font-medium text-zinc-700">
                {item.label}
              </span>

              <span className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100">
                <span
                  className="block h-full rounded-full bg-violet-600 transition-[width] duration-500"
                  style={{
                    width: `${(item.value / max) * 100}%`,
                  }}
                />
              </span>

              <span className="w-8 shrink-0 text-right text-sm font-semibold tabular-nums text-zinc-900">
                {item.value}
              </span>

              <span className="w-12 shrink-0 text-right text-xs tabular-nums text-zinc-400">
                {ptBR(item.percent)}%
              </span>

              <span
                className={`w-16 shrink-0 text-right text-xs font-semibold tabular-nums ${
                  item.variation === null
                    ? "text-zinc-300"
                    : item.variation > 0
                    ? "text-rose-600"
                    : item.variation < 0
                    ? "text-emerald-600"
                    : "text-zinc-400"
                }`}
                title="Variação contra o período anterior"
              >
                {item.variation === null
                  ? "Sem base"
                  : `${
                      item.variation > 0 ? "+" : ""
                    }${item.variation}%`}
              </span>

            </button>

            </li>

          ))}

        </ul>

      )}

    </SurfaceCard>
  );
}
