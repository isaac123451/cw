"use client";

import Link from "next/link";

import { useMemo, useState } from "react";

import {
  ArrowLeft,
  CalendarDays,
  MessageSquare,
  Star,
  Timer,
} from "lucide-react";

import MainLayout from "@/components/layout/MainLayout";

import PageHeading from "@/components/shared/PageHeading";
import SurfaceCard from "@/components/shared/SurfaceCard";

import ReputationTrend from "@/components/reclame-aqui/analytics/ReputationTrend";
import ScoreComposition from "@/components/reclame-aqui/analytics/ScoreComposition";
import ReputationFunnel from "@/components/reclame-aqui/analytics/ReputationFunnel";
import ReputationRuler from "@/components/reclame-aqui/analytics/ReputationRuler";
import RatingHistogram from "@/components/reclame-aqui/analytics/RatingHistogram";
import RankingCard from "@/components/reclame-aqui/analytics/RankingCard";
import GoalEditor from "@/components/reclame-aqui/analytics/GoalEditor";
import ModuleNav from "@/components/reclame-aqui/ModuleNav";

import { useScopedCases } from "@/lib/context/useScopedCases";

import {
  displayBand,
  formatElapsed,
  formatRange,
  getBacklog,
  getRange,
  getRanking,
  getRatingDistribution,
  getReputation,
  getReputationTrend,
  inRange,
  PeriodKey,
  periodLabels,
  PeriodMode,
  periodModeLabels,
  ptBR,
} from "@/lib/services/reputation.service";

const backlogTone: Record<string, string> = {
  danger: "bg-rose-50 text-rose-700 ring-rose-100",
  warning: "bg-amber-50 text-amber-700 ring-amber-100",
  info: "bg-sky-50 text-sky-700 ring-sky-100",
};

