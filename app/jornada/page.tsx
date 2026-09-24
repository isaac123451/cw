"use client";

import Link from "next/link";

import { useMemo, useState } from "react";

import {
  Frown,
  Layers,
  LayoutGrid,
  Pencil,
  Plus,
  Repeat,
  Rows3,
  Trash2,
  TriangleAlert,
  UserRound,
  Users,
} from "lucide-react";

import MainLayout from "@/components/layout/MainLayout";

import PageHeading from "@/components/shared/PageHeading";
import StatTile from "@/components/shared/StatTile";
import SurfaceCard from "@/components/shared/SurfaceCard";
import { ConfirmDelete } from "@/components/shared/Modal";

import JourneyBoard, {
  stageOf,
} from "@/components/jornada/JourneyBoard";
import JourneyTopics from "@/components/jornada/JourneyTopics";
import StageForm from "@/components/jornada/StageForm";

import { JourneyStage } from "@/lib/models/journey";

import IconeDaFrente from "@/components/shared/IconeDaFrente";

import { useCases } from "@/lib/context/CaseContext";
import { useJourney } from "@/lib/context/JourneyContext";
import { useNps } from "@/lib/context/NpsContext";
import { useSession } from "@/lib/context/SessionContext";
import { useAvaliacoesGoogle } from "@/lib/context/useAvaliacoesGoogle";

import { montarJornadas } from "@/lib/services/journey.service";
import { descreverRegistro } from "@/lib/services/horasUteis";
import { slugify } from "@/lib/services/slug";
import { FRENTES_DA_OPERACAO, frente as frenteDaOperacao, type FrenteId } from "@/lib/models/frentes";

/*
  As quatro frentes, na ordem do documento. Era "Todos os canais,
  Reclame Aqui, Redes Sociais" — o NPS e o Google não entravam na
  jornada de ninguém.
*/
const channels: { id: FrenteId | "all"; label: string }[] = [
  { id: "all", label: "Todas as frentes" },
  ...FRENTES_DA_OPERACAO.map((f) => ({ id: f.id, label: f.nome })),
];

