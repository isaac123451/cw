"use client";

import { useMemo, useState } from "react";

import {
  Building2,
  CheckCircle2,
  Inbox,
  Star,
  Timer,
} from "lucide-react";

import { useCases } from "@/lib/context/CaseContext";

import {
  getMetrics,
  getMonthlyTrend,
  groupBy,
} from "@/lib/services/case.service";

import {
  byChannelSummary,
  byOwner,
  byRegion,
  responseBuckets,
} from "@/lib/services/operations.service";

import {
  formatElapsed,
  ptBR,
} from "@/lib/services/reputation.service";

import PageHeading from "@/components/shared/PageHeading";
import StatTile from "@/components/shared/StatTile";
import SurfaceCard from "@/components/shared/SurfaceCard";
import BarList from "@/components/shared/BarList";
import TrendChart from "@/components/shared/TrendChart";

interface Props {
  eyebrow?: string;
  title?: string;
  description?: string;
}

export default function AnalyticsOverview({
  eyebrow = "Inteligência",
  title = "Analytics da operação",
  description = "Visão consolidada de todos os canais: volume, produtividade, causas e tempo de resposta.",
}: Props) {

  const { cases } = useCases();

  const [regiao, setRegiao] = useState<"state" | "city">(
    "state"
  );

  const metrics = useMemo(
    () => getMetrics(cases),
    [cases]
  );

  const trend = useMemo(
    () => getMonthlyTrend(cases),
    [cases]
  );

  const canais = useMemo(
    () => byChannelSummary(cases),
    [cases]
  );

  const responsaveis = useMemo(
    () => byOwner(cases),
    [cases]
  );

  const regioes = useMemo(
    () => byRegion(cases, regiao),
    [cases, regiao]
  );

  const tempos = useMemo(
    () => responseBuckets(cases),
    [cases]
  );

  const byCategory = useMemo(
    () => groupBy(cases, "category"),
    [cases]
  );

  const bySubcategory = useMemo(
    () => groupBy(cases, "subcategory"),
    [cases]
  );

  const byStatus = useMemo(
    () => groupBy(cases, "status"),
    [cases]
  );

  const tempoMedio = useMemo(() => {
    const total = tempos.reduce(
      (sum, item) => sum + item.value,
      0
    );
    return total;
  }, [tempos]);

  return (
    <div className="space-y-6">

      <PageHeading
        eyebrow={eyebrow}
        title={title}
        description={description}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">

        <StatTile
          label="Total de casos"
          description="Todas as ocorrências registradas, somando os canais."
          value={metrics.total}
          hint="na base"
          icon={Timer}
          tone="info"
        />

        <StatTile
          label="Na fila"
          description="Casos que ainda dependem de ação da operação."
          value={metrics.open}
          hint="dependem do time"
          icon={Inbox}
          tone="warning"
        />

        <StatTile
          label="Índice de solução"
          description="Percentual de casos encerrados com solução confirmada."
          value={`${metrics.solutionRate}%`}
          hint={`${metrics.resolved} resolvidos`}
          icon={CheckCircle2}
          tone="success"
        />

        <StatTile
          label="Nota média"
          description="Média das notas dadas pelo consumidor, de 0 a 10."
          value={ptBR(metrics.averageScore)}
          hint="escala de 0 a 10"
          icon={Star}
          tone="warning"
        />

        <StatTile
          label="Clientes atendidos"
          description="Clientes distintos com ocorrência registrada."
          value={metrics.companies}
          hint="base ativa"
          icon={Building2}
          tone="primary"
        />

      </div>

      {/* Comparação entre canais */}

      <SurfaceCard
        title="Comparação entre canais"
        description="Como cada frente se comporta — volume, resolução e tempo de resposta."
        bodyClassName="p-0"
      >

        <div className="overflow-x-auto">

          <table className="min-w-full">

            <thead className="bg-zinc-50">

              <tr>

                {[
                  "Canal",
                  "Casos",
                  "Na fila",
                  "Resolvidos",
                  "Taxa",
                  "Nota média",
                  "Tempo de resposta",
                ].map((head) => (
                  <th
                    key={head}
                    className="whitespace-nowrap px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500"
                  >
                    {head}
                  </th>
                ))}

              </tr>

            </thead>

            <tbody className="divide-y divide-zinc-100">

              {canais.map((item) => {

                const taxa =
                  item.total === 0
                    ? 0
                    : Math.round(
                        (item.resolved / item.total) * 100
                      );

                return (
                  <tr key={item.channel} className="text-sm">

                    <td className="whitespace-nowrap px-5 py-3 font-medium text-zinc-800">
                      {item.channel}
                    </td>

                    <td className="px-5 py-3 tabular-nums text-zinc-700">
                      {item.total}
                    </td>

                    <td className="px-5 py-3 tabular-nums text-zinc-700">
                      {item.open}
                    </td>

                    <td className="px-5 py-3 tabular-nums text-zinc-700">
                      {item.resolved}
                    </td>

                    <td className="px-5 py-3">

                      <div className="flex items-center gap-2">

                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-zinc-100">
                          <div
                            className="h-full rounded-full bg-emerald-500"
                            style={{ width: `${taxa}%` }}
                          />
                        </div>

                        <span className="text-xs font-semibold tabular-nums text-zinc-700">
                          {taxa}%
                        </span>

                      </div>

                    </td>

                    <td className="px-5 py-3 tabular-nums text-zinc-700">
                      {ptBR(item.averageScore)}
                    </td>

                    <td className="whitespace-nowrap px-5 py-3 text-zinc-600">
                      {formatElapsed(item.responseMinutes)}
                    </td>

                  </tr>
                );
              })}

            </tbody>

          </table>

        </div>

      </SurfaceCard>

      <SurfaceCard
        title="Evolução histórica"
        description="Volume recebido e resolvido mês a mês, somando os canais."
      >
        <TrendChart data={trend} height={240} />
      </SurfaceCard>

      {/* Produtividade */}

      <SurfaceCard
        title="Produtividade por responsável"
        description="Carga, taxa de resolução e nota média de cada agente."
        bodyClassName="p-0"
      >

        {responsaveis.length === 0 ? (

          <p className="py-10 text-center text-sm text-zinc-400">
            Nenhum responsável atribuído ainda.
          </p>

        ) : (

          <ul className="divide-y divide-zinc-100">

            {responsaveis.map((item) => (

              <li
                key={item.owner}
                className="flex items-center gap-4 px-6 py-4"
              >

                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-50 text-xs font-semibold text-violet-700">
                  {item.owner
                    .split(" ")
                    .map((part) => part[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase()}
                </span>

                <div className="min-w-0 flex-1">

                  <p className="truncate text-sm font-medium text-zinc-800">
                    {item.owner}
                  </p>

                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-zinc-100">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-[width]"
                      style={{
                        width: `${item.resolutionRate}%`,
                      }}
                    />
                  </div>

                </div>

                <div className="hidden shrink-0 gap-6 sm:flex">

                  {[
                    { label: "Casos", value: item.total },
                    { label: "Na fila", value: item.open },
                    {
                      label: "Resolução",
                      value: `${item.resolutionRate}%`,
                    },
                    {
                      label: "Nota",
                      value: ptBR(item.averageScore),
                    },
                  ].map((stat) => (

                    <div
                      key={stat.label}
                      className="text-right"
                    >

                      <p className="text-[10px] uppercase tracking-wide text-zinc-400">
                        {stat.label}
                      </p>

                      <p className="text-sm font-semibold tabular-nums text-zinc-900">
                        {stat.value}
                      </p>

                    </div>

                  ))}

                </div>

              </li>

            ))}

          </ul>

        )}

      </SurfaceCard>

      {/* Tempo de resposta */}

      <div className="grid gap-6 lg:grid-cols-2">

        <SurfaceCard
          title="Tempo até a primeira resposta"
          description={`Distribuição de ${tempoMedio} caso(s) com resposta registrada.`}
        >

          <ul className="space-y-4">

            {tempos.map((item) => (

              <li key={item.label}>

                <div className="mb-1.5 flex items-baseline justify-between gap-3">

                  <span className="text-sm font-medium text-zinc-700">
                    {item.label}
                  </span>

                  <span className="flex items-baseline gap-1.5 text-sm font-semibold tabular-nums text-zinc-900">
                    {item.value}
                    <span className="text-xs font-normal text-zinc-400">
                      ({item.percent}%)
                    </span>
                  </span>

                </div>

                <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
                  <div
                    className="h-full rounded-full transition-[width] duration-500"
                    style={{
                      width: `${item.percent}%`,
                      background:
                        item.label === "Até 1 dia"
                          ? "#22C55E"
                          : item.label === "1 a 3 dias"
                          ? "#84CC16"
                          : item.label === "3 a 7 dias"
                          ? "#F59E0B"
                          : "#EF4444",
                    }}
                  />
                </div>

              </li>

            ))}

          </ul>

        </SurfaceCard>

        <SurfaceCard
          title="Concentração geográfica"
          description="De onde vem a demanda, com a nota média de cada região."
          action={
            <div className="flex shrink-0 items-center rounded-xl border border-zinc-200 p-1">

              {(
                [
                  ["state", "Estado"],
                  ["city", "Cidade"],
                ] as ["state" | "city", string][]
              ).map(([id, label]) => (

                <button
                  key={id}
                  onClick={() => setRegiao(id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    regiao === id
                      ? "bg-violet-700 text-white"
                      : "text-zinc-600 hover:bg-zinc-100"
                  }`}
                >
                  {label}
                </button>

              ))}

            </div>
          }
        >

          <ul className="space-y-3">

            {regioes.map((item) => (

              <li
                key={item.label}
                className="flex items-center gap-3"
                title={`Nota média ${ptBR(
                  item.averageScore
                )} em ${item.label}`}
              >

                <span className="w-28 shrink-0 truncate text-sm font-medium text-zinc-700">
                  {item.label}
                </span>

                <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100">
                  <div
                    className="h-full rounded-full bg-violet-600"
                    style={{
                      width: `${item.percent}%`,
                    }}
                  />
                </div>

                <span className="w-8 shrink-0 text-right text-sm font-semibold tabular-nums text-zinc-900">
                  {item.value}
                </span>

                <span
                  className={`w-10 shrink-0 text-right text-xs font-semibold tabular-nums ${
                    item.averageScore >= 7
                      ? "text-emerald-600"
                      : item.averageScore >= 5
                      ? "text-amber-600"
                      : "text-rose-600"
                  }`}
                >
                  {ptBR(item.averageScore)}
                </span>

              </li>

            ))}

          </ul>

        </SurfaceCard>

      </div>

      {/* Causas */}

      <div className="grid gap-6 lg:grid-cols-3">

        <SurfaceCard
          title="Principais causas"
          description="Categorias que mais geram ocorrência."
        >
          <BarList data={byCategory} limit={8} />
        </SurfaceCard>

        <SurfaceCard
          title="Detalhamento"
          description="Subcategorias mais recorrentes."
        >
          <BarList
            data={bySubcategory}
            limit={8}
            color="#0EA5E9"
          />
        </SurfaceCard>

        <SurfaceCard
          title="Situação da fila"
          description="Distribuição por status."
        >
          <BarList
            data={byStatus}
            limit={8}
            color="#F59E0B"
          />
        </SurfaceCard>

      </div>

    </div>
  );
}
