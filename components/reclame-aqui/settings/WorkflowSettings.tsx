"use client";

import { useMemo, useState } from "react";

import {
  ArrowDown,
  ArrowUp,
  GripVertical,
  Pencil,
  Plus,
  Power,
  Trash2,
} from "lucide-react";

import { useWorkflow } from "@/lib/context/WorkflowContext";
import { useScopedCases } from "@/lib/context/useScopedCases";

import { WorkflowStatus } from "@/lib/models/workflow";

import SurfaceCard from "@/components/shared/SurfaceCard";

import WorkflowModal from "./WorkflowModal";

export default function WorkflowSettings() {
  const {
    workflow,
    addStatus,
    updateStatus,
    deleteStatus,
    toggleStatus,
  } = useWorkflow();

  const { cases } = useScopedCases("reclame-aqui");

  const [open, setOpen] = useState(false);

  const [editing, setEditing] =
    useState<WorkflowStatus>();

  const [dragging, setDragging] = useState<string | null>(
    null
  );

  const [dragOver, setDragOver] = useState<string | null>(
    null
  );

  // Cópia antes de ordenar: `sort` muta o array e o do contexto
  // não pode ser alterado durante o render.
  const sorted = useMemo(
    () => [...workflow].sort((a, b) => a.order - b.order),
    [workflow]
  );

  const countByStatus = useMemo(() => {
    const map = new Map<string, number>();

    for (const item of cases) {
      map.set(
        item.status,
        (map.get(item.status) ?? 0) + 1
      );
    }

    return map;
  }, [cases]);

  function newStatus() {
    setEditing(undefined);
    setOpen(true);
  }

  function editStatus(status: WorkflowStatus) {
    setEditing(status);
    setOpen(true);
  }

  function save(status: WorkflowStatus) {
    if (editing) updateStatus(status);
    else addStatus(status);

    setOpen(false);
  }

  /**
   * Move a etapa arrastada para a posição da etapa alvo, empurrando as
   * demais. Reescreve `order` de todas para não abrir buracos.
   */
  function reorderTo(draggedId: string, targetId: string) {

    if (draggedId === targetId) return;

    const from = sorted.findIndex(
      (item) => item.id === draggedId
    );

    const to = sorted.findIndex(
      (item) => item.id === targetId
    );

    if (from === -1 || to === -1) return;

    const next = [...sorted];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);

    next.forEach((item, index) => {
      if (item.order !== index + 1) {
        updateStatus({ ...item, order: index + 1 });
      }
    });
  }

  /** Troca a posição com o vizinho, mantendo `order` consistente. */
  function move(index: number, direction: -1 | 1) {
    const target = sorted[index + direction];

    if (!target) return;

    const current = sorted[index];

    updateStatus({ ...current, order: target.order });
    updateStatus({ ...target, order: current.order });
  }

  const active = sorted.filter((item) => item.active);

  return (
    <>
      <div className="space-y-5">

        <SurfaceCard
          title="Prévia do quadro"
          description="Arraste as colunas para reordenar as etapas do Kanban."
        >

          <div className="flex flex-wrap items-stretch gap-2">

            {active.map((item, index) => (

              <div
                key={item.id}
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData(
                    "text/plain",
                    item.id
                  );
                  event.dataTransfer.effectAllowed = "move";
                  setDragging(item.id);
                }}
                onDragEnd={() => {
                  setDragging(null);
                  setDragOver(null);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragOver(item.id);
                }}
                onDragLeave={() => setDragOver(null)}
                onDrop={(event) => {
                  event.preventDefault();

                  const id =
                    event.dataTransfer.getData("text/plain");

                  setDragOver(null);
                  setDragging(null);

                  if (id) reorderTo(id, item.id);
                }}
                title={`${item.name} — arraste para reordenar`}
                className={`flex min-w-[130px] flex-1 cursor-grab flex-col rounded-xl border p-3 transition-all active:cursor-grabbing ${
                  dragOver === item.id &&
                  dragging !== item.id
                    ? "border-violet-400 bg-violet-50 ring-2 ring-violet-200"
                    : "border-zinc-200 bg-zinc-50/60 hover:border-violet-200"
                } ${
                  dragging === item.id ? "opacity-40" : ""
                }`}
              >

                <div className="flex items-center gap-1.5">

                  <GripVertical
                    size={12}
                    className="shrink-0 text-zinc-300"
                  />

                  <span
                    className="h-1 flex-1 rounded-full"
                    style={{ background: item.color }}
                  />

                </div>

                <p className="mt-2.5 truncate text-sm font-semibold text-zinc-800">
                  {item.name}
                </p>

                <p className="mt-0.5 text-xs text-zinc-500">
                  {countByStatus.get(item.name) ?? 0} caso(s)
                </p>

                <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                  Etapa {index + 1}
                </p>

              </div>

            ))}

            {active.length === 0 && (
              <p className="w-full py-6 text-center text-sm text-zinc-400">
                Nenhuma etapa ativa — o quadro ficaria vazio.
              </p>
            )}

          </div>

        </SurfaceCard>

        <SurfaceCard
          title="Status da reclamação"
          description="Organize os status como uma fila operacional: ordem, cor e limite de cartões por etapa."
          action={
            <button
              onClick={newStatus}
              className="flex shrink-0 items-center gap-2 rounded-xl border border-violet-200 px-3.5 py-2 text-sm font-medium text-violet-700 transition-colors hover:bg-violet-50"
            >
              <Plus size={15} />
              Novo status
            </button>
          }
          bodyClassName="p-0"
        >

          <div className="overflow-x-auto">

            <table className="min-w-full">

              <thead className="bg-zinc-50">

                <tr>

                  {[
                    "Mover",
                    "Cor",
                    "Status",
                    "Casos",
                    "Limite WIP",
                    "Ativo",
                  ].map((head) => (
                    <th
                      key={head}
                      className="whitespace-nowrap px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500"
                    >
                      {head}
                    </th>
                  ))}

                  <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                    Ações
                  </th>

                </tr>

              </thead>

              <tbody className="divide-y divide-zinc-100">

                {sorted.map((item, index) => {

                  const count =
                    countByStatus.get(item.name) ?? 0;

                  const overLimit =
                    typeof item.limit === "number" &&
                    item.limit > 0 &&
                    count > item.limit;

                  return (
                    <tr
                      key={item.id}
                      className={`transition-colors hover:bg-zinc-50/70 ${
                        item.active ? "" : "opacity-55"
                      }`}
                    >

                      <td className="px-5 py-3">

                        <div className="flex items-center gap-1">

                          <button
                            onClick={() => move(index, -1)}
                            disabled={index === 0}
                            aria-label={`Subir ${item.name}`}
                            title="Subir"
                            className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 disabled:cursor-not-allowed disabled:opacity-30"
                          >
                            <ArrowUp size={14} />
                          </button>

                          <button
                            onClick={() => move(index, 1)}
                            disabled={index === sorted.length - 1}
                            aria-label={`Descer ${item.name}`}
                            title="Descer"
                            className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 disabled:cursor-not-allowed disabled:opacity-30"
                          >
                            <ArrowDown size={14} />
                          </button>

                        </div>

                      </td>

                      <td className="px-5 py-3">

                        <span
                          className="block h-6 w-6 rounded-full ring-2 ring-white"
                          style={{
                            background: item.color,
                            boxShadow: `0 0 0 1px ${item.color}40`,
                          }}
                          title={item.color}
                        />

                      </td>

                      <td className="px-5 py-3">

                        <p className="text-sm font-medium text-zinc-800">
                          {item.name}
                        </p>

                        <p className="text-[11px] text-zinc-400">
                          Etapa {item.order}
                        </p>

                      </td>

                      <td className="px-5 py-3">

                        <span
                          className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${
                            overLimit
                              ? "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-100"
                              : "bg-zinc-100 text-zinc-600"
                          }`}
                          title={
                            overLimit
                              ? "Acima do limite WIP"
                              : undefined
                          }
                        >
                          {count}
                        </span>

                      </td>

                      <td className="px-5 py-3">

                        <input
                          type="number"
                          min={0}
                          value={item.limit ?? 0}
                          onChange={(e) =>
                            updateStatus({
                              ...item,
                              limit: Number(e.target.value),
                            })
                          }
                          className="h-9 w-24 rounded-lg border border-zinc-200 px-2.5 text-sm tabular-nums outline-none transition-colors focus:border-violet-400"
                        />

                      </td>

                      <td className="px-5 py-3">

                        <button
                          onClick={() => toggleStatus(item.id)}
                          title={
                            item.active
                              ? "Desativar etapa"
                              : "Ativar etapa"
                          }
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ring-1 ring-inset ${
                            item.active
                              ? "bg-emerald-50 text-emerald-700 ring-emerald-100 hover:bg-emerald-100"
                              : "bg-zinc-100 text-zinc-500 ring-zinc-200 hover:bg-zinc-200"
                          }`}
                        >
                          <Power size={12} />
                          {item.active ? "Ativo" : "Inativo"}
                        </button>

                      </td>

                      <td className="px-5 py-3">

                        <div className="flex items-center justify-end gap-1">

                          <button
                            onClick={() => editStatus(item)}
                            aria-label={`Editar ${item.name}`}
                            title="Editar"
                            className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-violet-50 hover:text-violet-700"
                          >
                            <Pencil size={15} />
                          </button>

                          <button
                            onClick={() => deleteStatus(item.id)}
                            aria-label={`Excluir ${item.name}`}
                            title={
                              count > 0
                                ? `${count} caso(s) usam esta etapa`
                                : "Excluir"
                            }
                            className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                          >
                            <Trash2 size={15} />
                          </button>

                        </div>

                      </td>

                    </tr>
                  );
                })}

              </tbody>

            </table>

          </div>

          <p className="border-t border-zinc-100 px-5 py-3.5 text-xs text-zinc-400">
            Desativar uma etapa a esconde do quadro sem apagar os
            casos que já estão nela.
          </p>

        </SurfaceCard>

      </div>

      <WorkflowModal
        open={open}
        initialData={editing}
        onClose={() => setOpen(false)}
        onSave={save}
      />
    </>
  );
}
