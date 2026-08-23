"use client";

import { useState } from "react";

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
 * Largura mínima de um rótulo de mês sem encostar no vizinho.
 *
 * "Ago 26" a 11 px ocupa cerca de 45; setenta dá folga. É este número
 * que decide quantos rótulos cabem quando a janela cresce.
 */
const LARGURA_POR_ROTULO = 70;

/**
 * Barras (volume recebido) combinadas com linha (nota RA) em SVG puro.
 *
 * SVG e não biblioteca de gráfico: o desenho é o mesmo no servidor e no
 * cliente, sem medir o DOM.
 *
 * **Não tinha informação nenhuma ao passar o mouse** — as barras e os
 * pontos eram decorativos. Numa tela que existe para explicar a nota,
 * isso significa mostrar que ela caiu sem deixar ver de quanto para
 * quanto, nem com que volume. Agora cada mês tem uma faixa de captura
 * e um cartão com os três números que a pessoa procuraria.
 */
export default function ReputationTrend({
  data,
}: Props) {

  const [ativo, setAtivo] = useState<number | null>(null);

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

  /**
   * De quantos em quantos meses desenhar um rótulo.
   *
   * Com a janela de seis meses cabem todos — medido: folga de 66 px.
   * O afinamento existe para quando alguém abrir doze ou vinte e quatro,
   * que é quando as datas começam a se empilhar.
   */
  const cabem = Math.max(
    Math.floor(inner / LARGURA_POR_ROTULO),
    2
  );

  const passo = Math.max(
    Math.ceil(data.length / cabem),
    1
  );

  const ultimo = data.length - 1;

  const vizinhoDoUltimo =
    ultimo - (ultimo % passo || passo);

  /** O vizinho sai se o último for encostar nele — ver TrendChart. */
  const espremido =
    ultimo % passo !== 0 &&
    (ultimo - vizinhoDoUltimo) * slot <
      LARGURA_POR_ROTULO;

  const mostraRotulo = (index: number) =>
    index === 0 ||
    index === ultimo ||
    (index % passo === 0 &&
      !(espremido && index === vizinhoDoUltimo));

  const ponto = ativo === null ? null : data[ativo];

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

      <div className="relative w-full overflow-x-auto">

        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="h-auto w-full min-w-[520px]"
          role="img"
          aria-label="Evolução da nota de reputação e do volume de reclamações"
          onMouseLeave={() => setAtivo(null)}
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

          {data.map((item, index) =>
            mostraRotulo(index) ? (
              <text
                key={`lb-${item.label}`}
                x={centerX(index)}
                y={HEIGHT - 8}
                textAnchor="middle"
                fontSize={11}
                fill={
                  ativo === index ? "#7C3AED" : "#9CA3AF"
                }
                fontWeight={ativo === index ? 600 : 400}
              >
                {item.label}
              </text>
            ) : null
          )}

          {/*
            A faixa de captura, por mês.

            Vai por cima de tudo porque é ela que recebe o mouse — e é
            transparente, então não muda o desenho. Cobrir a coluna
            inteira faz acertar o mês depender de estar nele, e não de
            acertar a barra.
          */}
          {data.map((item, index) => (
            <rect
              key={`faixa-${item.label}`}
              x={PAD_L + slot * index}
              y={PAD_T}
              width={slot}
              height={plot}
              fill="transparent"
              onMouseEnter={() => setAtivo(index)}
            />
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

        {ponto && (
          <div
            className="pointer-events-none absolute top-2 z-10 rounded-xl border border-zinc-200 bg-white/95 px-3 py-2 text-xs shadow-lg backdrop-blur"
            style={
              ativo !== null && ativo > data.length * 0.6
                ? { left: "1rem" }
                : { right: "1rem" }
            }
          >

            <div className="font-semibold text-zinc-900">
              {ponto.label}
            </div>

            <div className="mt-1.5 flex items-center gap-2 text-zinc-600">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500" />
              Nota RA
              <strong className="ml-auto pl-3 font-semibold text-zinc-900">
                {ponto.score
                  .toFixed(1)
                  .replace(".", ",")}
              </strong>
            </div>

            <div className="mt-1 flex items-center gap-2 text-zinc-600">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-violet-200" />
              Recebidas
              <strong className="ml-auto pl-3 font-semibold text-zinc-900">
                {ponto.received}
              </strong>
            </div>

            {/*
              A variação contra o mês anterior é o que a tela existe para
              responder. Sem ela, quem olha compara duas alturas de barra
              a olho — que é exatamente o erro que o gráfico deveria
              evitar.
            */}
            {ativo !== null && ativo > 0 && (
              <div className="mt-1.5 border-t border-zinc-100 pt-1.5 text-[11px] text-zinc-500">
                {(() => {

                  const antes = data[ativo - 1].score;
                  const delta = ponto.score - antes;

                  if (Math.abs(delta) < 0.05) {
                    return "estável contra o mês anterior";
                  }

                  return `${delta > 0 ? "+" : "−"}${Math.abs(delta).toFixed(1).replace(".", ",")} contra ${data[ativo - 1].label}`;
                })()}
              </div>
            )}

          </div>
        )}

      </div>

    </SurfaceCard>
  );
}
