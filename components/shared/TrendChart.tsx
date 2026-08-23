"use client";

import { useId, useState } from "react";

interface Point {
  label: string;
  total: number;
  resolved: number;
}

interface Props {
  data: Point[];
  height?: number;
  /** Rótulo da série sólida. "Recebidas" cobre a maioria dos usos. */
  totalLabel?: string;
  /** Rótulo da série tracejada. */
  resolvedLabel?: string;
}

const WIDTH = 720;
const PADDING_X = 8;
const PADDING_TOP = 16;
const AXIS_HEIGHT = 26;

/**
 * Largura mínima que um rótulo de eixo precisa para não encostar no
 * vizinho.
 *
 * Onze pixels de fonte, rótulos como "ago/26" ou "12/08": setenta
 * pixels dão folga confortável. É esse número que decide **quantos**
 * rótulos cabem — e era a conta que faltava, por isso as datas
 * apareciam umas por cima das outras assim que a série passava de uns
 * dez pontos.
 */
const LARGURA_POR_ROTULO = 70;

/**
 * Gráfico de evolução em SVG puro.
 *
 * SVG e não uma biblioteca de gráficos: o desenho é o mesmo no servidor
 * e no cliente, sem medir o DOM, e portanto sem risco de divergência na
 * hidratação. O `recharts` está no projeto e não é usado por nenhum
 * gráfico — trocar por ele traria 90 kB ao pacote para resolver o que
 * cem linhas resolvem.
 *
 * **Três defeitos consertados em 23/08**, todos reportados pelo Isaac:
 *
 * 1. Os rótulos do eixo saíam um por ponto e se empilhavam. Agora o
 *    número de rótulos sai da largura disponível, e o primeiro e o
 *    último aparecem sempre — são eles que dizem o período mostrado.
 * 2. Não havia informação nenhuma ao passar o mouse. Agora há guia
 *    vertical e um cartão com o período e os dois números.
 * 3. A área de captura do mouse era o ponto desenhado, de três pixels.
 *    Agora é uma faixa vertical inteira por período: acertar o mês não
 *    depende de acertar o pixel.
 */