export default function JornadaPage() {

  const { cases } = useCases();
  const { responses } = useNps();
  const { avaliacoes } = useAvaliacoesGoogle();

  const {
    stages,
    placement,
    moveCompany,
    saveStage,
    removeStage,
  } = useJourney();

  const [stageOpen, setStageOpen] = useState(false);

  const [editingStage, setEditingStage] =
    useState<JourneyStage>();

  const [deletingStage, setDeletingStage] =
    useState<JourneyStage>();

  const session = useSession();

  const [channel, setChannel] = useState<FrenteId | "all">("all");

  const [view, setView] = useState<"quadro" | "lista">(
    "quadro"
  );

  const [selected, setSelected] = useState<string | null>(
    null
  );

  const todas = useMemo(
    () => montarJornadas({ casos: cases, nps: responses, google: avaliacoes }),
    [cases, responses, avaliacoes]
  );

  /* O recorte mostra quem tem ao menos um registro na frente — com a história inteira. */
  const journeys = useMemo(
    () => (channel === "all" ? todas : todas.filter((j) => j.porFrente[channel] > 0)),
    [todas, channel]
  );

  const current =
    journeys.find(
      (item) => item.company === selected
    ) ?? journeys[0];

  const atRisk = journeys.filter(
    (item) => item.churnRisk
  ).length;

  const recurring = journeys.filter(
    (item) => item.recurring
  ).length;

  const detractors = journeys.filter(
    (item) => item.sentiment === "Detrator"
  ).length;

  return (
    <MainLayout>

      <div className="space-y-6">

        <PageHeading
          eyebrow="Clientes"
          title="Jornada do Cliente"
          description="Ciclo de vida, histórico e pontos críticos de cada cliente — no Reclame Aqui, nas redes, no NPS e no Google."
        >

          <div className="flex items-center rounded-xl border border-zinc-200 bg-white p-1">

            <button
              onClick={() => setView("quadro")}
              title="Visualizar em quadro"
              className={`rounded-lg p-2 transition-colors ${
                view === "quadro"
                  ? "bg-violet-700 text-white"
                  : "text-zinc-500 hover:bg-zinc-100"
              }`}
            >
              <LayoutGrid size={16} />
            </button>

            <button
              onClick={() => setView("lista")}
              title="Visualizar em lista"
              className={`rounded-lg p-2 transition-colors ${
                view === "lista"
                  ? "bg-violet-700 text-white"
                  : "text-zinc-500 hover:bg-zinc-100"
              }`}
            >
              <Rows3 size={16} />
            </button>

          </div>

        </PageHeading>

        {/* Recorte por canal */}

        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-zinc-200/80 bg-white p-1.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">

          {channels.map((item) => (

            <button
              key={item.id}
              onClick={() => setChannel(item.id)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                channel === item.id
                  ? "bg-violet-700 text-white shadow-sm shadow-violet-700/25"
                  : "text-zinc-600 hover:bg-zinc-100"
              }`}
            >
              {item.id === "all" ? <Layers size={15} /> : <IconeDaFrente frente={item.id} size={15} herdarCor={channel === item.id} />}
              {item.label}
            </button>

          ))}

        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">

          <StatTile
            label="Clientes acompanhados"
            description="Clientes com ao menos um registro na frente escolhida. No NPS, entram as respostas que abriram ciclo — o promotor calado fica na análise do NPS."
            value={journeys.length}
            hint={channel === "all" ? "nas quatro frentes" : `com registro em ${frenteDaOperacao(channel).nome}`}
            icon={Users}
            tone="info"
          />

          <StatTile
            label="Risco de cancelamento"
            description="Clientes marcados como risco de cancelamento, numa reclamação ou no NPS."
            value={atRisk}
            hint="precisam de ação"
            icon={TriangleAlert}
            tone="danger"
          />

          <StatTile
            label="Reincidentes"
            description="Clientes com mais de um registro, somando as frentes — sinal de problema recorrente."
            value={recurring}
            hint="mais de um registro"
            icon={Repeat}
            tone="warning"
          />

          <StatTile
            label="Detratores"
            description="Nota média abaixo de 5, somando as frentes na escala de 0 a 10: a do Reclame Aqui e a do NPS como vêm, a do Google em dobro."
            value={detractors}
            hint="nota média abaixo de 5"
            icon={Frown}
            tone="primary"
          />

        </div>

        {view === "quadro" ? (

          <SurfaceCard
            title="Ciclo de vida"
            description="Arraste um cliente para mudar a etapa. A posição inicial é sugerida pelos dados."
            hint="As etapas são suas: crie, renomeie ou desative conforme o processo da operação mudar."
            bodyClassName="p-4"
            action={
              <button
                onClick={() => {
                  setEditingStage(undefined);
                  setStageOpen(true);
                }}
                className="flex shrink-0 items-center gap-2 rounded-xl border border-violet-200 px-3.5 py-2 text-sm font-medium text-violet-700 transition-colors hover:bg-violet-50"
              >
                <Plus size={15} />
                Nova etapa
              </button>
            }
          >

            {/* Gestão das colunas do quadro */}

            <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-zinc-100 pb-4">

              <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                Etapas
              </span>

              {[...stages]
                .sort((a, b) => a.order - b.order)
                .map((stage) => (

                  <span
                    key={stage.id}
                    className={`group flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 transition-colors ${
                      stage.active
                        ? "border-zinc-200"
                        : "border-dashed border-zinc-200 opacity-60"
                    }`}
                  >

                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: stage.color }}
                    />

                    <span
                      className="text-xs font-medium text-zinc-700"
                      title={
                        stage.description ||
                        stage.name
                      }
                    >
                      {stage.name}
                    </span>

                    {!stage.active && (
                      <span className="text-[10px] text-zinc-400">
                        inativa
                      </span>
                    )}

                    <button
                      onClick={() => {
                        setEditingStage(stage);
                        setStageOpen(true);
                      }}
                      title={`Editar a etapa ${stage.name}`}
                      className="ml-0.5 rounded-md p-1 text-zinc-300 transition-colors hover:bg-violet-50 hover:text-violet-700"
                    >
                      <Pencil size={11} />
                    </button>

                    <button
                      onClick={() =>
                        setDeletingStage(stage)
                      }
                      title={`Excluir a etapa ${stage.name}`}
                      className="rounded-md p-1 text-zinc-300 transition-colors hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Trash2 size={11} />
                    </button>

                  </span>

                ))}

            </div>

            <JourneyBoard
              journeys={journeys}
              stages={stages}
              placement={placement}
              selected={current?.company ?? null}
              onSelect={setSelected}
              onMove={moveCompany}
            />

          </SurfaceCard>

        ) : (

          <SurfaceCard
            title="Clientes"
            description="Ordenados por risco e volume de ocorrências."
            bodyClassName="p-0"
          >

            <ul className="divide-y divide-zinc-100">

              {journeys.map((item) => {

                const stage = stageOf(
                  item,
                  stages,
                  placement
                );

                return (
                  <li key={item.company}>

                    <button
                      onClick={() =>
                        setSelected(item.company)
                      }
                      className={`flex w-full items-center gap-4 px-6 py-3.5 text-left transition-colors ${
                        current?.company === item.company
                          ? "bg-violet-50/60"
                          : "hover:bg-zinc-50"
                      }`}
                    >

                      <span
                        className="h-8 w-1 shrink-0 rounded-full"
                        style={{
                          background: stage?.color,
                        }}
                      />

                      <span className="min-w-0 flex-1">

                        <span className="block truncate text-sm font-medium text-zinc-800">
                          {item.company}
                        </span>

                        <span className="mt-0.5 block truncate text-xs text-zinc-500">
                          {stage?.name} · {item.total} registro(s) ·
                          nota {item.averageScore}
                        </span>

                      </span>

                      {item.churnRisk && (
                        <TriangleAlert
                          size={14}
                          className="shrink-0 text-rose-500"
                        />
                      )}

                    </button>

                  </li>
                );
              })}

            </ul>

          </SurfaceCard>

        )}

        {/* Detalhe do cliente */}

        {current && (

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">

            <JourneyTopics
              company={current.company}
              author={session?.name ?? "Operação"}
            />

            <SurfaceCard
              title={current.company}
              description={`${current.customers.length} nome(s) · última interação ${current.lastInteraction.split("-").reverse().join("/")}`}
              hint="Abra o perfil completo para ver o histórico, o estabelecimento vinculado e as notas dadas por esta pessoa."
              action={
                <span
                  className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold text-white"
                  style={{
                    background: stageOf(
                      current,
                      stages,
                      placement
                    )?.color,
                  }}
                >
                  {
                    stageOf(current, stages, placement)
                      ?.name
                  }
                </span>
              }
            >

              <div className="mb-3 grid grid-cols-2 gap-3">
                {[
                  { label: "Registros", value: current.total },
                  { label: "Em aberto", value: current.open },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-xl bg-zinc-50 px-3 py-2.5">
                    <p className="text-[11px] uppercase tracking-wide text-zinc-400">{stat.label}</p>
                    <p className="mt-0.5 text-lg font-semibold tabular-nums text-zinc-900">{stat.value}</p>
                  </div>
                ))}
              </div>

              {/* As quatro frentes, sempre as quatro — o zero também diz alguma coisa. */}
              <div className="mb-5 grid grid-cols-4 gap-2">
                {FRENTES_DA_OPERACAO.map((f) => (
                  <div key={f.id} title={f.nome} className="rounded-xl bg-zinc-50 px-2 py-2 text-center">
                    <IconeDaFrente frente={f.id} size={14} className="mx-auto" />
                    <p className="mt-1 text-base font-semibold tabular-nums text-zinc-900">{current.porFrente[f.id]}</p>
                    <p className="truncate text-[10px] text-zinc-500">{f.curto}</p>
                  </div>
                ))}
              </div>

              {/* Liga a jornada ao perfil criado em Clientes. */}
              <Link
                href={`/clientes/${slugify(
                  current.company
                )}`}
                className="mb-5 flex items-center justify-center gap-2 rounded-xl border border-violet-200 px-4 py-2.5 text-sm font-medium text-violet-700 transition-colors hover:bg-violet-50"
              >
                <UserRound size={15} />
                Abrir perfil do cliente
              </Link>

              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                Linha do tempo
              </h3>

              <ol className="relative max-h-[420px] space-y-4 overflow-y-auto pr-1 before:absolute before:left-[5px] before:top-2 before:h-[calc(100%-1rem)] before:w-px before:bg-zinc-200 before:content-['']">

                {current.pontos.map((ponto) => (

                  <li key={ponto.id} className="relative pl-6">

                    <span
                      className={`absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-white ${
                        ponto.estado === "resolvido"
                          ? "bg-emerald-500"
                          : ponto.estado === "risco"
                          ? "bg-rose-500"
                          : ponto.estado === "aberto"
                          ? "bg-amber-500"
                          : "bg-zinc-300"
                      }`}
                    />

                    <Link
                      href={ponto.href}
                      className="text-sm font-medium text-zinc-800 hover:text-violet-700 hover:underline"
                    >
                      {ponto.titulo}
                    </Link>

                    <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-zinc-500">
                      <IconeDaFrente frente={ponto.frente} size={11} />
                      {frenteDaOperacao(ponto.frente).curto} · {descreverRegistro(ponto.em)}
                      {ponto.detalhe ? ` · ${ponto.detalhe}` : ""}
                    </p>

                  </li>

                ))}

              </ol>

            </SurfaceCard>

          </div>

        )}

      </div>

      {stageOpen && (
        <StageForm
          key={editingStage?.id ?? "novo"}
          open={stageOpen}
          editing={editingStage}
          nextOrder={
            Math.max(
              0,
              ...stages.map((item) => item.order)
            ) + 1
          }
          onClose={() => {
            setStageOpen(false);
            setEditingStage(undefined);
          }}
          onSave={(data) => {
            saveStage(data);
            setStageOpen(false);
            setEditingStage(undefined);
          }}
        />
      )}

      <ConfirmDelete
        open={Boolean(deletingStage)}
        label={deletingStage?.name ?? ""}
        onCancel={() => setDeletingStage(undefined)}
        onConfirm={() => {
          if (deletingStage) {
            removeStage(deletingStage.id);
          }
          setDeletingStage(undefined);
        }}
      />

    </MainLayout>
  );
}
