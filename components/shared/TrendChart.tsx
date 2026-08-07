interface Point {
  label: string;
  total: number;
  resolved: number;
}

interface Props {
  data: Point[];
  height?: number;
}

const WIDTH = 720;
const PADDING_X = 8;
const PADDING_TOP = 16;
const AXIS_HEIGHT = 26;

/**
 * Gráfico de evolução em SVG puro — renderizado igual no servidor e no
 * cliente, sem medição de DOM e portanto sem risco de hydration mismatch.
 */
export default function TrendChart({
  data,
  height = 220,
}: Props) {

  if (data.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-zinc-400">
        Sem histórico suficiente para traçar a evolução.
      </p>
    );
  }

  const plotHeight = height - AXIS_HEIGHT - PADDING_TOP;

  const max = Math.max(
    ...data.map((item) => item.total),
    1
  );

  const step =
    data.length > 1
      ? (WIDTH - PADDING_X * 2) / (data.length - 1)
      : 0;

  const toX = (index: number) =>
    data.length > 1
      ? PADDING_X + index * step
      : WIDTH / 2;

  const toY = (value: number) =>
    PADDING_TOP +
    plotHeight -
    (value / max) * plotHeight;

  const line = (key: "total" | "resolved") =>
    data
      .map(
        (item, index) =>
          `${index === 0 ? "M" : "L"} ${toX(index).toFixed(
            1
          )} ${toY(item[key]).toFixed(1)}`
      )
      .join(" ");

  const area = `${line("total")} L ${toX(
    data.length - 1
  ).toFixed(1)} ${PADDING_TOP + plotHeight} L ${toX(
    0
  ).toFixed(1)} ${PADDING_TOP + plotHeight} Z`;

  return (
    <div className="w-full overflow-x-auto">

      <svg
        viewBox={`0 0 ${WIDTH} ${height}`}
        className="h-auto w-full min-w-[520px]"
        role="img"
        aria-label="Evolução mensal de reclamações recebidas e resolvidas"
      >

        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7C3AED" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#7C3AED" stopOpacity="0" />
          </linearGradient>
        </defs>

        {[0, 0.5, 1].map((ratio) => (
          <line
            key={ratio}
            x1={PADDING_X}
            x2={WIDTH - PADDING_X}
            y1={PADDING_TOP + plotHeight * ratio}
            y2={PADDING_TOP + plotHeight * ratio}
            stroke="#F1F1F4"
            strokeWidth={1}
          />
        ))}

        <path d={area} fill="url(#trendFill)" />

        <path
          d={line("total")}
          fill="none"
          stroke="#7C3AED"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <path
          d={line("resolved")}
          fill="none"
          stroke="#22C55E"
          strokeWidth={2}
          strokeDasharray="5 5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {data.map((item, index) => (
          <circle
            key={item.label}
            cx={toX(index)}
            cy={toY(item.total)}
            r={3.5}
            fill="#FFFFFF"
            stroke="#7C3AED"
            strokeWidth={2.5}
          />
        ))}

        {data.map((item, index) => (
          <text
            key={item.label}
            x={toX(index)}
            y={height - 6}
            textAnchor={
              index === 0
                ? "start"
                : index === data.length - 1
                ? "end"
                : "middle"
            }
            fontSize={11}
            fill="#9CA3AF"
          >
            {item.label}
          </text>
        ))}

      </svg>

      <div className="mt-3 flex items-center gap-5 text-xs text-zinc-500">

        <span className="flex items-center gap-2">
          <span className="h-0.5 w-5 rounded-full bg-[#7C3AED]" />
          Recebidas
        </span>

        <span className="flex items-center gap-2">
          <span className="h-0.5 w-5 rounded-full border-t-2 border-dashed border-[#22C55E]" />
          Resolvidas
        </span>

      </div>

    </div>
  );
}