export default function TrendChart({
  data,
  height = 220,
  totalLabel = "Recebidas",
  resolvedLabel = "Resolvidas",
}: Props) {

  /**
   * O gradiente precisa de um id único por instância.
   *
   * Duas telas com o mesmo gráfico compartilhavam o id `trendFill`, e o
   * navegador resolve `url(#trendFill)` para o **primeiro** que
   * encontrar no documento — o segundo gráfico herdava o preenchimento
   * do primeiro.
   */
  const idDoGradiente = useId();

  const [ativo, setAtivo] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-zinc-400">
        Sem histórico suficiente para traçar a evolução.
      </p>
    );
  }

  const plotHeight = height - AXIS_HEIGHT - PADDING_TOP;

  const max = Math.max(
    ...data.map((item) =>
      Math.max(item.total, item.resolved)
    ),
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
          `${index === 0 ? "M" : "L"} ${toX(index).toFixed(1)} ${toY(item[key]).toFixed(1)}`
      )
      .join(" ");

  const area = `${line("total")} L ${toX(data.length - 1).toFixed(1)} ${PADDING_TOP + plotHeight} L ${toX(0).toFixed(1)} ${PADDING_TOP + plotHeight} Z`;

  /**
   * De quantos em quantos pontos desenhar um rótulo.
   *
   * O primeiro e o último entram sempre — sem eles não dá para saber
   * que período o gráfico cobre —, e o passo distribui o resto.
   */
  const cabem = Math.max(
    Math.floor(WIDTH / LARGURA_POR_ROTULO),
    2
  );

  const passo = Math.max(
    Math.ceil(data.length / cabem),
    1
  );

  const ultimo = data.length - 1;

  /**
   * O último rótulo é forçado, e o anterior sai da frente se encostar.
   *
   * Medido no navegador com 30 meses: o passo caía em "Jun 26" e o
   * forçado em "Ago 26", com **cinco pixels de sobreposição**. Forçar o
   * último sem tirar o vizinho troca um empilhamento geral por um
   * empilhamento na ponta — que é onde o olho vai primeiro, porque é o
   * dado mais recente.
   */
  const vizinhoDoUltimo =
    ultimo - (ultimo % passo || passo);

  /**
   * O critério é distância em pixels, não fração do passo.
   *
   * Uma primeira tentativa usou `passo / 2` e não disparou: com 30
   * meses o passo é 3 e a sobra é 2, que não é menor que 1,5 — mas dois
   * intervalos de 24 px dão 48 px, e o rótulo precisa de 70. Comparar
   * com a largura do rótulo é a pergunta que estava sendo feita o tempo
   * todo.
   */
  const espremido =
    ultimo % passo !== 0 &&
    (ultimo - vizinhoDoUltimo) * step <
      LARGURA_POR_ROTULO;

  const mostraRotulo = (index: number) =>
    index === 0 ||
    index === ultimo ||
    (index % passo === 0 &&
      !(espremido && index === vizinhoDoUltimo));

  const ponto = ativo === null ? null : data[ativo];

  /** O cartão foge da borda: à direita nos primeiros, à esquerda no fim. */
  const cartaoAEsquerda =
    ativo !== null && toX(ativo) > WIDTH * 0.6;

  return (
    <div className="w-full overflow-x-auto">

      <div className="relative min-w-[520px]">

        <svg
          viewBox={`0 0 ${WIDTH} ${height}`}
          className="h-auto w-full"
          role="img"
          aria-label={`Evolução por período de ${totalLabel.toLowerCase()} e ${resolvedLabel.toLowerCase()}`}
          onMouseLeave={() => setAtivo(null)}
        >

          <defs>
            <linearGradient
              id={idDoGradiente}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop
                offset="0%"
                stopColor="#7C3AED"
                stopOpacity="0.18"
              />
              <stop
                offset="100%"
                stopColor="#7C3AED"
                stopOpacity="0"
              />
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

          <path
            d={area}
            fill={`url(#${idDoGradiente})`}
          />

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

          {/* Guia vertical do período sob o cursor. */}
          {ativo !== null && (
            <line
              x1={toX(ativo)}
              x2={toX(ativo)}
              y1={PADDING_TOP}
              y2={PADDING_TOP + plotHeight}
              stroke="#7C3AED"
              strokeWidth={1}
              strokeDasharray="3 3"
              opacity={0.5}
            />
          )}

          {data.map((item, index) => (
            <g key={`ponto-${item.label}-${index}`}>

              <circle
                cx={toX(index)}
                cy={toY(item.resolved)}
                r={ativo === index ? 4 : 0}
                fill="#FFFFFF"
                stroke="#22C55E"
                strokeWidth={2.5}
              />

              <circle
                cx={toX(index)}
                cy={toY(item.total)}
                r={ativo === index ? 5 : 3.5}
                fill="#FFFFFF"
                stroke="#7C3AED"
                strokeWidth={2.5}
              />

            </g>
          ))}

          {data.map((item, index) =>
            mostraRotulo(index) ? (
              <text
                key={`rotulo-${item.label}-${index}`}
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
            A faixa de captura, por período.

            Transparente e larga: acertar o mês passa a ser questão de
            estar na coluna dele, e não de acertar o ponto de três
            pixels. É o que faz o gráfico responder ao mouse em vez de
            parecer morto.
          */}
          {data.map((item, index) => (
            <rect
              key={`faixa-${item.label}-${index}`}
              x={toX(index) - (step || WIDTH) / 2}
              y={PADDING_TOP}
              width={step || WIDTH}
              height={plotHeight}
              fill="transparent"
              onMouseEnter={() => setAtivo(index)}
            />
          ))}

        </svg>

        {ponto && (
          <div
            className="pointer-events-none absolute top-2 z-10 rounded-xl border border-zinc-200 bg-white/95 px-3 py-2 text-xs shadow-lg backdrop-blur"
            style={
              cartaoAEsquerda
                ? { left: "1rem" }
                : { right: "1rem" }
            }
          >

            <div className="font-semibold text-zinc-900">
              {ponto.label}
            </div>

            <div className="mt-1.5 flex items-center gap-2 text-zinc-600">
              <span className="h-0.5 w-4 shrink-0 rounded-full bg-[#7C3AED]" />
              {totalLabel}
              <strong className="ml-auto pl-3 font-semibold text-zinc-900">
                {ponto.total}
              </strong>
            </div>

            <div className="mt-1 flex items-center gap-2 text-zinc-600">
              <span className="h-0.5 w-4 shrink-0 rounded-full border-t-2 border-dashed border-[#22C55E]" />
              {resolvedLabel}
              <strong className="ml-auto pl-3 font-semibold text-zinc-900">
                {ponto.resolved}
              </strong>
            </div>

            {/*
              A razão entre as duas séries é o que a pessoa calcularia de
              cabeça olhando o gráfico. Mostrar poupa a conta — e é o
              número que responde "está melhorando?".
            */}
            {ponto.total > 0 && (
              <div className="mt-1.5 border-t border-zinc-100 pt-1.5 text-[11px] text-zinc-500">
                {Math.round(
                  (ponto.resolved / ponto.total) * 100
                )}
                % do período
              </div>
            )}

          </div>
        )}

      </div>

      <div className="mt-3 flex items-center gap-5 text-xs text-zinc-500">

        <span className="flex items-center gap-2">
          <span className="h-0.5 w-5 rounded-full bg-[#7C3AED]" />
          {totalLabel}
        </span>

        <span className="flex items-center gap-2">
          <span className="h-0.5 w-5 rounded-full border-t-2 border-dashed border-[#22C55E]" />
          {resolvedLabel}
        </span>

        <span className="ml-auto hidden text-[11px] text-zinc-400 sm:block">
          passe o mouse para ver cada período
        </span>

      </div>

    </div>
  );
}
