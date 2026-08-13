"use client";

import { useRef, useState } from "react";

export interface Series {
  key: string;
  label: string;
  color: string;
  values: number[];
  /** Traço pontilhado, útil para separar meta de realizado. */
  dashed?: boolean;
}

interface Props {
  labels: string[];
  series: Series[];
  height?: number;
  /** Fixa o topo do eixo — use 10 para notas, 100 para percentuais. */
  max?: number;
  suffix?: string;
  /** Mostra o valor sobre cada ponto. Só vale com poucas séries. */
  showValues?: boolean;
  /** Linha extra no topo do tooltip, ex.: a janela que o ponto cobre. */
  captions?: string[];
}

const WIDTH = 900;
const PAD_L = 42;
const PAD_R = 16;
const PAD_T = 18;
const AXIS = 34;

const br = (value: number) =>
  String(value).replace(".", ",");

/**
 * Gráfico de linhas em SVG. O desenho é determinístico (mesmo no
 * servidor e no cliente); a interatividade só entra depois da
 * hidratação, então não há risco de mismatch.
 */
export default function MultiLineChart({
  labels,
  series,
  height = 260,
  max,
  suffix = "",
  showValues = false,
  captions,
}: Props) {

  const ref = useRef<HTMLDivElement>(null);

  const [hover, setHover] = useState<number | null>(null);

  if (labels.length === 0 || series.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-zinc-400">
        Sem dados no período selecionado.
      </p>
    );
  }

  const plot = height - AXIS - PAD_T;

  const ceiling =
    max ??
    Math.max(
      ...series.flatMap((item) => item.values),
      1
    );

  const inner = WIDTH - PAD_L - PAD_R;

  const step =
    labels.length > 1
      ? inner / (labels.length - 1)
      : 0;

  const toX = (index: number) =>
    labels.length > 1
      ? PAD_L + index * step
      : PAD_L + inner / 2;

  const toY = (value: number) =>
    PAD_T + plot - (value / ceiling) * plot;

  const path = (values: number[]) =>
    values
      .map(
        (value, index) =>
          `${index === 0 ? "M" : "L"} ${toX(index).toFixed(
            1
          )} ${toY(value).toFixed(1)}`
      )
      .join(" ");

  const ticks = [0, 0.25, 0.5, 0.75, 1];

  /**
   * Rótulos proporcionais, não a cada 3.
   *
   * O passo fixo funcionava até ~48 pontos; com uma série diária longa
   * desenhava dezenas de datas sobrepostas, virando um borrão cinza.
   * Aqui o eixo mostra no máximo doze, independentemente do tamanho.
   */
  const labelStride = Math.max(
    1,
    Math.ceil(labels.length / 12)
  );

  /**
   * Com muitos pontos os círculos viram ruído — e são um nó de SVG por
   * ponto por série. Acima de quarenta, só a linha; o ponto sob o cursor
   * continua aparecendo.
   */
  const showDots = labels.length <= 40;

  /** Converte a posição do mouse no índice mais próximo do eixo X. */
  function track(clientX: number) {

    const box = ref.current?.getBoundingClientRect();

    if (!box) return;

    // O SVG escala pelo viewBox: normaliza para a largura interna.
    const relative =
      ((clientX - box.left) / box.width) * WIDTH;

    const index = Math.round(
      (relative - PAD_L) / (step || 1)
    );

    setHover(
      Math.min(Math.max(index, 0), labels.length - 1)
    );
  }

  /** Posição do tooltip em % da largura, para não sair do card. */
  const tooltipLeft =
    hover === null
      ? 0
      : Math.min(Math.max((toX(hover) / WIDTH) * 100, 12), 88);

  return (
    <div>

      <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-zinc-600">

        {series.map((item) => (

          <span
            key={item.key}
            className="flex items-center gap-2"
          >

            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: item.color }}
            />

            {item.label}

          </span>

        ))}

      </div>

      <div className="w-full overflow-x-auto">

        <div
          ref={ref}
          className="relative min-w-[640px]"
          onPointerMove={(event) =>
            track(event.clientX)
          }
          onPointerLeave={() => setHover(null)}
        >

          <svg
            viewBox={`0 0 ${WIDTH} ${height}`}
            className="h-auto w-full"
            role="img"
            aria-label={series
              .map((item) => item.label)
              .join(", ")}
          >

            {ticks.map((ratio) => {

              const y = PAD_T + plot * ratio;

              const value = Math.round(
                ceiling * (1 - ratio)
              );

              return (
                <g key={ratio}>

                  <line
                    x1={PAD_L}
                    x2={WIDTH - PAD_R}
                    y1={y}
                    y2={y}
                    stroke="#F1F1F4"
                    strokeWidth={1}
                  />

                  <text
                    x={PAD_L - 8}
                    y={y + 4}
                    textAnchor="end"
                    fontSize={10}
                    fill="#C7C7CC"
                  >
                    {value}
                    {suffix}
                  </text>

                </g>
              );
            })}

            {hover !== null && (
              <line
                x1={toX(hover)}
                x2={toX(hover)}
                y1={PAD_T}
                y2={PAD_T + plot}
                stroke="#A1A1AA"
                strokeWidth={1}
                strokeDasharray="4 4"
              />
            )}

            {series.map((item) => (

              <path
                key={item.key}
                d={path(item.values)}
                fill="none"
                stroke={item.color}
                strokeWidth={2.2}
                strokeDasharray={
                  item.dashed ? "5 5" : undefined
                }
                strokeLinecap="round"
                strokeLinejoin="round"
              />

            ))}

            {series.map((item) =>
              item.values.map((value, index) =>
                showDots || hover === index ? (

                  <circle
                    key={`${item.key}-${index}`}
                    cx={toX(index)}
                    cy={toY(value)}
                    r={hover === index ? 5 : 3}
                    fill={
                      hover === index
                        ? item.color
                        : "#FFFFFF"
                    }
                    stroke={item.color}
                    strokeWidth={2}
                  />

                ) : null
              )
            )}

            {showValues &&
              series.length === 1 &&
              series[0].values.map((value, index) => (

                <text
                  key={`v-${index}`}
                  x={toX(index)}
                  y={toY(value) - 9}
                  textAnchor="middle"
                  fontSize={10}
                  fontWeight={600}
                  fill={series[0].color}
                >
                  {br(value)}
                  {suffix}
                </text>

              ))}

            {labels.map((label, index) =>
              index % labelStride === 0 ||
              hover === index ? (

                <text
                  key={label + index}
                  x={toX(index)}
                  y={height - 10}
                  textAnchor={
                    index === 0
                      ? "start"
                      : index === labels.length - 1
                      ? "end"
                      : "middle"
                  }
                  fontSize={10}
                  fontWeight={
                    hover === index ? 700 : 400
                  }
                  fill={
                    hover === index
                      ? "#3F3F46"
                      : "#9CA3AF"
                  }
                >
                  {label}
                </text>

              ) : null
            )}

          </svg>

          {hover !== null && (

            <div
              className="pointer-events-none absolute top-2 z-20 w-max -translate-x-1/2 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 shadow-[0_8px_24px_-8px_rgba(16,24,40,0.25)]"
              style={{ left: `${tooltipLeft}%` }}
            >

              <p className="text-xs font-semibold text-zinc-900">
                {labels[hover]}
              </p>

              {captions?.[hover] && (
                <p className="mt-0.5 text-[10px] text-zinc-400">
                  {captions[hover]}
                </p>
              )}

              <ul className="mt-1.5 space-y-1">

                {series.map((item) => (

                  <li
                    key={item.key}
                    className="flex items-center gap-2 text-[11px]"
                  >

                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: item.color }}
                    />

                    <span className="text-zinc-500">
                      {item.label}
                    </span>

                    <span className="ml-auto font-semibold tabular-nums text-zinc-900">
                      {br(item.values[hover])}
                      {suffix}
                    </span>

                  </li>

                ))}

              </ul>

            </div>

          )}

        </div>

      </div>

    </div>
  );
}
