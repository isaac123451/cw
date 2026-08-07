"use client";

import { useState } from "react";

import { Plus, Search, Trash2 } from "lucide-react";

import { useSettings } from "@/lib/context/SettingsContext";

import SurfaceCard from "@/components/shared/SurfaceCard";

export default function ChecklistSettings() {

  const {
    checklist,
    saveChecklistItem,
    removeChecklistItem,
  } = useSettings();

  const [search, setSearch] = useState("");

  const visible = checklist.filter((item) =>
    item.label
      .toLowerCase()
      .includes(search.trim().toLowerCase())
  );

  function addItem() {
    saveChecklistItem({
      id: crypto.randomUUID(),
      label: "Novo item",
      key: "novo_item",
      required: false,
      order: checklist.length + 1,
      active: true,
    });
  }

  return (
    <SurfaceCard
      title="Checklist de resolução"
      description="Etapas que o responsável deve cumprir antes de encerrar uma reclamação. Aparecem na tela de detalhes do caso."
      action={
        <button
          onClick={addItem}
          className="flex shrink-0 items-center gap-2 rounded-xl border border-violet-200 px-3.5 py-2 text-sm font-medium text-violet-700 transition-colors hover:bg-violet-50"
        >
          <Plus size={15} />
          Novo item
        </button>
      }
      bodyClassName="p-0"
    >

      <div className="border-b border-zinc-100 p-4">

        <div className="relative max-w-sm">

          <Search
            size={15}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400"
          />

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar item..."
            className="h-10 w-full rounded-xl border border-zinc-200 pl-10 pr-3 text-sm outline-none transition-colors focus:border-violet-400"
          />

        </div>

      </div>

      <div className="overflow-x-auto">

        <table className="min-w-full">

          <thead className="bg-zinc-50">

            <tr>

              <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                Item do checklist
              </th>

              <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                Chave
              </th>

              <th className="whitespace-nowrap px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                Obrigatório
              </th>

              <th className="whitespace-nowrap px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                Ativo
              </th>

              <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                Ações
              </th>

            </tr>

          </thead>

          <tbody className="divide-y divide-zinc-100">

            {visible.map((item) => (

              <tr key={item.id}>

                <td className="px-5 py-3">

                  <input
                    value={item.label}
                    onChange={(e) =>
                      saveChecklistItem({
                        ...item,
                        label: e.target.value,
                      })
                    }
                    className="h-10 w-full min-w-[240px] rounded-xl border border-zinc-200 px-3 text-sm outline-none transition-colors focus:border-violet-400"
                  />

                </td>

                <td className="px-5 py-3">

                  <input
                    value={item.key}
                    onChange={(e) =>
                      saveChecklistItem({
                        ...item,
                        key: e.target.value,
                      })
                    }
                    className="h-10 w-52 rounded-xl border border-zinc-200 px-3 font-mono text-xs outline-none transition-colors focus:border-violet-400"
                  />

                </td>

                <td className="px-5 py-3">

                  <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-600">

                    <input
                      type="checkbox"
                      checked={item.required}
                      onChange={(e) =>
                        saveChecklistItem({
                          ...item,
                          required: e.target.checked,
                        })
                      }
                      className="h-4 w-4 accent-violet-600"
                    />

                    Obrigatório

                  </label>

                </td>

                <td className="px-5 py-3">

                  <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-600">

                    <input
                      type="checkbox"
                      checked={item.active}
                      onChange={(e) =>
                        saveChecklistItem({
                          ...item,
                          active: e.target.checked,
                        })
                      }
                      className="h-4 w-4 accent-violet-600"
                    />

                    Ativo

                  </label>

                </td>

                <td className="px-5 py-3 text-right">

                  <button
                    onClick={() =>
                      removeChecklistItem(item.id)
                    }
                    aria-label={`Excluir ${item.label}`}
                    className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                  >
                    <Trash2 size={16} />
                  </button>

                </td>

              </tr>

            ))}

          </tbody>

        </table>

        {visible.length === 0 && (
          <p className="py-10 text-center text-sm text-zinc-400">
            Nenhum item encontrado.
          </p>
        )}

      </div>

    </SurfaceCard>
  );
}
