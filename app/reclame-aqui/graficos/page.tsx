"use client";

import { useMemo, useState } from "react";

import MainLayout from "@/components/layout/MainLayout";

import PageHeading from "@/components/shared/PageHeading";
import SurfaceCard from "@/components/shared/SurfaceCard";
import MultiLineChart from "@/components/shared/MultiLineChart";
import PeriodPicker from "@/components/shared/PeriodPicker";

import ModuleNav from "@/components/reclame-aqui/ModuleNav";

import { useScopedCases } from "@/lib/context/useScopedCases";

import {
  getCausasNoTempo,
  getDistribuicaoDeResposta,
  getMonthlyIndices,
  getRollingIndices,
  getTimeSeries,
  granularityLabels,
} from "@/lib/services/charts.service";

import {
  CustomRange,
  formatRange,
  getRange,
  PeriodKey,
  periodLabels,
  ptBR,
  hojeNaOperacao,
  scoreBands,
} from "@/lib/services/reputation.service";

const COLORS = {
  reclamacoes: "#0EA5E9",
  respostas: "#3F3F46",
  avaliacoes: "#22C55E",
  resolvidas: "#F59E0B",
  naoResolvidas: "#8B5CF6",
  voltaria: "#EC4899",
  naoVoltaria: "#EAB308",
  nota: "#F97316",
  solucao: "#22C55E",
  resposta: "#0EA5E9",
  tempo: "#0EA5E9",
};

