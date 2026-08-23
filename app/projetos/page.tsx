"use client";

import { useState } from "react";

import {
  CheckCircle2,
  GripVertical,
  Lightbulb,
  Pencil,
  Plus,
  Rocket,
  Target,
  Trash2,
} from "lucide-react";

import MainLayout from "@/components/layout/MainLayout";

import PageHeading from "@/components/shared/PageHeading";
import StatTile from "@/components/shared/StatTile";
import { ConfirmDelete } from "@/components/shared/Modal";

import ProjectForm from "@/components/projetos/ProjectForm";

import {
  ProjectDraft,
  useProjects,
} from "@/lib/context/ProjectsContext";

import { Project, ProjectStage } from "@/lib/models/project";

const stages: {
  id: ProjectStage;
  color: string;
  hint: string;
}[] = [
  {
    id: "Ideia",
    color: "#A1A1AA",
    hint: "Registrada, ainda sem prioridade definida.",
  },
  {
    id: "Planejado",
    color: "#0EA5E9",
    hint: "Priorizada e com escopo desenhado.",
  },
  {
    id: "Em andamento",
    color: "#F59E0B",
    hint: "Sendo executada agora.",
  },
  {
    id: "Concluído",
    color: "#22C55E",
    hint: "Entregue e em uso.",
  },
];

const impactTone: Record<string, string> = {
  Alto: "bg-rose-50 text-rose-700 ring-rose-100",
  Médio: "bg-amber-50 text-amber-700 ring-amber-100",
  Baixo: "bg-zinc-100 text-zinc-600 ring-zinc-200",
};

