"use client";

import Link from "next/link";

import { useMemo, useState } from "react";

import {
  ArrowLeft,
  Filter,
  MessageSquare,
  Star,
  Timer,
  X,
} from "lucide-react";

import { Case } from "@/lib/models/case";

import MainLayout from "@/components/layout/MainLayout";

import PageHeading from "@/components/shared/PageHeading";
import SurfaceCard from "@/components/shared/SurfaceCard";
import PeriodPicker from "@/components/shared/PeriodPicker";

import ReputationTrend from "@/components/reclame-aqui/analytics/ReputationTrend";
import ScoreComposition from "@/components/reclame-aqui/analytics/ScoreComposition";
import ReputationFunnel from "@/components/reclame-aqui/analytics/ReputationFunnel";
import ReputationRuler from "@/components/reclame-aqui/analytics/ReputationRuler";
import RatingHistogram from "@/components/reclame-aqui/analytics/RatingHistogram";
import RankingCard from "@/components/reclame-aqui/analytics/RankingCard";
import ResponseCeiling from "@/components/reclame-aqui/analytics/ResponseCeiling";
import DisregardedNotice from "@/components/reclame-aqui/DisregardedNotice";
import GoalEditor from "@/components/reclame-aqui/analytics/GoalEditor";
import ModuleNav from "@/components/reclame-aqui/ModuleNav";

import { useScopedCases } from "@/lib/context/useScopedCases";

import {
  CustomRange,
  displayBand,
  formatElapsed,
  getBacklog,
  getRange,
  getRanking,
  getRatingDistribution,
  getReputation,
  getReputationTrend,
  inRange,
  PeriodKey,
  PeriodMode,
  ptBR,
  REFERENCE_DATE,
} from "@/lib/services/reputation.service";

const backlogTone: Record<string, string> = {
  danger: "bg-rose-50 text-rose-700 ring-rose-100",
  warning: "bg-amber-50 text-amber-700 ring-amber-100",
  info: "bg-sky-50 text-sky-700 ring-sky-100",
};

/** Filtro aplicado ao clicar em um item dos gráficos. */
type Drill = {
  field: "category" | "subcategory" | "score";
  value: string;
};

const drillFieldLabel: Record<Drill["field"], string> = {
  category: "Categoria",
  subcategory: "Subcategoria",
  score: "Faixa de nota",
};

function matchesDrill(item: Case, drill: Drill | null) {

  if (!drill) return true;

  if (drill.field === "category") {
    return item.category === drill.value;
  }

  if (drill.field === "subcategory") {
    return (item.subcategory ?? "") === drill.value;
  }

  // Faixa de nota vem como "7-8" no histograma.
  if (!item.evaluated) return false;

  const [min, max] = drill.value.split("-").map(Number);
  const score = item.score ?? 0;

  return score >= min && score <= max;
}

