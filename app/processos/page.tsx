"use client";

import { useState } from "react";

import {
  CheckCircle2,
  ClipboardList,
  Clock3,
  UserRound,
  Workflow,
} from "lucide-react";

import MainLayout from "@/components/layout/MainLayout";

import PageHeading from "@/components/shared/PageHeading";
import StatTile from "@/components/shared/StatTile";
import SurfaceCard from "@/components/shared/SurfaceCard";

import { mockProcesses } from "@/lib/data/mockProcesses";

const statusTone: Record<string, string> = {
  Ativo: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  "Em revisão": "bg-amber-50 text-amber-700 ring-amber-100",
  Rascunho: "bg-zinc-100 text-zinc-600 ring-zinc-200",
};

export default function ProcessosPage() {

  const [selectedId, setSelectedId] = useState(
    mockProcesses[0].id
  );

  const current =
    mockProcesses.find(
      (item) => item.id === selectedId
    ) ?? mockProcesses[0];

  const active = mockProcesses.filter(
    (item) => item.status === "Ativo"
  ).length;

  const review = mockProcesses.filter(
    (item) => item.status === "Em revisão"
  ).length;

  const areas = new Set(
    mockProcesses.map((item) => item.area)
  ).size;

  return (
    <MainLayout>

      <div className="space-y-6">

        <PageHeading
          eyebrow="Conhecimento"
          title="Gestão de Processos"
          description="Fluxos operacionais documentados, responsáveis e SLAs da operação."
        />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

          <StatTile
            label="Processos mapeados"
            description="Fluxos operacionais documentados pela área."
            value={mockProcesses.length}
            hint="documentados"
            icon={Workflow}
            tone="primary"
          />

          <StatTile
            label="Ativos"
            value={active}
            hint="em uso pela operação"
            icon={CheckCircle2}
            tone="success"
          />

          <StatTile
            label="Em revisão"
            value={review}
            hint="aguardando validação"
            icon={ClipboardList}
            tone="warning"
          />

          <StatTile
            label="Áreas envolvidas"
            value={areas}
            hint="times participantes"
            icon={UserRound}
            tone="info"
          />

        </div>

        <div className="grid gap-6 lg:grid-cols-5">

          <div className="lg:col-span-2">

            <SurfaceCard
              title="Processos"
              description="Selecione para ver as etapas."
              bodyClassName="p-2"
            >

              <ul className="space-y-1">

                {mockProcesses.map((item) => {

                  const selected = current.id === item.id;

                  return (
                    <li key={item.id}>

                      <button
                        onClick={() =>
                          setSelectedId(item.id)
                        }
                        className={`w-full rounded-xl px-3 py-2.5 text-left transition-colors ${
                          selected
                            ? "bg-violet-50 ring-1 ring-inset ring-violet-200"
                            : "hover:bg-zinc-50"
                        }`}
                      >

                        <p className="truncate text-sm font-medium text-zinc-800">
                          {item.name}
                        </p>

                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">

                          <span
                            className={`rounded-full px-1.5 py-0.5 font-medium ring-1 ring-inset ${
                              statusTone[item.status]
                            }`}
                          >
                            {item.status}
                          </span>

                          <span>{item.area}</span>

                          <span>·</span>

                          <span>SLA {item.sla}</span>

                        </div>

                      </button>

                    </li>
                  );
                })}

              </ul>

            </SurfaceCard>

          </div>

          <div className="lg:col-span-3">

            <SurfaceCard
              title={current.name}
              description={current.description}
              action={
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${
                    statusTone[current.status]
                  }`}
                >
                  {current.status}
                </span>
              }
            >

              <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">

                {[
                  { label: "Área", value: current.area },
                  { label: "Responsável", value: current.owner },
                  { label: "SLA", value: current.sla },
                  {
                    label: "Atualizado",
                    value: current.updatedAt,
                  },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-xl bg-zinc-50 px-3 py-2.5"
                  >
                    <p className="text-[11px] uppercase tracking-wide text-zinc-400">
                      {stat.label}
                    </p>
                    <p className="mt-0.5 truncate text-sm font-semibold text-zinc-900">
                      {stat.value}
                    </p>
                  </div>
                ))}

              </div>

              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                Etapas do fluxo
              </h3>

              <ol className="space-y-2">

                {current.steps.map((step, index) => (

                  <li
                    key={step.name}
                    className="flex items-center gap-3 rounded-xl border border-zinc-100 px-4 py-3"
                  >

                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-50 text-xs font-semibold text-violet-700">
                      {index + 1}
                    </span>

                    <p className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-800">
                      {step.name}
                    </p>

                    <span className="flex shrink-0 items-center gap-1.5 text-xs text-zinc-500">
                      <UserRound size={12} />
                      {step.owner}
                    </span>

                  </li>

                ))}

              </ol>

              <p className="mt-4 flex items-center gap-1.5 text-xs text-zinc-400">
                <Clock3 size={12} />
                Prazo total previsto: {current.sla}
              </p>

            </SurfaceCard>

          </div>

        </div>

      </div>

    </MainLayout>
  );
}