export default function ProjetosPage() {

  const {
    projects,
    createProject,
    updateProject,
    removeProject,
    moveProject,
  } = useProjects();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Project>();
  const [presetStage, setPresetStage] =
    useState<ProjectStage>();
  const [deleting, setDeleting] = useState<Project>();

  const [dragOver, setDragOver] = useState<string | null>(
    null
  );

  const done = projects.filter(
    (item) => item.stage === "Concluído"
  ).length;

  const running = projects.filter(
    (item) => item.stage === "Em andamento"
  ).length;

  const ideas = projects.filter(
    (item) => item.stage === "Ideia"
  ).length;

  function salvar(data: ProjectDraft | Project) {

    if ("id" in data) updateProject(data);
    else createProject(data);

    setFormOpen(false);
    setEditing(undefined);
    setPresetStage(undefined);
  }

  function nova(stage?: ProjectStage) {
    setEditing(undefined);
    setPresetStage(stage);
    setFormOpen(true);
  }

  return (
    <MainLayout>

      <div className="space-y-6">

        <PageHeading
          eyebrow="Evolução contínua"
          title="Projetos e Melhorias"
          description="Roadmap da área: ideias, planos de ação e entregas."
        >
          <button
            onClick={() => nova()}
            className="flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-800"
          >
            <Plus size={16} />
            Nova iniciativa
          </button>
        </PageHeading>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

          <StatTile
            label="Iniciativas"
            description="Total de itens no roadmap da área."
            value={projects.length}
            hint="no roadmap"
            icon={Target}
            tone="primary"
          />

          <StatTile
            label="Em andamento"
            description="Iniciativas sendo executadas agora."
            value={running}
            hint="sendo executadas"
            icon={Rocket}
            tone="warning"
          />

          <StatTile
            label="Concluídas"
            description="Entregas já em uso pela operação."
            value={done}
            hint="entregues"
            icon={CheckCircle2}
            tone="success"
          />

          <StatTile
            label="Ideias"
            description="Registradas, aguardando priorização."
            value={ideas}
            hint="aguardando priorização"
            icon={Lightbulb}
            tone="info"
          />

        </div>

        <div className="overflow-x-auto pb-2">

          <div className="flex gap-4">

            {stages.map((stage) => {

              const items = projects.filter(
                (item) => item.stage === stage.id
              );

              const isOver = dragOver === stage.id;

              return (
                <div
                  key={stage.id}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragOver(stage.id);
                  }}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={(event) => {
                    event.preventDefault();
                    setDragOver(null);

                    const id =
                      event.dataTransfer.getData(
                        "text/plain"
                      );

                    if (id) moveProject(id, stage.id);
                  }}
                  className={`flex w-[300px] shrink-0 flex-col rounded-2xl border transition-colors ${
                    isOver
                      ? "border-violet-400 bg-violet-50/70"
                      : "border-zinc-200/80 bg-zinc-50/80"
                  }`}
                >

                  <div
                    className="flex items-center justify-between gap-2 border-b border-zinc-200/80 px-4 py-3"
                    title={stage.hint}
                  >

                    <div className="flex items-center gap-2.5">

                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: stage.color }}
                      />

                      <h3 className="text-sm font-semibold text-zinc-800">
                        {stage.id}
                      </h3>

                    </div>

                    <div className="flex items-center gap-1">

                      <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold tabular-nums text-zinc-600 ring-1 ring-inset ring-zinc-200">
                        {items.length}
                      </span>

                      <button
                        onClick={() => nova(stage.id)}
                        title={`Nova iniciativa em ${stage.id}`}
                        className="rounded-lg p-1 text-zinc-400 transition-colors hover:bg-white hover:text-violet-700"
                      >
                        <Plus size={14} />
                      </button>

                    </div>

                  </div>

                  <div className="space-y-2.5 p-2.5">

                    {items.length === 0 ? (

                      <p className="rounded-xl border border-dashed border-zinc-200 py-8 text-center text-xs text-zinc-400">
                        {isOver
                          ? "Solte aqui"
                          : "Nenhuma iniciativa"}
                      </p>

                    ) : (

                      items.map((item) => (

                        <article
                          key={item.id}
                          draggable
                          onDragStart={(event) => {
                            event.dataTransfer.setData(
                              "text/plain",
                              item.id
                            );
                            event.dataTransfer.effectAllowed =
                              "move";
                          }}
                          className="group cursor-grab rounded-xl border border-zinc-200 bg-white p-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-all active:cursor-grabbing hover:-translate-y-0.5 hover:border-violet-300"
                        >

                          <div className="flex items-start justify-between gap-2">

                            <h4 className="text-sm font-semibold leading-snug text-zinc-900">
                              {item.title}
                            </h4>

                            <span
                              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${
                                impactTone[item.impact]
                              }`}
                            >
                              {item.impact}
                            </span>

                          </div>

                          <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">
                            {item.description}
                          </p>

                          <div className="mt-3">

                            <div className="flex items-center justify-between text-[11px] text-zinc-400">
                              <span>Progresso</span>
                              <span className="tabular-nums">
                                {item.progress}%
                              </span>
                            </div>

                            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-100">
                              <div
                                className="h-full rounded-full transition-[width]"
                                style={{
                                  width: `${item.progress}%`,
                                  background: stage.color,
                                }}
                              />
                            </div>

                          </div>

                          {item.tags.length > 0 && (

                            <div className="mt-3 flex flex-wrap gap-1.5">

                              {item.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600"
                                >
                                  {tag}
                                </span>
                              ))}

                            </div>

                          )}

                          <div className="mt-3 flex items-center justify-between border-t border-zinc-100 pt-2.5">

                            <p className="truncate text-[11px] text-zinc-400">
                              {item.owner} · {item.updatedAt}
                            </p>

                            <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">

                              <GripVertical
                                size={13}
                                className="text-zinc-300"
                              />

                              <button
                                onClick={() => {
                                  setEditing(item);
                                  setPresetStage(undefined);
                                  setFormOpen(true);
                                }}
                                title="Editar"
                                className="rounded-md p-1 text-zinc-400 transition-colors hover:bg-violet-50 hover:text-violet-700"
                              >
                                <Pencil size={13} />
                              </button>

                              <button
                                onClick={() =>
                                  setDeleting(item)
                                }
                                title="Excluir"
                                className="rounded-md p-1 text-zinc-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                              >
                                <Trash2 size={13} />
                              </button>

                            </div>

                          </div>

                        </article>

                      ))

                    )}

                  </div>

                </div>
              );
            })}

          </div>

        </div>

        <p className="text-xs text-zinc-400">
          Dica: arraste um cartão para mudar a etapa. Mover
          para Concluído completa o progresso.
        </p>

      </div>

      {formOpen && (
        <ProjectForm
          key={editing?.id ?? presetStage ?? "novo"}
          open={formOpen}
          editing={editing}
          presetStage={presetStage}
          onClose={() => {
            setFormOpen(false);
            setEditing(undefined);
            setPresetStage(undefined);
          }}
          onSave={salvar}
        />
      )}

      <ConfirmDelete
        open={Boolean(deleting)}
        label={deleting?.title ?? ""}
        onCancel={() => setDeleting(undefined)}
        onConfirm={() => {
          if (deleting) removeProject(deleting.id);
          setDeleting(undefined);
        }}
      />

    </MainLayout>
  );
}
