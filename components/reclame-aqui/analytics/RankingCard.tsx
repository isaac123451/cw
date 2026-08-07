import SurfaceCard from "@/components/shared/SurfaceCard";

import {
  ptBR,
  RankingRow,
} from "@/lib/services/reputation.service";

interface Props {
  title: string;
  description: string;
  rows: RankingRow[];
  limit?: number;
}

export default function RankingCard({
  title,
  description,
  rows,
  limit = 6,
}: Props) {

  const items = rows.slice(0, limit);

  const max = Math.max(
    ...items.map((item) => item.value),
    1
  );

  return (
    <SurfaceCard title={title} description={description}>

      {items.length === 0 ? (

        <p className="py-8 text-center text-sm text-zinc-400">
          Sem classificações no período.
        </p>

      ) : (

        <ul className="space-y-3.5">

          {items.map((item) => (

            <li
              key={item.label}
              className="flex items-center gap-3"
            >

              <span className="w-32 shrink-0 truncate text-sm font-medium text-zinc-700">
                {item.label}
              </span>

              <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100">
                <div
                  className="h-full rounded-full bg-violet-600 transition-[width] duration-500"
                  style={{
                    width: `${(item.value / max) * 100}%`,
                  }}
                />
              </div>

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

            </li>

          ))}

        </ul>

      )}

    </SurfaceCard>
  );
}