export default function ReclameAquiAnalyticsPage() {

  const { cases } = useScopedCases("reclame-aqui");

  const [period, setPeriod] = useState<PeriodKey>("6m");

  const [mode, setMode] = useState<PeriodMode>("vigente");

  const range = useMemo(
    () => getRange(period, mode),
    [period, mode]
  );

  const current = useMemo(
    () =>
      cases.filter((item) =>
        inRange(item, range.start, range.end)
      ),
    [cases, range]
  );

  const previous = useMemo(
    () =>
      cases.filter((item) =>
        inRange(
          item,
          range.previousStart,
          range.previousEnd
        )
      ),
    [cases, range]
  );

  const summary = useMemo(
    () => getReputation(current),
    [current]
  );

  const previousSummary = useMemo(
    () => getReputation(previous),
    [previous]
  );

  const trend = useMemo(
    () => getReputationTrend(current),
    [current]
  );

  const buckets = useMemo(
    () => getRatingDistribution(current),
    [current]
  );

  const backlog = useMemo(
    () => getBacklog(current),
    [current]
  );

  const byCategory = useMemo(
    () => getRanking(current, previous, "category"),
    [current, previous]
  );

  const bySubcategory = useMemo(
    () => getRanking(current, previous, "subcategory"),
    [current, previous]
  );

  const band = displayBand(summary);

  /** Sem reclamações no período anterior não há comparação honesta. */
  const scoreDelta =
    previous.length === 0
      ? null
      : Math.round(
          (summary.raScore - previousSummary.raScore) * 10
        ) / 10;

  return (
    <MainLayout>

      <div className="space-y-6">

        <Link
          href="/reclame-aqui"
          className="inline-flex items-center gap-2 text-sm font-medium text-zinc-500 transition-colors hover:text-violet-600"
        >
          <ArrowLeft size={16} />
          Voltar para o quadro
        </Link>

        <PageHeading
          eyebrow="Reclame Aqui"
          title="Analytics de reputação"
          description="Nota RA, composição dos indicadores e diagnóstico das reclamações."
        />

        <ModuleNav />

        <SurfaceCard bodyClassName="p-4">

          <div className="flex flex-wrap items-center gap-3">

            <div className="flex flex-wrap items-center gap-2">

              {(
                Object.keys(periodLabels) as PeriodKey[]
              ).map((key) => (

                <button
                  key={key}
                  onClick={() => setPeriod(key)}
                  className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                    period === key
                      ? "bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-200"
                      : "text-zinc-600 ring-1 ring-inset ring-zinc-200 hover:bg-zinc-50"
                  }`}
                >
                  {periodLabels[key]}
                </button>

              ))}

            </div>

            <div className="flex items-center rounded-xl border border-zinc-200 p-1">

              {(
                Object.keys(periodModeLabels) as PeriodMode[]
              ).map((key) => (

                <button
                  key={key}
                  onClick={() => setMode(key)}
                  title={
                    key === "vigente"
                      ? "Janela de meses fechados que o Reclame Aqui considera hoje"
                      : "A mesma janela deslocada um mês, quando o mês atual fechar"
                  }
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    mode === key
                      ? "bg-violet-700 text-white"
                      : "text-zinc-600 hover:bg-zinc-100"
                  }`}
                >
                  {periodModeLabels[key]}
                </button>

              ))}

            </div>

          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-zinc-100 pt-3 text-xs text-zinc-500">

            <span className="flex items-center gap-2">

              <CalendarDays size={14} className="text-zinc-400" />

              Período:{" "}
              <strong className="font-semibold text-zinc-700">
                {formatRange(range.start, range.end)}
              </strong>

            </span>

            <span>
              Comparação:{" "}
              {formatRange(
                range.previousStart,
                range.previousEnd
              )}
            </span>

            {range.partial && (
              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700 ring-1 ring-inset ring-amber-100">
                Mês corrente ainda aberto — parcial
              </span>
            )}

          </div>

        </SurfaceCard>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

          <div title="Nota calculada pela fórmula oficial do Reclame Aqui sobre a janela selecionada."
            className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]"
          >

            <div className="flex items-start justify-between gap-3">

              <p className="text-sm font-medium text-zinc-600">
                Reputação atual
              </p>

              <span
                className="rounded-full px-2.5 py-1 text-[11px] font-semibold text-white"
                style={{ background: band.color }}
              >
                {band.label}
              </span>

            </div>

            <p className="mt-3 text-4xl font-semibold tracking-tight tabular-nums text-zinc-900">
              {ptBR(summary.raScore)}
              <span className="ml-1.5 text-base font-normal text-zinc-400">
                / 10
              </span>
            </p>

            {scoreDelta === null ? (

              <p className="mt-2 text-xs font-medium text-zinc-400">
                Sem base no período anterior
              </p>

            ) : (

              <p
                className={`mt-2 text-xs font-semibold ${
                  scoreDelta >= 0
                    ? "text-emerald-600"
                    : "text-rose-600"
                }`}
              >
                {scoreDelta >= 0 ? "+" : "-"}
                {ptBR(Math.abs(scoreDelta))} vs período
                comparado
              </p>

            )}

          </div>

          <div title="Volume recebido no período, separando o que já teve resposta pública."
            className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]"
          >

            <p className="text-sm font-medium text-zinc-600">
              Reclamações
            </p>

            <p className="mt-3 text-4xl font-semibold tabular-nums text-zinc-900">
              {summary.received}
            </p>

            <div className="mt-3 space-y-1.5">

              <p className="flex items-center gap-2 text-xs text-zinc-600">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <strong className="font-semibold">
                  {summary.answered}
                </strong>
                respondidas
              </p>

              <p className="flex items-center gap-2 text-xs text-zinc-600">
                <span className="h-2 w-2 rounded-full bg-rose-500" />
                <strong className="font-semibold">
                  {summary.unanswered}
                </strong>
                não respondidas
              </p>

            </div>

          </div>

          <div title="Média entre a data da reclamação e a primeira resposta pública."
            className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]"
          >

            <p className="flex items-center gap-2 text-sm font-medium text-zinc-600">
              <Timer size={15} className="text-zinc-400" />
              Tempo médio de resposta
            </p>

            <p className="mt-3 text-2xl font-semibold tabular-nums text-zinc-900">
              {formatElapsed(summary.responseMinutes)}
            </p>

            <p className="mt-3 text-xs leading-relaxed text-zinc-500">
              Índice de resposta:{" "}
              <strong className="font-semibold text-zinc-700">
                {ptBR(summary.responseIndex)}%
              </strong>{" "}
              · base de {summary.received} reclamações
            </p>

          </div>

          <div title="Consumidores que avaliaram o atendimento — base dos índices de solução e retorno."
            className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]"
          >

            <p className="flex items-center gap-2 text-sm font-medium text-zinc-600">
              <Star size={15} className="text-zinc-400" />
              Avaliações
            </p>

            <p className="mt-3 text-4xl font-semibold tabular-nums text-zinc-900">
              {summary.evaluated}
            </p>

            <p className="mt-3 text-xs text-zinc-500">
              Taxa de avaliações:{" "}
              <strong className="font-semibold text-zinc-700">
                {ptBR(summary.evaluationRate)}%
              </strong>
            </p>

          </div>

        </div>

        <GoalEditor />

        <div className="grid gap-6 xl:grid-cols-2">

          <ReputationTrend data={trend} />

          <ScoreComposition summary={summary} />

        </div>

        <div className="grid gap-6 xl:grid-cols-3">

          <div className="xl:col-span-2">
            <ReputationFunnel summary={summary} />
          </div>

          <SurfaceCard
            title="Backlog crítico"
            description="Alertas para leitura rápida das urgências operacionais."
          >

            <ul className="space-y-2.5">

              {backlog.map((alert) => (

                <li
                  key={alert.label}
                  className="flex items-center gap-3 rounded-xl border border-zinc-100 px-4 py-3"
                >

                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ring-1 ring-inset ${
                      backlogTone[alert.tone]
                    }`}
                  >
                    {alert.count}
                  </span>

                  <span className="min-w-0 flex-1 truncate text-sm text-zinc-700">
                    {alert.label}
                  </span>

                  <span className="shrink-0 text-xs font-medium text-zinc-400">
                    {alert.hint}
                  </span>

                </li>

              ))}

            </ul>

          </SurfaceCard>

        </div>

        <div className="grid gap-6 xl:grid-cols-2">

          <ReputationRuler summary={summary} />

          <RatingHistogram
            buckets={buckets}
            summary={summary}
          />

        </div>

        <div className="grid gap-6 xl:grid-cols-2">

          <RankingCard
            title="Reclamações por categoria"
            description="Ranking de categorias com peso relativo no período."
            rows={byCategory}
          />

          <RankingCard
            title="Reclamações por subcategoria"
            description="Subcategorias mais recorrentes para aprofundar o diagnóstico."
            rows={bySubcategory}
          />

        </div>

        <SurfaceCard bodyClassName="p-4">

          <p className="flex items-center gap-2 text-xs text-zinc-500">
            <MessageSquare size={14} className="text-zinc-400" />
            Indicadores calculados apenas com reclamações que
            possuem o campo correspondente preenchido.
          </p>

        </SurfaceCard>

      </div>

    </MainLayout>
  );
}
