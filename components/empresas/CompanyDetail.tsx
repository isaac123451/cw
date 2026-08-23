"use client";

import {
  documentoFormatado,
  tipoDeDocumento,
} from "@/lib/models/establishment";

import Link from "next/link";

import { useMemo } from "react";

import {
  Building2,
  ChevronLeft,
  MessagesSquare,
  Route,
  TriangleAlert,
} from "lucide-react";

import SurfaceCard from "@/components/shared/SurfaceCard";
import StatTile from "@/components/shared/StatTile";
import BarList from "@/components/shared/BarList";
import TrendChart from "@/components/shared/TrendChart";

import { useCases } from "@/lib/context/CaseContext";

import { buildCompanies } from "@/lib/services/company.service";
import {
  getMonthlyTrend,
  groupBy,
} from "@/lib/services/case.service";
import { bandOf, ptBR } from "@/lib/services/reputation.service";

interface Props {
  slug: string;
}

export default function CompanyDetail({ slug }: Props) {

  const { cases } = useCases();

  const company = useMemo(
    () =>
      buildCompanies(cases).find(
        (item) => item.slug === slug
      ),
    [cases, slug]
  );

  const byCategory = useMemo(
    () => groupBy(company?.cases ?? [], "category"),
    [company]
  );

  const byStatus = useMemo(
    () => groupBy(company?.cases ?? [], "status"),
    [company]
  );

  const trend = useMemo(
    () => getMonthlyTrend(company?.cases ?? []),
    [company]
  );

  if (!company) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-white py-20 text-center">

        <Building2 size={28} className="text-zinc-300" />

        <p className="mt-3 text-sm font-medium text-zinc-700">
          Empresa não encontrada.
        </p>

        <Link
          href="/empresas"
          className="mt-5 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-800"
        >
          Voltar para Empresas
        </Link>

      </div>
    );
  }

  const band = bandOf(company.raScore);

  return (
    <div className="space-y-6">

      <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">

        <Link
          href="/empresas"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 transition-colors hover:text-violet-700"
        >
          <ChevronLeft size={16} />
          Voltar para Empresas
        </Link>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-5">

          <div className="flex min-w-0 items-center gap-4">

            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-100">
              <Building2 size={24} />
            </span>

            <div className="min-w-0">

              <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
                {company.name}
              </h1>

              <p className="mt-1 text-sm text-zinc-500">
                {company.city}/{company.state}
                {company.document &&
                  ` · ${tipoDeDocumento(company.document)} ${documentoFormatado(company.document)}`}
              </p>

              <p className="mt-1 text-xs text-zinc-400">
                Primeiro caso em {company.firstCase} ·
                último em {company.lastCase}
              </p>

            </div>

          </div>

          <div className="flex shrink-0 items-center gap-2">

            <Link
              href="/jornada"
              className="flex items-center gap-2 rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
            >
              <Route size={15} />
              Ver jornada
            </Link>

            <span
              className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
              style={{ background: band.color }}
              title={`Reputação ${band.label}`}
            >
              {ptBR(company.raScore)} · {band.label}
            </span>

          </div>

        </div>

      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">

        <StatTile
          label="Total de casos"
          value={company.total}
          hint="todos os canais"
          icon={Building2}
          tone="primary"
        />

        <StatTile
          label="Em aberto"
          value={company.open}
          hint="aguardando tratativa"
          icon={MessagesSquare}
          tone="warning"
        />

        <StatTile
          label="Risco de churn"
          value={company.churnRisk}
          hint="casos sinalizados"
          icon={TriangleAlert}
          tone="danger"
        />

        <StatTile
          label="Nota média"
          value={ptBR(company.averageScore)}
          hint="avaliações do consumidor"
          icon={Building2}
          tone="info"
        />

        <StatTile
          label="Índice de resposta"
          value={`${ptBR(company.responseIndex)}%`}
          hint="no Reclame Aqui"
          icon={MessagesSquare}
          tone="success"
        />

      </div>

      <SurfaceCard
        title="Evolução dos casos"
        description="Volume recebido e resolvido mês a mês para este cliente."
      >
        <TrendChart data={trend} />
      </SurfaceCard>

      <div className="grid gap-6 lg:grid-cols-2">

        <SurfaceCard
          title="Principais causas"
          description="Categorias que mais geram ocorrência."
        >
          <BarList data={byCategory} limit={7} />
        </SurfaceCard>

        <SurfaceCard
          title="Distribuição por status"
          description="Como a fila deste cliente está hoje."
        >
          <BarList data={byStatus} color="#F59E0B" />
        </SurfaceCard>

      </div>

      <SurfaceCard
        title="Histórico de casos"
        description={`${company.cases.length} ocorrência(s) registradas.`}
        bodyClassName="p-0"
      >

        <div className="overflow-x-auto">

          <table className="min-w-full">

            <thead className="bg-zinc-50">

              <tr>

                {[
                  "Protocolo",
                  "Título",
                  "Canal",
                  "Categoria",
                  "Status",
                  "Nota",
                  "Data",
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

              {company.cases.map((item) => (

                <tr
                  key={item.id}
                  className="text-sm transition-colors hover:bg-violet-50/40"
                >

                  <td className="whitespace-nowrap px-5 py-3">
                    <Link
                      href={`/reclame-aqui/${item.id}`}
                      className="font-mono text-xs font-semibold text-violet-700 hover:underline"
                    >
                      {item.protocol}
                    </Link>
                  </td>

                  <td className="max-w-[280px] px-5 py-3">
                    <Link
                      href={`/reclame-aqui/${item.id}`}
                      className="block truncate text-zinc-700 hover:text-violet-700"
                    >
                      {item.title}
                    </Link>
                  </td>

                  <td className="whitespace-nowrap px-5 py-3 text-zinc-600">
                    {item.source}
                  </td>

                  <td className="whitespace-nowrap px-5 py-3 text-zinc-600">
                    {item.category}
                  </td>

                  <td className="whitespace-nowrap px-5 py-3">
                    <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-medium text-zinc-600">
                      {item.status}
                    </span>
                  </td>

                  <td className="whitespace-nowrap px-5 py-3 tabular-nums text-zinc-600">
                    {item.evaluated ? item.score : "—"}
                  </td>

                  <td className="whitespace-nowrap px-5 py-3 text-zinc-500">
                    {item.createdAt}
                  </td>

                </tr>

              ))}

            </tbody>

          </table>

        </div>

      </SurfaceCard>

    </div>
  );
}
