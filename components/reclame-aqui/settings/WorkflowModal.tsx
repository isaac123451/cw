"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

import { WorkflowStatus } from "@/lib/models/workflow";

interface Props {
  open: boolean;
  initialData?: WorkflowStatus;
  onClose: () => void;
  onSave: (data: WorkflowStatus) => void;
}

const COLORS = [
  "#8b5cf6",
  "#3b82f6",
  "#06b6d4",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
  "#6366f1",
];

export default function WorkflowModal({
  open,
  initialData,
  onClose,
  onSave,
}: Props) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [order, setOrder] = useState(1);
  const [limit, setLimit] = useState<number | "">("");
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setColor(initialData.color);
      setOrder(initialData.order);
      setLimit(initialData.limit ?? "");
      setActive(initialData.active);
    } else {
      setName("");
      setColor(COLORS[0]);
      setOrder(1);
      setLimit("");
      setActive(true);
    }
  }, [initialData, open]);

  if (!open) return null;

  function handleSave() {
    if (!name.trim()) return;

    onSave({
      id: initialData?.id ?? crypto.randomUUID(),

      name: name.trim(),

      color,

      order,

      active,

      limit:
        limit === ""
          ? undefined
          : Number(limit),

      createdAt:
        initialData?.createdAt ??
        new Date().toISOString(),
    });

    onClose();
  }

  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
      />

      <div className="fixed left-1/2 top-1/2 z-50 w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white shadow-2xl">

        {/* Header */}

        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-5">

          <div>

            <h2 className="text-xl font-bold">

              {initialData
                ? "Editar Etapa"
                : "Nova Etapa"}

            </h2>

            <p className="mt-1 text-sm text-zinc-500">

              Configure a etapa do fluxo.

            </p>

          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-zinc-100"
          >
            <X size={18} />
          </button>

        </div>

        {/* Body */}

        <div className="space-y-6 p-6">

          <div>

            <label className="text-sm font-medium">

              Nome da etapa

            </label>

            <input
              value={name}
              onChange={(e) =>
                setName(e.target.value)
              }
              placeholder="Ex.: Em análise"
              className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none focus:border-violet-500"
            />

          </div>

          <div>

            <label className="text-sm font-medium">

              Cor

            </label>

            <div className="mt-3 flex flex-wrap gap-3">

              {COLORS.map((item) => (

                <button
                  key={item}
                  type="button"
                  onClick={() =>
                    setColor(item)
                  }
                  className={`h-10 w-10 rounded-full border-4 transition ${
                    color === item
                      ? "border-black"
                      : "border-transparent"
                  }`}
                  style={{
                    background: item,
                  }}
                />

              ))}

            </div>

          </div>

          <div className="grid grid-cols-2 gap-5">

            <div>

              <label className="text-sm font-medium">

                Ordem

              </label>

              <input
                type="number"
                value={order}
                onChange={(e) =>
                  setOrder(
                    Number(e.target.value)
                  )
                }
                className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none focus:border-violet-500"
              />

            </div>

            <div>

              <label className="text-sm font-medium">

                Limite de cartões

              </label>

              <input
                type="number"
                value={limit}
                onChange={(e) =>
                  setLimit(
                    e.target.value === ""
                      ? ""
                      : Number(
                          e.target.value
                        )
                  )
                }
                placeholder="Opcional"
                className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none focus:border-violet-500"
              />

            </div>

          </div>

          <label className="flex items-center gap-3">

            <input
              type="checkbox"
              checked={active}
              onChange={(e) =>
                setActive(
                  e.target.checked
                )
              }
            />

            Etapa ativa

          </label>

        </div>

        {/* Footer */}

        <div className="flex justify-end gap-3 border-t border-zinc-200 px-6 py-5">

          <button
            onClick={onClose}
            className="rounded-xl border border-zinc-300 px-5 py-3 font-medium"
          >
            Cancelar
          </button>

          <button
            onClick={handleSave}
            className="rounded-xl bg-violet-600 px-6 py-3 font-medium text-white transition hover:bg-violet-700"
          >
            Salvar
          </button>

        </div>

      </div>
    </>
  );
}