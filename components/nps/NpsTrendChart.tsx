"use client";

import { useState } from "react";

import type { PontoDeTendencia } from "@/lib/services/nps.service";

interface Props {
  dados: PontoDeTendencia[];
  height?: number;
}

const WIDTH = 720;
const PADDING_X = 10;
const PADDING_TOP = 18;
const AXIS_HEIGHT = 28;

/** Largura mínima de um rótulo de mês sem encostar no vizinho. */
const LARGURA_POR_ROTULO = 64;

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
 *
 * **O que havia de informação ao passar o mouse era um `<title>`** — o
 * balão nativo do navegador, que só aparece depois de um segundo parado
 * em cima de um ponto de quatro pixels, sem estilo e sem funcionar em
 * telefone. Virou cartão próprio, com faixa de captura por mês.
 */
export default function NpsTrendChart({
  dados,
  height = 240,
}: Props) {

  const [ativo, setAtivo] = useState<number | null>(null);

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

  /**
   * De quantos em quantos meses desenhar um rótulo.
   *
   * Era um por ponto. Doze meses ainda cabem; vinte e quatro viram uma
   * faixa cinza ilegível, que é o defeito que o Isaac descreveu no
   * gráfico do Analytics.
   */
  const cabem = Math.max(
    Math.floor(WIDTH / LARGURA_POR_ROTULO),
    2
  );

  const passo = Math.max(
    Math.ceil(dados.length / cabem),
    1
  );

  const ultimo = dados.length - 1;

  const vizinhoDoUltimo =
    ultimo - (ultimo % passo || passo);

  /** O vizinho sai se o último for encostar nele — ver TrendChart. */
  const espremido =
    ultimo % passo !== 0 &&
    (ultimo - vizinhoDoUltimo) * step <
      LARGURA_POR_ROTULO;

  const mostraRotulo = (index: number) =>
    index === 0 ||
    index === ultimo ||
    (index % passo === 0 &&
      !(espremido && index === vizinhoDoUltimo));

  const ponto = ativo === null ? null : dados[ativo];

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

      <div className="relative min-w-[560px]">

      <svg
        viewBox={`0 0 ${WIDTH} ${height}`}
        className="w-full"
        role="img"
        aria-label="Evolução do NPS por mês"
        onMouseLeave={() => setAtivo(null)}
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

            {mostraRotulo(i) && (
              <text
                x={toX(i)}
                y={height - AXIS_HEIGHT + 16}
                textAnchor="middle"
                className={
                  ativo === i
                    ? "fill-violet-700"
                    : "fill-zinc-500"
                }
                style={{
                  fontSize: 10,
                  fontWeight: ativo === i ? 600 : 400,
                }}
              >
                {ponto.rotulo}
              </text>
            )}

            {/*
              O número sobre o ponto só aparece quando há espaço.

              Com vinte e quatro meses ele vira uma trilha de dígitos
              sobrepostos em cima da própria linha — e o valor exato já
              está no cartão de quem passa o mouse.
            */}
            {(mostraRotulo(i) || ativo === i) && (
              <text
                x={toX(i)}
                y={toY(ponto.score) - 10}
                textAnchor="middle"
                className={
                  ativo === i
                    ? "fill-violet-800"
                    : "fill-zinc-700"
                }
                style={{ fontSize: 10, fontWeight: 600 }}
              >
                {ponto.score}
              </text>
            )}

          </g>
        ))}

        {/* A faixa de captura, por mês. */}
        {dados.map((p, i) => (
          <rect
            key={`faixa-${p.chave}`}
            x={toX(i) - (step || WIDTH) / 2}
            y={PADDING_TOP}
            width={step || WIDTH}
            height={plotHeight}
            fill="transparent"
            onMouseEnter={() => setAtivo(i)}
          />
        ))}

      </svg>

      {ponto && (
        <div
          className="pointer-events-none absolute top-1 z-10 rounded-xl border border-zinc-200 bg-white/95 px-3 py-2 text-xs shadow-lg backdrop-blur"
          style={
            ativo !== null && ativo > dados.length * 0.6
              ? { left: "1rem" }
              : { right: "1rem" }
          }
        >

          <div className="font-semibold text-zinc-900">
            {ponto.rotulo}
          </div>

          <div className="mt-1.5 flex items-center gap-3 text-zinc-600">
            NPS
            <strong className="ml-auto font-semibold text-zinc-900">
              {ponto.score}
            </strong>
          </div>

          <div className="mt-1 flex items-center gap-3 text-zinc-600">
            Respostas
            <strong className="ml-auto font-semibold text-zinc-900">
              {ponto.total}
            </strong>
          </div>

          {/*
            A composição é o que explica a nota.

            Um NPS de 40 com trinta respostas e um de 40 com três são
            fatos diferentes, e só a divisão entre promotor, passivo e
            detrator conta qual é qual.
          */}
          <div className="mt-1.5 flex gap-2 border-t border-zinc-100 pt-1.5 text-[11px]">
            <span className="text-emerald-600">
              {ponto.promotores} prom.
            </span>
            <span className="text-zinc-400">
              {ponto.passivos} pass.
            </span>
            <span className="text-rose-600">
              {ponto.detratores} detr.
            </span>
          </div>

        </div>
      )}

      </div>

    </div>
  );
}
