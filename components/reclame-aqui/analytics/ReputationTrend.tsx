import SurfaceCard from "@/components/shared/SurfaceCard";

import { MonthlyReputation } from "@/lib/services/reputation.service";

interface Props {
  data: MonthlyReputation[];
}

const WIDTH = 680;
const HEIGHT = 260;
const PAD_L = 34;
const PAD_R = 34;
const PAD_T = 24;
const AXIS = 30;

/**
 * Barras (volume recebido) combinadas com linha (nota RA) em SVG puro,
 * mantendo o render idêntico entre servidor e cliente.
 */
export default function ReputationTrend({
  data,
}: Props) {

  if (data.length === 0) {
    return (
      <SurfaceCard
        title="Evolução da reputação"
        description="Nota RA derivada do período e volume de reclamações recebidas."
      >
        <p className="py-10 text-center text-sm text-zinc-400">
          Sem histórico no período selecionado.
        </p>
      </SurfaceCard>
    );
  }

  const plot = HEIGHT - AXIS - PAD_T;

  const maxReceived = Math.max(
    ...data.map((item) => item.received),
    1
  );

  const inner = WIDTH - PAD_L - PAD_R;
  const slot = inner / data.length;
  const barWidth = Math.min(slot * 0.5, 40);

  const centerX = (index: number) =>
    PAD_L + slot * index + slot / 2;

  const barY = (value: number) =>
    PAD_T + plot - (value / maxReceived) * plot;

  const scoreY = (value: number) =>
    PAD_T + plot - (value / 10) * plot;

  const linePath = data
    .map(
      (item, index) =>
        `${index === 0 ? "M" : "L"} ${centerX(
          index
        ).toFixed(1)} ${scoreY(item.score).toFixed(1)}`
    )
    .join(" ");

  return (
    <SurfaceCard
      title="Evolução da reputação"
      description="Nota RA derivada do período e volume de reclamações recebidas."
    >

      <div className="mb-3 flex items-center gap-5 text-xs text-zinc-500">

        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-violet-200" />
          Reclamações recebidas
        </span>

        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
          Nota RA
        </span>

      </div>

      <div className="w-full overflow-x-auto">

        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="h-auto w-full min-w-[520px]"
          role="img"
          aria-label="Evolução da nota de reputação e do volume de reclamações"
        >

          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
            <line
              key={ratio}
              x1={PAD_L}
              x2={WIDTH - PAD_R}
              y1={PAD_T + plot * ratio}
              y2={PAD_T + plot * ratio}
              stroke="#F1F1F4"
              strokeWidth={1}
            />
          ))}

          {data.map((item, index) => (
            <rect
              key={`bar-${item.label}`}
              x={centerX(index) - barWidth / 2}
              y={barY(item.received)}
              width={barWidth}
              height={PAD_T + plot - barY(item.received)}
              rx={6}
              fill="#DDD6FE"
            />
          ))}

          <path
            d={linePath}
            fill="none"
            stroke="#22C55E"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {data.map((item, index) => (
            <g key={`pt-${item.label}`}>

              <circle
                cx={centerX(index)}
                cy={scoreY(item.score)}
                r={4}
                fill="#22C55E"
              />

              <text
                x={centerX(index)}
                y={scoreY(item.score) - 10}
                textAnchor="middle"
                fontSize={11}
                fontWeight={600}
                fill="#15803D"
              >
                {item.score.toFixed(1).replace(".", ",")}
              </text>

            </g>
          ))}

          {data.map((item, index) => (
            <text
              key={`lb-${item.label}`}
              x={centerX(index)}
              y={HEIGHT - 8}
              textAnchor="middle"
              fontSize={11}
              fill="#9CA3AF"
            >
              {item.label}
            </text>
          ))}

          {[0, 5, 10].map((tick) => (
            <text
              key={`ax-${tick}`}
              x={WIDTH - PAD_R + 8}
              y={scoreY(tick) + 4}
              fontSize={10}
              fill="#C7C7CC"
            >
              {tick}
            </text>
          ))}

        </svg>

      </div>

    </SurfaceCard>
  );
}