export default function ReclameAquiAnalyticsPage() {

  const { cases } = useScopedCases("reclame-aqui");

  const [period, setPeriod] = useState<PeriodKey>("6m");

  const [mode, setMode] = useState<PeriodMode>("vigente");

  const [custom, setCustom] = useState<CustomRange>({
    start: `${REFERENCE_DATE.slice(0, 4)}-01-01`,
    end: REFERENCE_DATE,
  });

  const range = useMemo(
    () => getRange(period, mode, custom),
    [period, mode, custom]
  );

  const [drill, setDrill] = useState<Drill | null>(null);

  /** Sem o drill: base do ranking, para as opções não sumirem ao filtrar. */
  const periodCases = useMemo(
    () =>
      cases.filter((item) =>
        inRange(item, range.start, range.end)
      ),
    [cases, range]
  );

  const current = useMemo(
    () =>
      periodCases.filter((item) =>
        matchesDrill(item, drill)
      ),
    [periodCases, drill]
  );

  const previousPeriodCases = useMemo(
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

  const previous = useMemo(
    () =>
      previousPeriodCases.filter((item) =>
        matchesDrill(item, drill)
      ),
    [previousPeriodCases, drill]
  );

  /** Clicar de novo no mesmo item remove o filtro. */
  function toggleDrill(
    field: Drill["field"],
    value: string
  ) {
    setDrill((prev) =>
      prev && prev.field === field && prev.value === value
        ? null
        : { field, value }
    );
  }

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

  /**
   * Cada gráfico ignora o filtro do próprio campo — senão, ao clicar em
   * uma categoria as outras sumiriam e não daria para trocar de filtro.
   */
  const without = useMemo(
    () => (field: Drill["field"]) =>
      drill && drill.field === field
        ? periodCases
        : current,
    [drill, periodCases, current]
  );

  /**
   * A comparação precisa ignorar o mesmo campo que o gráfico ignora,
   * senão a variação das outras categorias viraria "Sem base".
   */
  const previousWithout = useMemo(
    () => (field: Drill["field"]) =>
      drill && drill.field === field
        ? previousPeriodCases
        : previous,
    [drill, previousPeriodCases, previous]
  );

  const buckets = useMemo(
    () => getRatingDistribution(without("score")),
    [without]
  );

  const backlog = useMemo(
    () => getBacklog(current),
    [current]
  );

  const byCategory = useMemo(
    () =>
      getRanking(
        without("category"),
        previousWithout("category"),
        "category"
      ),
    [without, previousWithout]
  );

  const bySubcategory = useMemo(
    () =>
      getRanking(
        without("subcategory"),
        previousWithout("subcategory"),
        "subcategory"
      ),
    [without, previousWithout]
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

          <PeriodPicker
            period={period}
            onPeriodChange={setPeriod}
            range={range}
            custom={custom}
            onCustomChange={setCustom}
            mode={mode}
            onModeChange={setMode}
            warnUnofficial
          />

        </SurfaceCard>

        {drill && (

          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-violet-200/70 bg-violet-50/60 px-5 py-3.5">

            <Filter
              size={16}
              className="shrink-0 text-violet-600"
            />

            <p className="flex-1 text-sm text-violet-900">
              Filtrando por{" "}
              <strong className="font-semibold">
                {drillFieldLabel[drill.field]}:{" "}
                {drill.value}
              </strong>{" "}
              — {current.length} de {periodCases.length}{" "}
              reclamações do período.
            </p>

            <button
              onClick={() => setDrill(null)}
              className="flex shrink-0 items-center gap-1.5 rounded-xl border border-violet-300 bg-white px-3 py-1.5 text-xs font-medium text-violet-800 transition-colors hover:bg-violet-100"
            >
              <X size={13} />
              Limpar filtro
            </button>

          </div>

        )}

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
            onSelect={(value) =>
              toggleDrill("score", value)
            }
            active={
              drill?.field === "score"
                ? drill.value
                : undefined
            }
          />

        </div>

        <DisregardedNotice cases={current} />

        <ResponseCeiling cases={current} />

        <div className="grid gap-6 xl:grid-cols-2">

          <RankingCard
            title="Reclamações por categoria"
            description="Clique em uma categoria para filtrar toda a tela."
            hint="A variação compara com o mesmo intervalo imediatamente anterior. Vermelho significa que a categoria cresceu."
            rows={byCategory}
            onSelect={(value) =>
              toggleDrill("category", value)
            }
            active={
              drill?.field === "category"
                ? drill.value
                : undefined
            }
          />

          <RankingCard
            title="Reclamações por subcategoria"
            description="Clique para aprofundar o diagnóstico em um assunto."
            hint="Ao filtrar por categoria, esta lista passa a mostrar só as subcategorias dela."
            rows={bySubcategory}
            onSelect={(value) =>
              toggleDrill("subcategory", value)
            }
            active={
              drill?.field === "subcategory"
                ? drill.value
                : undefined
            }
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
