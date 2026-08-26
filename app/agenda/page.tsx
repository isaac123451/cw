"use client";

import { useMemo, useState } from "react";

import {
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  CircleAlert,
  ListTodo,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

import MainLayout from "@/components/layout/MainLayout";

import PageHeading from "@/components/shared/PageHeading";
import StatTile from "@/components/shared/StatTile";
import SurfaceCard from "@/components/shared/SurfaceCard";
import { ConfirmDelete } from "@/components/shared/Modal";

import TaskForm from "@/components/agenda/TaskForm";
import GoogleCalendarCard from "@/components/agenda/GoogleCalendarCard";

import {
  TaskDraft,
  useAgenda,
} from "@/lib/context/AgendaContext";

import { pushTaskToGoogle } from "@/lib/actions/google";

import { AgendaTask } from "@/lib/models/agenda";
import { hojeNaOperacao } from "@/lib/services/reputation.service";
import ChecklistDoDia from "@/components/agenda/ChecklistDoDia";

const typeTone: Record<string, string> = {
  "Follow-up": "bg-sky-50 text-sky-700 ring-sky-100",
  "Cobrança interna":
    "bg-amber-50 text-amber-700 ring-amber-100",
  "Solicitação de avaliação":
    "bg-violet-50 text-violet-700 ring-violet-100",
  Pendência: "bg-rose-50 text-rose-700 ring-rose-100",
  Recorrente: "bg-zinc-100 text-zinc-600 ring-zinc-200",
};

const priorityTone: Record<string, string> = {
  Alta: "bg-rose-500",
  Média: "bg-amber-500",
  Baixa: "bg-zinc-300",
};

function formatDay(date: string) {

  if (date === hojeNaOperacao()) return "Hoje";

  const [year, month, day] = date.split("-").map(Number);

  const weekdays = [
    "Domingo",
    "Segunda",
    "Terça",
    "Quarta",
    "Quinta",
    "Sexta",
    "Sábado",
  ];

  const weekday =
    weekdays[new Date(year, month - 1, day).getDay()];

  return `${weekday}, ${String(day).padStart(
    2,
    "0"
  )}/${String(month).padStart(2, "0")}`;
}

export default function AgendaPage() {

  const {
    tasks,
    createTask,
    updateTask,
    removeTask,
    toggleTask,
    moveTask,
  } = useAgenda();

  const [showDone, setShowDone] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AgendaTask>();
  const [presetDate, setPresetDate] = useState<string>();
  const [deleting, setDeleting] = useState<AgendaTask>();

  const [dragOver, setDragOver] = useState<string | null>(
    null
  );

  /** Id da tarefa em envio, para travar o botão sem travar a lista. */
  const [enviando, setEnviando] = useState<string>();

  const [aviso, setAviso] = useState<{
    ok: boolean;
    texto: string;
  }>();

  const visible = useMemo(
    () =>
      showDone
        ? tasks
        : tasks.filter((item) => !item.done),
    [tasks, showDone]
  );

  const days = useMemo(() => {

    const map = new Map<string, AgendaTask[]>();

    for (const item of visible) {
      map.set(item.dueDate, [
        ...(map.get(item.dueDate) ?? []),
        item,
      ]);
    }

    return [...map.entries()].sort(([a], [b]) =>
      a.localeCompare(b)
    );

  }, [visible]);

  const today = tasks.filter(
    (item) => item.dueDate === hojeNaOperacao()
  );

  const done = tasks.filter((item) => item.done).length;

  const late = tasks.filter(
    (item) => !item.done && item.dueDate < hojeNaOperacao()
  ).length;

  function salvar(data: TaskDraft | AgendaTask) {

    if ("id" in data) updateTask(data);
    else createTask(data);

    setFormOpen(false);
    setEditing(undefined);
    setPresetDate(undefined);
  }

  function novaAtividade(date?: string) {
    setEditing(undefined);
    setPresetDate(date);
    setFormOpen(true);
  }

  async function enviarAoGoogle(item: AgendaTask) {

    setEnviando(item.id);
    setAviso(undefined);

    const partes = [
      item.type,
      item.relatedCompany,
      item.relatedCase,
    ].filter(Boolean);

    const resultado = await pushTaskToGoogle({
      title: item.title,
      date: item.dueDate,
      time: item.time,
      description: `CW Reputação — ${partes.join(" · ")}`,
    });

    setEnviando(undefined);

    setAviso(
      resultado.ok
        ? {
            ok: true,
            texto: `"${item.title}" foi para a sua agenda do Google.`,
          }
        : {
            ok: false,
            texto:
              resultado.error ??
              "Não foi possível criar o evento.",
          }
    );
  }

  return (
    <MainLayout>

      <div className="space-y-6">

        <PageHeading
          eyebrow="Rotina"
          title="Agenda Operacional"
          description="Atividades, follow-ups, cobranças internas e pendências do time."
        >

          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm font-medium text-zinc-600">

            <input
              type="checkbox"
              checked={showDone}
              onChange={(e) =>
                setShowDone(e.target.checked)
              }
              className="h-4 w-4 accent-violet-600"
            />

            Mostrar resolvidas

          </label>

          <button
            onClick={() => novaAtividade()}
            className="flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-800"
          >
            <Plus size={16} />
            Nova atividade
          </button>

        </PageHeading>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

          <StatTile
            label="Atividades de hoje"
            description="Tarefas agendadas para a data de referência."
            value={today.length}
            hint="agendadas para o dia"
            icon={CalendarClock}
            tone="primary"
          />

          <StatTile
            label="Concluídas"
            description="Atividades já finalizadas."
            value={done}
            hint={`de ${tasks.length} no total`}
            icon={CheckCircle2}
            tone="success"
          />

          <StatTile
            label="Em aberto"
            description="Atividades ainda não concluídas, de qualquer data."
            value={tasks.length - done}
            hint="aguardando execução"
            icon={ListTodo}
            tone="info"
          />

          <StatTile
            label="Atrasadas"
            description="Atividades que venceram sem conclusão."
            value={late}
            hint="venceram sem conclusão"
            icon={CircleAlert}
            tone="danger"
          />

        </div>

        {aviso && (
          <p
            className={`rounded-xl px-4 py-3 text-sm ring-1 ring-inset ${aviso.ok ? "bg-emerald-50 text-emerald-800 ring-emerald-100" : "bg-rose-50 text-rose-700 ring-rose-100"}`}
          >
            {aviso.texto}
          </p>
        )}

        {/*
          O checklist antes da lista de tarefas.

          A agenda mostra o que alguém marcou; o checklist mostra o que
          está aberto e ninguém marcou. Vem antes porque é a metade do
          dia que some — a marcada já está garantida por ter sido
          marcada.
        */}
        <ChecklistDoDia />

        <GoogleCalendarCard />

        <div className="space-y-5">

          {days.map(([date, items]) => {

            const atrasado =
              date < hojeNaOperacao() &&
              items.some((item) => !item.done);

            return (
              <SurfaceCard
                key={date}
                title={formatDay(date)}
                description={`${items.length} atividade(s)${
                  atrasado ? " · há pendências atrasadas" : ""
                }`}
                bodyClassName="p-0"
                action={
                  <button
                    onClick={() => novaAtividade(date)}
                    title="Adicionar atividade neste dia"
                    className="flex shrink-0 items-center gap-1.5 rounded-xl border border-violet-200 px-3 py-1.5 text-xs font-medium text-violet-700 transition-colors hover:bg-violet-50"
                  >
                    <Plus size={13} />
                    Adicionar
                  </button>
                }
              >

                <ul
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragOver(date);
                  }}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={(event) => {
                    event.preventDefault();
                    setDragOver(null);

                    const id =
                      event.dataTransfer.getData(
                        "text/plain"
                      );

                    if (id) moveTask(id, date);
                  }}
                  className={`divide-y divide-zinc-100 transition-colors ${
                    dragOver === date
                      ? "bg-violet-50/50"
                      : ""
                  }`}
                >

                  {items.map((item) => (

                    <li
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
                      className="group flex cursor-grab items-start gap-3.5 px-6 py-3.5 transition-colors active:cursor-grabbing hover:bg-zinc-50/70"
                    >

                      <button
                        onClick={() => toggleTask(item.id)}
                        aria-label={
                          item.done
                            ? `Reabrir ${item.title}`
                            : `Concluir ${item.title}`
                        }
                        title={
                          item.done
                            ? "Reabrir atividade"
                            : "Marcar como resolvida"
                        }
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                          item.done
                            ? "border-emerald-500 bg-emerald-500 text-white"
                            : "border-zinc-300 hover:border-violet-400"
                        }`}
                      >
                        {item.done && (
                          <CheckCircle2 size={13} />
                        )}
                      </button>

                      <span
                        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                          priorityTone[item.priority]
                        }`}
                        title={`Prioridade ${item.priority}`}
                      />

                      <div className="min-w-0 flex-1">

                        <p
                          className={`text-sm font-medium ${
                            item.done
                              ? "text-zinc-400 line-through"
                              : "text-zinc-800"
                          }`}
                        >
                          {item.title}
                        </p>

                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">

                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${
                              typeTone[item.type] ??
                              "bg-zinc-100 text-zinc-600 ring-zinc-200"
                            }`}
                          >
                            {item.type}
                          </span>

                          <span>{item.owner}</span>

                          {item.relatedCompany && (
                            <>
                              <span>·</span>
                              <span className="truncate">
                                {item.relatedCompany}
                              </span>
                            </>
                          )}

                          {item.relatedCase && (
                            <span className="font-mono text-[11px] text-violet-600">
                              {item.relatedCase}
                            </span>
                          )}

                        </div>

                      </div>

                      <div className="flex shrink-0 items-center gap-1">

                        <span className="text-xs font-medium tabular-nums text-zinc-400">
                          {item.time}
                        </span>

                        <div className="flex opacity-0 transition-opacity group-hover:opacity-100">

                          <button
                            onClick={() => enviarAoGoogle(item)}
                            disabled={enviando === item.id}
                            title="Enviar para o Google Agenda"
                            className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-sky-50 hover:text-sky-600 disabled:opacity-40"
                          >
                            <CalendarPlus size={14} />
                          </button>

                          <button
                            onClick={() => {
                              setEditing(item);
                              setPresetDate(undefined);
                              setFormOpen(true);
                            }}
                            title="Editar atividade"
                            className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-violet-50 hover:text-violet-700"
                          >
                            <Pencil size={14} />
                          </button>

                          <button
                            onClick={() => setDeleting(item)}
                            title="Excluir atividade"
                            className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                          >
                            <Trash2 size={14} />
                          </button>

                        </div>

                      </div>

                    </li>

                  ))}

                </ul>

              </SurfaceCard>
            );
          })}

          {days.length === 0 && (
            <SurfaceCard>
              <div className="flex flex-col items-center py-12 text-center">

                <CalendarClock
                  size={28}
                  className="text-zinc-300"
                />

                <p className="mt-3 text-sm font-medium text-zinc-700">
                  Nenhuma atividade pendente.
                </p>

                <button
                  onClick={() => novaAtividade()}
                  className="mt-4 flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-800"
                >
                  <Plus size={15} />
                  Criar a primeira
                </button>

              </div>
            </SurfaceCard>
          )}

        </div>

        <p className="text-xs text-zinc-400">
          Dica: arraste uma atividade para outro dia para
          reagendar.
        </p>

      </div>

      {formOpen && (
        <TaskForm
          key={editing?.id ?? presetDate ?? "novo"}
          open={formOpen}
          editing={editing}
          presetDate={presetDate}
          onClose={() => {
            setFormOpen(false);
            setEditing(undefined);
            setPresetDate(undefined);
          }}
          onSave={salvar}
        />
      )}

      <ConfirmDelete
        open={Boolean(deleting)}
        label={deleting?.title ?? ""}
        onCancel={() => setDeleting(undefined)}
        onConfirm={() => {
          if (deleting) removeTask(deleting.id);
          setDeleting(undefined);
        }}
      />

    </MainLayout>
  );
}
