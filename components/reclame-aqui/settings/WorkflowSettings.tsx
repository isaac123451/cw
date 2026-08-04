"use client";

import { useState } from "react";

import {
  Pencil,
  Plus,
  Power,
  Trash2,
} from "lucide-react";

import {
  useWorkflow,
} from "@/lib/context/WorkflowContext";

import WorkflowModal from "./WorkflowModal";

import { WorkflowStatus } from "@/lib/models/workflow";

export default function WorkflowSettings() {
  const {
    workflow,
    addStatus,
    updateStatus,
    deleteStatus,
    toggleStatus,
  } = useWorkflow();

  const [open, setOpen] = useState(false);

  const [editing, setEditing] =
    useState<WorkflowStatus>();

  function newStatus() {
    setEditing(undefined);
    setOpen(true);
  }

  function editStatus(
    status: WorkflowStatus
  ) {
    setEditing(status);
    setOpen(true);
  }

  function save(status: WorkflowStatus) {
    if (editing)
      updateStatus(status);
    else addStatus(status);

    setOpen(false);
  }

  return (
    <>
      <div className="rounded-2xl border border-zinc-200 bg-white">

        <div className="flex items-center justify-between border-b p-5">

          <div>

            <h2 className="font-semibold">

              Fluxo de Atendimento

            </h2>

            <p className="text-sm text-zinc-500">

              Gerencie todas as etapas.

            </p>

          </div>

          <button
            onClick={newStatus}
            className="flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-white"
          >
            <Plus size={18} />

            Nova Etapa
          </button>

        </div>

        <div className="divide-y">

          {workflow
            .sort(
              (a, b) => a.order - b.order
            )
            .map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-5"
              >
                <div className="flex items-center gap-4">

                  <div
                    className="h-4 w-4 rounded-full"
                    style={{
                      background:
                        item.color,
                    }}
                  />

                  <div>

                    <h3 className="font-medium">

                      {item.name}

                    </h3>

                    <p className="text-sm text-zinc-500">

                      Ordem {item.order}

                    </p>

                  </div>

                </div>

                <div className="flex gap-2">

                  <button
                    onClick={() =>
                      toggleStatus(item.id)
                    }
                    className="rounded-lg p-2 hover:bg-zinc-100"
                  >
                    <Power
                      size={18}
                    />
                  </button>

                  <button
                    onClick={() =>
                      editStatus(item)
                    }
                    className="rounded-lg p-2 hover:bg-zinc-100"
                  >
                    <Pencil
                      size={18}
                    />
                  </button>

                  <button
                    onClick={() =>
                      deleteStatus(
                        item.id
                      )
                    }
                    className="rounded-lg p-2 text-red-500 hover:bg-red-50"
                  >
                    <Trash2
                      size={18}
                    />
                  </button>

                </div>

              </div>
            ))}

        </div>

      </div>

      <WorkflowModal
        open={open}
        initialData={editing}
        onClose={() =>
          setOpen(false)
        }
        onSave={save}
      />
    </>
  );
}