export default function GraficosPage() {

  const { cases } = useScopedCases("reclame-aqui");

  const [period, setPeriod] = useState<PeriodKey>("12m");

  const [custom, setCustom] = useState<CustomRange>({
    start: `${hojeNaOperacao().slice(0, 4)}-01-01`,
    end: hojeNaOperacao(),
  });

  const range = useMemo(
    () => getRange(period, "vigente", custom),
    [period, custom]
  );

  const monthly = useMemo(
    () => getMonthlyIndices(cases, period, custom),
    [cases, period, custom]
  );

  const rolling = useMemo(
    () => getRollingIndices(cases, period, 12, custom),
    [cases, period, custom]
  );

  /**
   * A janela do movimento, que pode divergir da janela da página.
   *
   * O Isaac pediu "um seletor de período na parte de movimento diário".
   * O motivo é o passo do eixo: com o período em 12 meses a série é
   * agrupada por mês, e é a única leitura possível — 365 pontos diários
   * seriam ilegíveis. Só que a pergunta que se faz olhando o movimento
   * quase sempre é do dia ("o que entrou esta semana?"), enquanto a que
   * se faz nos gráficos acima é do ano.
   *
   * Trocar o período da página inteira para responder uma delas
   * derrubava a outra. Aqui a série tem a própria janela, e `null`
   * significa seguir a de cima — que continua sendo o padrão.
   */
  const [janelaDoMovimento, setJanelaDoMovimento] =
    useState<PeriodKey | null>(null);

  const rangeDoMovimento = useMemo(
    () =>
      janelaDoMovimento
        ? getRange(janelaDoMovimento, "vigente", custom)
        : range,
    [janelaDoMovimento, custom, range]
  );

  /**
   * Série temporal da janela do movimento, incluindo o mês corrente —
   * que os gráficos mensais deixam de fora por só contarem meses
   * fechados.
   *
   * O passo se ajusta à janela (dia, semana ou mês): 365 pontos diários
   * num gráfico dessa largura seriam ilegíveis.
   */
  const daily = useMemo(
    () => getTimeSeries(cases, rangeDoMovimento),
    [cases, rangeDoMovimento]
  );

  /**
   * A distribuição dos tempos de resposta, e não a média deles.
   *
   * A média esconde a cauda: 100 respostas em 2 h e 5 em 40 dias dão
   * uma média confortável, e os cinco abandonados somem dela.
   */
  const distribuicao = useMemo(
    () => getDistribuicaoDeResposta(cases, range),
    [cases, range]
  );

  /**
   * As cinco maiores causas, mês a mês.
   *
   * O ranking responde "qual é o maior problema"; esta série responde
   * "qual está crescendo", que é a pergunta que muda o que a operação
   * faz na semana seguinte.
   */
  const causas = useMemo(
    () => getCausasNoTempo(cases, range),
    [cases, range]
  );

  const labels = monthly.map((item) => item.label);

  /** Uma cor por causa, estável enquanto a ordem não muda. */
  const CORES_DE_CAUSA = [
    "#8B5CF6",
    "#0EA5E9",
    "#F59E0B",
    "#22C55E",
    "#EC4899",
  ];

  /** Minutos → "2 h", "3 dias", "1 mês e 4 dias". */
  function emTexto(minutos: number | null) {

    if (minutos === null) return "—";

    if (minutos < 60) return `${minutos} min`;

    if (minutos < 1440) {
      return `${Math.round(minutos / 60)} h`;
    }

    const dias = Math.round(minutos / 1440);

    return dias === 1 ? "1 dia" : `${dias} dias`;
  }

  return (
    <MainLayout>

      <div className="space-y-5">

        <PageHeading
          eyebrow="Reclame Aqui"
          title="Gráficos e dados"
          description="Leitura aprofundada dos índices, mês a mês e em janela móvel de 12 meses."
        />

        <ModuleNav />

        <SurfaceCard bodyClassName="p-4">

          <PeriodPicker
            period={period}
            onPeriodChange={setPeriod}
            range={range}
            custom={custom}
            onCustomChange={setCustom}
            note={
              period === "custom"
                ? "Meses tocados pelo intervalo escolhido."
                : "Meses fechados. O mês corrente entra apenas na série diária."
            }
          />

        </SurfaceCard>

        {/* Reputação por mês */}

        <SurfaceCard
          title="Índices por mês"
          description="Faixa de reputação calculada para cada mês isoladamente."
          hint="Cada barra recalcula a fórmula oficial usando só as reclamações daquele mês. Serve para ver a variação, não a nota pública — que sempre olha 6 ou 12 meses."
        >

          <div className="mb-4 flex flex-wrap gap-1.5">

            {[...scoreBands].reverse().map((band) => (

              <span
                key={band.label}
                className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-medium"
                style={{
                  background: `${band.color}18`,
                  color: band.color,
                }}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: band.color }}
                />
                {band.label}
              </span>

            ))}

          </div>

          <div className="overflow-x-auto">

            <div className="flex min-w-[640px] items-end gap-2">

              {monthly.map((item) => (

                <div
                  key={item.key}
                  className="flex flex-1 flex-col items-center"
                  title={`${item.label}: ${item.band} (${ptBR(
                    item.raScore
                  )})`}
                >

                  <span className="mb-1.5 text-[11px] font-semibold tabular-nums text-zinc-600">
                    {item.received === 0
                      ? "—"
                      : ptBR(item.raScore)}
                  </span>

                  <div
                    className="w-full rounded-t-lg transition-all"
                    style={{
                      height: `${Math.max(
                        (item.raScore / 10) * 150,
                        4
                      )}px`,
                      background:
                        item.received === 0
                          ? "#E4E4E7"
                          : item.bandColor,
                    }}
                  />

                  <span className="mt-2 text-[10px] text-zinc-400">
                    {item.label}
                  </span>

                </div>

              ))}

            </div>

          </div>

        </SurfaceCard>

        {/* Nota final */}

        <SurfaceCard
          title="Nota final da reputação"
          description="Nota RA de cada mês, na escala de 0 a 10."
          hint="Mesma apuração da barra acima, em linha, para enxergar tendência. Meses sem reclamação aparecem como zero."
        >

          <MultiLineChart
            labels={labels}
            max={10}
            showValues
            series={[
              {
                key: "nota",
                label: "Nota RA",
                color: COLORS.nota,
                values: monthly.map(
                  (item) => item.raScore
                ),
              },
            ]}
          />

        </SurfaceCard>

        {/* Índices em porcentagem */}

        <SurfaceCard
          title="Índices por mês (porcentagem)"
          description="Resposta, solução, intenção de retorno e nota do consumidor."
          hint="Os quatro indicadores que compõem a nota, com pesos 20%, 30%, 30% e 20%. A nota do consumidor é multiplicada por 10 para caber na mesma escala."
        >

          <MultiLineChart
            labels={labels}
            max={100}
            suffix="%"
            series={[
              {
                key: "resposta",
                label: "Índice de resposta",
                color: COLORS.resposta,
                values: monthly.map(
                  (item) => item.responseIndex
                ),
              },
              {
                key: "voltaria",
                label: "Voltaria a fazer negócio",
                color: COLORS.respostas,
                values: monthly.map(
                  (item) => item.wouldReturnIndex
                ),
              },
              {
                key: "solucao",
                label: "Índice de solução",
                color: COLORS.solucao,
                values: monthly.map(
                  (item) => item.solutionIndex
                ),
              },
              {
                key: "nota",
                label: "Nota do consumidor (×10)",
                color: COLORS.nota,
                values: monthly.map(
                  (item) => item.consumerScore * 10
                ),
              },
            ]}
          />

        </SurfaceCard>

        {/* Índices em quantidade */}

        <SurfaceCard
          title="Índices por mês (quantidade)"
          description="Volumes absolutos de cada etapa da tratativa."
          hint="Contagem bruta por mês. A diferença entre reclamações e respostas é o que derruba o índice de resposta."
        >

          <MultiLineChart
            labels={labels}
            series={[
              {
                key: "reclamacoes",
                label: "Reclamações",
                color: COLORS.reclamacoes,
                values: monthly.map(
                  (item) => item.received
                ),
              },
              {
                key: "respostas",
                label: "Respostas",
                color: COLORS.respostas,
                values: monthly.map(
                  (item) => item.answered
                ),
              },
              {
                key: "avaliacoes",
                label: "Avaliações",
                color: COLORS.avaliacoes,
                values: monthly.map(
                  (item) => item.evaluated
                ),
              },
              {
                key: "resolvidas",
                label: "Resolvidas",
                color: COLORS.resolvidas,
                values: monthly.map(
                  (item) => item.resolved
                ),
              },
              {
                key: "naoResolvidas",
                label: "Não resolvidas",
                color: COLORS.naoResolvidas,
                values: monthly.map(
                  (item) => item.notResolved
                ),
              },
              {
                key: "voltaria",
                label: "Voltaria",
                color: COLORS.voltaria,
                values: monthly.map(
                  (item) => item.wouldReturn
                ),
              },
              {
                key: "naoVoltaria",
                label: "Não voltaria",
                color: COLORS.naoVoltaria,
                values: monthly.map(
                  (item) => item.wouldNotReturn
                ),
              },
            ]}
          />

        </SurfaceCard>

        {/* Tempo de resposta */}

        <SurfaceCard
          title="Tempo de resposta"
          description="Média de dias entre o registro e a primeira resposta, por mês."
          hint="Só entram reclamações que já foram respondidas. Não afeta a nota diretamente, mas atrasos costumam virar réplica e nota baixa."
        >

          <MultiLineChart
            labels={labels}
            suffix=" d"
            showValues
            series={[
              {
                key: "tempo",
                label: "Tempo de resposta (dias)",
                color: COLORS.tempo,
                values: monthly.map(
                  (item) => item.responseDays
                ),
              },
            ]}
          />

        </SurfaceCard>

        {/* Janela móvel */}

        <SurfaceCard
          title="Evolução dos índices em 12 meses (porcentagem)"
          description="Cada ponto acumula os 12 meses anteriores — é assim que a reputação vigente é apurada."
          hint="É a leitura que mais se aproxima do painel do Reclame Aqui: cada ponto é a nota que estaria valendo naquele mês."
        >

          <MultiLineChart
            labels={rolling.map((item) => item.label)}
            max={100}
            suffix="%"
            series={[
              {
                key: "r-resposta",
                label: "Índice de resposta",
                color: COLORS.resposta,
                values: rolling.map(
                  (item) => item.responseIndex
                ),
              },
              {
                key: "r-voltaria",
                label: "Voltaria a fazer negócio",
                color: COLORS.respostas,
                values: rolling.map(
                  (item) => item.wouldReturnIndex
                ),
              },
              {
                key: "r-solucao",
                label: "Índice de solução",
                color: COLORS.solucao,
                values: rolling.map(
                  (item) => item.solutionIndex
                ),
              },
              {
                key: "r-nota",
                label: "Nota do consumidor (×10)",
                color: COLORS.nota,
                values: rolling.map(
                  (item) => item.consumerScore * 10
                ),
              },
            ]}
          />

        </SurfaceCard>

        <SurfaceCard
          title="Evolução dos índices em 12 meses (quantidade)"
          description="Volume acumulado da janela móvel de 12 meses."
          hint="Mesma janela móvel, em quantidade. Útil para ver se o volume está crescendo mais rápido que a capacidade de resposta."
        >

          <MultiLineChart
            labels={rolling.map((item) => item.label)}
            series={[
              {
                key: "q-reclamacoes",
                label: "Reclamações",
                color: COLORS.reclamacoes,
                values: rolling.map(
                  (item) => item.received
                ),
              },
              {
                key: "q-respostas",
                label: "Respostas",
                color: COLORS.respostas,
                values: rolling.map(
                  (item) => item.answered
                ),
              },
              {
                key: "q-avaliacoes",
                label: "Avaliações",
                color: COLORS.avaliacoes,
                values: rolling.map(
                  (item) => item.evaluated
                ),
              },
              {
                key: "q-resolvidas",
                label: "Resolvidas",
                color: COLORS.resolvidas,
                values: rolling.map(
                  (item) => item.resolved
                ),
              },
              {
                key: "q-voltaria",
                label: "Voltaria",
                color: COLORS.voltaria,
                values: rolling.map(
                  (item) => item.wouldReturn
                ),
              },
            ]}
          />

        </SurfaceCard>

        <SurfaceCard
          title="Tempo de resposta acumulado"
          description="Média da janela móvel de 12 meses."
          hint="Suaviza picos de um mês isolado e mostra a tendência real do tempo de atendimento."
        >

          <MultiLineChart
            labels={rolling.map((item) => item.label)}
            suffix=" d"
            showValues
            series={[
              {
                key: "r-tempo",
                label: "Tempo acumulado (dias)",
                color: COLORS.tempo,
                values: rolling.map(
                  (item) => item.responseDays
                ),
              },
            ]}
          />

        </SurfaceCard>

        {/* Distribuição do tempo de resposta */}

        <SurfaceCard
          title="Quanto tempo o consumidor esperou"
          description={
            distribuicao.medidas === 0
              ? "Nenhuma reclamação respondida com tempo registrado neste período."
              : `${distribuicao.medidas} resposta(s) com tempo medido. Metade saiu em até ${emTexto(distribuicao.mediana)}; a pior levou ${emTexto(distribuicao.pior)}.`
          }
          hint="A média some com a cauda: 100 respostas em 2 h e 5 em 40 dias dão uma média de menos de dois dias, e os cinco consumidores abandonados desaparecem dela. Aqui cada faixa é uma experiência diferente, e a última é a que gera avaliação baixa mesmo com a resposta certa."
        >

          {distribuicao.medidas === 0 ? (

            <p className="rounded-xl border border-dashed border-zinc-200 py-10 text-center text-sm text-zinc-400">
              Sem tempo de resposta registrado neste
              período.
            </p>

          ) : (

            <div className="space-y-2.5">

              {distribuicao.faixas.map((faixa) => (

                <div
                  key={faixa.label}
                  className="flex items-center gap-3"
                  title={faixa.hint}
                >

                  <span className="w-28 shrink-0 text-xs font-medium text-zinc-600">
                    {faixa.label}
                  </span>

                  <span className="h-6 flex-1 overflow-hidden rounded-lg bg-zinc-100">
                    <span
                      className="block h-full rounded-lg transition-all"
                      style={{
                        width: `${Math.max(faixa.parte, faixa.quantidade > 0 ? 2 : 0)}%`,
                        background: faixa.color,
                      }}
                    />
                  </span>

                  <span className="w-24 shrink-0 text-right text-xs tabular-nums text-zinc-500">
                    <span className="font-semibold text-zinc-800">
                      {faixa.quantidade}
                    </span>{" "}
                    ({faixa.parte.toFixed(0)}%)
                  </span>

                </div>

              ))}

              {/*
                As respondidas sem tempo registrado ficam fora da conta,
                e o cartão diz isso. Um percentual calculado sobre uma
                base menor do que a pessoa imagina é pior do que não ter
                percentual.
              */}
              {distribuicao.semMedida > 0 && (
                <p className="pt-1 text-[11px] text-zinc-400">
                  {distribuicao.semMedida} resposta(s)
                  ficaram fora: foram publicadas, mas sem
                  tempo registrado na importação.
                </p>
              )}

            </div>

          )}

        </SurfaceCard>

        {/* Causas ao longo do tempo */}

        <SurfaceCard
          title="Principais causas, mês a mês"
          description={
            causas.series.length === 0
              ? "Nenhuma reclamação categorizada neste período."
              : `As ${causas.series.length} maiores categorias do período${causas.outras > 0 ? `, de ${causas.outras + causas.series.length} no total` : ""}.`
          }
          hint="O ranking responde qual é o maior problema; esta série responde qual está crescendo — que é a pergunta que muda o trabalho da semana seguinte. Uma categoria que dobrou em dois meses merece ação mesmo em terceiro lugar absoluto."
        >

          {causas.series.length === 0 ? (

            <p className="rounded-xl border border-dashed border-zinc-200 py-10 text-center text-sm text-zinc-400">
              Sem categorias para exibir neste período.
            </p>

          ) : (

            <MultiLineChart
              labels={causas.labels}
              height={240}
              series={causas.series.map(
                (serie, i) => ({
                  key: `causa-${i}`,
                  label: serie.categoria,
                  color:
                    CORES_DE_CAUSA[
                      i % CORES_DE_CAUSA.length
                    ],
                  values: serie.valores,
                })
              )}
            />

          )}

        </SurfaceCard>

        {/* Diário */}

        <SurfaceCard
          title={`Movimento ${granularityLabels[daily.granularity]}`}
          description={`${formatRange(rangeDoMovimento.start, rangeDoMovimento.end)} — ${
            janelaDoMovimento
              ? "janela própria desta série"
              : "segue o período selecionado acima"
          } e inclui o mês corrente.`}
          hint="Diferente dos gráficos mensais, esta série entra no mês corrente ainda aberto. O passo do eixo acompanha o tamanho da janela: por dia até 60 dias, por semana até 7 meses, por mês acima disso — 365 pontos diários seriam ilegíveis."
          action={
            /*
              Janela própria, porque o passo do eixo depende dela.

              Em 12 meses esta série é agrupada por mês; para ver
              movimento por dia é preciso uma janela curta, e mudar o
              período da página só para isso derruba todos os gráficos
              acima. "Período da página" devolve o comportamento
              anterior, que segue sendo o padrão.
            */
            <div className="flex min-w-0 flex-wrap items-center gap-1">

              {(
                [null, "30d", "3m", "6m", "12m"] as const
              ).map((chave) => {

                const ativo = janelaDoMovimento === chave;

                return (
                  <button
                    key={chave ?? "pagina"}
                    type="button"
                    onClick={() =>
                      setJanelaDoMovimento(chave)
                    }
                    title={
                      chave
                        ? `Ver o movimento dos últimos ${periodLabels[chave]}`
                        : "Voltar a acompanhar o período escolhido no topo da página"
                    }
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                      ativo
                        ? "bg-violet-600 text-white"
                        : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
                    }`}
                  >
                    {chave
                      ? periodLabels[chave]
                      : "Período da página"}
                  </button>
                );
              })}

            </div>
          }
        >

          <MultiLineChart
            labels={daily.points.map((item) => item.label)}
            height={240}
            series={[
              {
                key: "d-reclamacoes",
                label: "Reclamações",
                color: COLORS.reclamacoes,
                values: daily.points.map(
                  (item) => item.received
                ),
              },
              {
                key: "d-respostas",
                label: "Respostas",
                color: COLORS.respostas,
                values: daily.points.map(
                  (item) => item.answered
                ),
              },
              {
                key: "d-avaliacoes",
                label: "Avaliações",
                color: COLORS.avaliacoes,
                values: daily.points.map(
                  (item) => item.evaluated
                ),
              },
              {
                key: "d-resolvidas",
                label: "Resolvidas",
                color: COLORS.resolvidas,
                values: daily.points.map(
                  (item) => item.resolved
                ),
              },
            ]}
          />

        </SurfaceCard>

      </div>

    </MainLayout>
  );
}
