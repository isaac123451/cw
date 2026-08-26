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
   * Série temporal do período escolhido, incluindo o mês corrente —
   * que os gráficos mensais deixam de fora por só contarem meses
   * fechados.
   *
   * O passo se ajusta à janela (dia, semana ou mês): 365 pontos diários
   * num gráfico dessa largura seriam ilegíveis.
   */
  const daily = useMemo(
    () => getTimeSeries(cases, range),
    [cases, range]
  );

  const labels = monthly.map((item) => item.label);

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

        {/* Diário */}

        <SurfaceCard
          title={`Movimento ${granularityLabels[daily.granularity]}`}
          description={`${formatRange(range.start, range.end)} — segue o período selecionado acima e inclui o mês corrente.`}
          hint="Diferente dos gráficos mensais, esta série entra no mês corrente ainda aberto. O passo do eixo acompanha o tamanho da janela: por dia até 60 dias, por semana até 7 meses, por mês acima disso — 365 pontos diários seriam ilegíveis."
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
