import SurfaceCard from "@/components/shared/SurfaceCard";

import {
  ptBR,
  RatingBucket,
  ReputationSummary,
} from "@/lib/services/reputation.service";

interface Props {
  buckets: RatingBucket[];
  summary: ReputationSummary;

  /** Quando informado, cada faixa vira filtro da tela. */
  onSelect?: (label: string) => void;

  active?: string;
}

export default function RatingHistogram({
  buckets,
  summary,
  onSelect,
  active,
}: Props) {

  const max = Math.max(
    ...buckets.map((item) => item.value),
    1
  );

  return (
    <SurfaceCard
      title="Distribuição das avaliações"
      description="Histograma das notas recebidas no período."
      hint="Só entram reclamações já avaliadas pelo consumidor. Notas de 7 a 10 contam como promotor no cálculo da reputação."
    >

      <div className="flex flex-col gap-6 sm:flex-row">

        <div className="flex-1">

          <div className="flex h-44 items-end gap-3">

            {buckets.map((bucket) => (

              <button
                key={bucket.label}
                onClick={() => onSelect?.(bucket.label)}
                disabled={!onSelect}
                title={
                  onSelect
                    ? active === bucket.label
                      ? `Remover o filtro de nota ${bucket.label}`
                      : `Filtrar a tela pelas notas ${bucket.label}`
                    : undefined
                }
                className={`flex flex-1 flex-col items-center justify-end rounded-lg pt-1 transition-colors ${
                  onSelect ? "hover:bg-violet-50/60" : ""
                } ${
                  active === bucket.label
                    ? "bg-violet-50 ring-1 ring-inset ring-violet-200"
                    : ""
                }`}
              >

                <span className="mb-1.5 text-sm font-semibold tabular-nums text-zinc-700">
                  {bucket.value}
                </span>

                <span
                  className="block w-full rounded-t-lg transition-[height] duration-500"
                  style={{
                    height: `${Math.max(
                      (bucket.value / max) * 100,
                      2
                    )}%`,
                    background: bucket.color,
                  }}
                />

              </button>

            ))}

          </div>

          <div className="mt-2 flex gap-3 border-t border-zinc-100 pt-2">

            {buckets.map((bucket) => (

              <div
                key={bucket.label}
                className="flex-1 text-center"
              >

                <p className="text-xs font-medium text-zinc-600">
                  {bucket.label}
                </p>

                <p className="text-[11px] text-zinc-400">
                  {ptBR(bucket.percent)}%
                </p>

              </div>

            ))}

          </div>

        </div>

        <div className="space-y-2 sm:w-44">

          {[
            {
              label: "Nota média",
              value: ptBR(summary.consumerScore, 2),
            },
            {
              label: "Avaliações",
              value: summary.evaluated,
            },
            {
              label: "% Resolveram",
              value: `${ptBR(summary.solutionIndex)}%`,
            },
            {
              label: "% Voltariam",
              value: `${ptBR(summary.wouldReturnIndex)}%`,
            },
          ].map((stat) => (

            <div
              key={stat.label}
              className="rounded-xl border border-zinc-100 px-3.5 py-2.5"
            >

              <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                {stat.label}
              </p>

              <p className="mt-0.5 text-lg font-semibold tabular-nums text-zinc-900">
                {stat.value}
              </p>

            </div>

          ))}

        </div>

      </div>

    </SurfaceCard>
  );
}
