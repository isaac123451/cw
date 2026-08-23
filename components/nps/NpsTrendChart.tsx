"use client";

import type { PontoDeTendencia } from "@/lib/services/nps.service";

interface Props {
  dados: PontoDeTendencia[];
  height?: number;
}

const WIDTH = 720;
const PADDING_X = 10;
const PADDING_TOP = 18;
const AXIS_HEIGHT = 28;

/**
 * A evolução do NPS, em SVG puro.
 *
 * SVG e não biblioteca: renderiza igual no servidor e no cliente, sem
 * medir DOM — é a mesma escolha do `TrendChart` do Reclame Aqui, e pelo
 * mesmo motivo (nenhum risco de divergência de hidratação).
 *
 * **A escala é fixa de −100 a 100, e não ajustada aos dados.** Uma
 * escala que se aperta ao redor dos valores faz uma variação de três
 * pontos parecer um despencar — e o NPS é justamente um número que a
 * operação compara com o mês passado. A linha do zero fica desenhada
 * porque é a fronteira que importa: abaixo dela há mais detrator do que
 * promotor.
 */
export default function NpsTrendChart({
  dados,
  height = 240,
}: Props) {

  if (dados.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-zinc-400">
        Sem histórico suficiente para traçar a evolução.
      </p>
    );
  }

  const plotHeight = height - AXIS_HEIGHT - PADDING_TOP;

  const step =
    dados.length > 1
      ? (WIDTH - PADDING_X * 2) / (dados.length - 1)
      : 0;

  const toX = (index: number) =>
    dados.length > 1
      ? PADDING_X + index * step
      : WIDTH / 2;

  /** −100 embaixo, 100 em cima. */
  const toY = (valor: number) =>
    PADDING_TOP +
    plotHeight -
    ((valor + 100) / 200) * plotHeight;

  const linha = dados
    .map(
      (ponto, i) =>
        `${i === 0 ? "M" : "L"} ${toX(i).toFixed(1)} ${toY(
          ponto.score
        ).toFixed(1)}`
    )
    .join(" ");

  return (
    <div className="overflow-x-auto">

      <svg
        viewBox={`0 0 ${WIDTH} ${height}`}
        className="w-full min-w-[560px]"
        role="img"
        aria-label="Evolução do NPS por mês"
      >

        {/* Faixas de referência */}
        {[100, 50, 0, -50, -100].map((valor) => (
          <g key={valor}>
            <line
              x1={PADDING_X}
              x2={WIDTH - PADDING_X}
              y1={toY(valor)}
              y2={toY(valor)}
              stroke={valor === 0 ? "#a1a1aa" : "#f4f4f5"}
              strokeWidth={valor === 0 ? 1 : 1}
              strokeDasharray={valor === 0 ? "4 3" : undefined}
            />
            <text
              x={PADDING_X}
              y={toY(valor) - 4}
              className="fill-zinc-400"
              style={{ fontSize: 9 }}
            >
              {valor}
            </text>
          </g>
        ))}

        <path
          d={linha}
          fill="none"
          stroke="#7B3FBF"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {dados.map((ponto, i) => (
          <g key={ponto.chave}>

            <circle
              cx={toX(i)}
              cy={toY(ponto.score)}
              r={4}
              fill="#fff"
              stroke="#7B3FBF"
              strokeWidth={2}
            />

            <title>
              {`${ponto.rotulo}: NPS ${ponto.score} · ${ponto.total} resposta(s) · ${ponto.comentarios} com comentário`}
            </title>

            <text
              x={toX(i)}
              y={height - AXIS_HEIGHT + 16}
              textAnchor="middle"
              className="fill-zinc-500"
              style={{ fontSize: 10 }}
            >
              {ponto.rotulo}
            </text>

            <text
              x={toX(i)}
              y={toY(ponto.score) - 10}
              textAnchor="middle"
              className="fill-zinc-700"
              style={{ fontSize: 10, fontWeight: 600 }}
            >
              {ponto.score}
            </text>

          </g>
        ))}

      </svg>

    </div>
  );
}
