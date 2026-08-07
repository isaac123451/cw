"use client";

import { useState } from "react";

import { Plus, Search, Trash2 } from "lucide-react";

import { useSettings } from "@/lib/context/SettingsContext";
import { useScopedCases } from "@/lib/context/useScopedCases";

import SurfaceCard from "@/components/shared/SurfaceCard";

const PALETTE = [
  "#22C55E",
  "#0EA5E9",
  "#7C3AED",
  "#F59E0B",
  "#EF4444",
  "#EC4899",
  "#14B8A6",
  "#71717A",
];

export default function TagsSettings() {

  const { tags, saveTag, removeTag } = useSettings();

  const { cases } = useScopedCases("reclame-aqui");

  const [search, setSearch] = useState("");

  const visible = tags.filter((item) =>
    item.name
      .toLowerCase()
      .includes(search.trim().toLowerCase())
  );

  /** Quantos casos usam cada etiqueta — evita excluir algo em uso sem saber. */
  function usage(name: string) {
    return cases.filter((item) =>
      (item.tags ?? []).includes(name)
    ).length;
  }

  function addTag() {
    saveTag({
      id: crypto.randomUUID(),
      name: "Nova etiqueta",
      color: PALETTE[tags.length % PALETTE.length],
      description: "",
      order: tags.length + 1,
      active: true,
    });
  }

  return (
    <SurfaceCard
      title="Etiquetas do caso"
      description="Marcações operacionais que aparecem no Kanban e na lista — ex.: “favorável a avaliação”."
      action={
        <button
          onClick={addTag}
          className="flex shrink-0 items-center gap-2 rounded-xl border border-violet-200 px-3.5 py-2 text-sm font-medium text-violet-700 transition-colors hover:bg-violet-50"
        >
          <Plus size={15} />
          Nova etiqueta
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
            placeholder="Buscar etiqueta..."
            className="h-10 w-full rounded-xl border border-zinc-200 pl-10 pr-3 text-sm outline-none transition-colors focus:border-violet-400"
          />

        </div>

      </div>

      <div className="overflow-x-auto">

        <table className="min-w-full">

          <thead className="bg-zinc-50">

            <tr>

              {[
                "Cor",
                "Etiqueta",
                "Descrição",
                "Em uso",
                "Ativa",
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

            {visible.map((item) => {

              const count = usage(item.name);

              return (
                <tr
                  key={item.id}
                  className={
                    item.active ? "" : "opacity-55"
                  }
                >

                  <td className="px-5 py-3">

                    <div className="flex flex-wrap gap-1">

                      {PALETTE.map((color) => (
                        <button
                          key={color}
                          onClick={() =>
                            saveTag({ ...item, color })
                          }
                          aria-label={`Cor ${color}`}
                          title={color}
                          className={`h-5 w-5 rounded-full transition-transform hover:scale-110 ${
                            item.color === color
                              ? "ring-2 ring-zinc-900 ring-offset-1"
                              : ""
                          }`}
                          style={{ background: color }}
                        />
                      ))}

                    </div>

                  </td>

                  <td className="px-5 py-3">

                    <input
                      value={item.name}
                      onChange={(e) =>
                        saveTag({
                          ...item,
                          name: e.target.value,
                        })
                      }
                      className="h-10 w-48 rounded-xl border border-zinc-200 px-3 text-sm outline-none transition-colors focus:border-violet-400"
                    />

                  </td>

                  <td className="px-5 py-3">

                    <input
                      value={item.description}
                      onChange={(e) =>
                        saveTag({
                          ...item,
                          description: e.target.value,
                        })
                      }
                      placeholder="Quando aplicar esta etiqueta"
                      className="h-10 w-full min-w-[260px] rounded-xl border border-zinc-200 px-3 text-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-violet-400"
                    />

                  </td>

                  <td className="px-5 py-3">

                    <span
                      className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${
                        count > 0
                          ? "bg-violet-50 text-violet-700"
                          : "bg-zinc-100 text-zinc-500"
                      }`}
                    >
                      {count}
                    </span>

                  </td>

                  <td className="px-5 py-3">

                    <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-600">

                      <input
                        type="checkbox"
                        checked={item.active}
                        onChange={(e) =>
                          saveTag({
                            ...item,
                            active: e.target.checked,
                          })
                        }
                        className="h-4 w-4 accent-violet-600"
                      />

                      Ativa

                    </label>

                  </td>

                  <td className="px-5 py-3 text-right">

                    <button
                      onClick={() => removeTag(item.id)}
                      aria-label={`Excluir ${item.name}`}
                      title={
                        count > 0
                          ? `${count} caso(s) usam esta etiqueta`
                          : "Excluir"
                      }
                      className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Trash2 size={16} />
                    </button>

                  </td>

                </tr>
              );
            })}

          </tbody>

        </table>

        {visible.length === 0 && (
          <p className="py-10 text-center text-sm text-zinc-400">
            Nenhuma etiqueta encontrada.
          </p>
        )}

      </div>

    </SurfaceCard>
  );
}
