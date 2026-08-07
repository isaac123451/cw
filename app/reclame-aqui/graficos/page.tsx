"use client";

import { useMemo, useState } from "react";

import { Info } from "lucide-react";

import MainLayout from "@/components/layout/MainLayout";

import PageHeading from "@/components/shared/PageHeading";
import SurfaceCard from "@/components/shared/SurfaceCard";
import MultiLineChart from "@/components/shared/MultiLineChart";

import ModuleNav from "@/components/reclame-aqui/ModuleNav";

import { useScopedCases } from "@/lib/context/useScopedCases";

import {
  ChartPeriod,
  chartPeriodLabels,
  getDailySeries,
  getMonthlyIndices,
  getRollingIndices,
} from "@/lib/services/charts.service";

import {
  ptBR,
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

  const [period, setPeriod] = useState<ChartPeriod>("12m");

  const monthly = useMemo(
    () => getMonthlyIndices(cases, period),
    [cases, period]
  );

  const rolling = useMemo(
    () => getRollingIndices(cases, period),
    [cases, period]
  );

  const daily = useMemo(
    () => getDailySeries(cases),
    [cases]
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

          <div className="flex flex-wrap items-center gap-3">

            <div className="flex items-center rounded-xl border border-zinc-200 p-1">

              {(
                Object.keys(chartPeriodLabels) as ChartPeriod[]
              ).map((key) => (

                <button
                  key={key}
                  onClick={() => setPeriod(key)}
                  className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${
                    period === key
                      ? "bg-violet-700 text-white"
                      : "text-zinc-600 hover:bg-zinc-100"
                  }`}
                >
                  {chartPeriodLabels[key]}
                </button>

              ))}

            </div>

            <p className="flex items-center gap-2 text-xs text-zinc-500">
              <Info size={13} className="text-zinc-400" />
              Meses fechados. O mês corrente entra apenas na
              série diária.
            </p>

          </div>

        </SurfaceCard>

        {/* Reputação por mês */}

        <SurfaceCard
          title="Índices por mês"
          description="Faixa de reputação calculada para cada mês isoladamente."
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
          title="Reclamações nos últimos 30 dias"
          description="Série diária, incluindo o mês corrente."
        >

          <MultiLineChart
            labels={daily.map((item) => item.label)}
            height={240}
            series={[
              {
                key: "d-reclamacoes",
                label: "Reclamações",
                color: COLORS.reclamacoes,
                values: daily.map(
                  (item) => item.received
                ),
              },
              {
                key: "d-respostas",
                label: "Respostas",
                color: COLORS.respostas,
                values: daily.map(
                  (item) => item.answered
                ),
              },
              {
                key: "d-avaliacoes",
                label: "Avaliações",
                color: COLORS.avaliacoes,
                values: daily.map(
                  (item) => item.evaluated
                ),
              },
              {
                key: "d-resolvidas",
                label: "Resolvidas",
                color: COLORS.resolvidas,
                values: daily.map(
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
