"use client";

import { useState } from "react";

import { Plus, Search, Trash2 } from "lucide-react";

import { useSettings } from "@/lib/context/SettingsContext";

import SurfaceCard from "@/components/shared/SurfaceCard";

export default function CategoriesSettings() {

  const {
    categories,
    saveCategory,
    removeCategory,
  } = useSettings();

  const [search, setSearch] = useState("");

  const visible = categories.filter((item) =>
    item.name
      .toLowerCase()
      .includes(search.trim().toLowerCase())
  );

  function addCategory() {
    saveCategory({
      id: crypto.randomUUID(),
      name: "Nova categoria",
      description: "",
      order: categories.length + 1,
      active: true,
    });
  }

  return (
    <SurfaceCard
      title="Categorias"
      description="Agrupam as reclamações por tipo de problema. Mantenha nomes claros e descrição enxuta."
      action={
        <button
          onClick={addCategory}
          className="flex shrink-0 items-center gap-2 rounded-xl border border-violet-200 px-3.5 py-2 text-sm font-medium text-violet-700 transition-colors hover:bg-violet-50"
        >
          <Plus size={15} />
          Nova categoria
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
            placeholder="Buscar categoria..."
            className="h-10 w-full rounded-xl border border-zinc-200 pl-10 pr-3 text-sm outline-none transition-colors focus:border-violet-400"
          />

        </div>

      </div>

      <div className="overflow-x-auto">

        <table className="min-w-full">

          <thead className="bg-zinc-50">

            <tr>

              <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                Nome da categoria
              </th>

              <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                Descrição
              </th>

              <th
                title="Meta para a média do tempo de resposta desta categoria. Em branco, a categoria não é cobrada."
                className="whitespace-nowrap px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500"
              >
                Teto do tempo médio (h)
              </th>

              <th className="whitespace-nowrap px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                Ativa
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
                    value={item.name}
                    onChange={(e) =>
                      saveCategory({
                        ...item,
                        name: e.target.value,
                      })
                    }
                    className="h-10 w-52 rounded-xl border border-zinc-200 px-3 text-sm outline-none transition-colors focus:border-violet-400"
                  />

                </td>

                <td className="px-5 py-3">

                  <input
                    value={item.description}
                    onChange={(e) =>
                      saveCategory({
                        ...item,
                        description: e.target.value,
                      })
                    }
                    placeholder="Ex.: problemas relacionados ao atendimento."
                    className="h-10 w-full min-w-[260px] rounded-xl border border-zinc-200 px-3 text-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-violet-400"
                  />

                </td>

                <td className="px-5 py-3">

                  <input
                    type="number"
                    min={1}
                    value={item.ceilingHours ?? ""}
                    onChange={(e) =>
                      saveCategory({
                        ...item,
                        // Campo vazio significa "sem teto", não zero.
                        ceilingHours:
                          e.target.value === ""
                            ? undefined
                            : Number(e.target.value),
                      })
                    }
                    placeholder="sem teto"
                    title="Meta para a média do tempo de resposta desta categoria."
                    className="h-10 w-28 rounded-xl border border-zinc-200 px-3 text-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-violet-400"
                  />

                </td>

                <td className="px-5 py-3">

                  <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-600">

                    <input
                      type="checkbox"
                      checked={item.active}
                      onChange={(e) =>
                        saveCategory({
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
                    onClick={() => removeCategory(item.id)}
                    aria-label={`Excluir ${item.name}`}
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
            Nenhuma categoria encontrada.
          </p>
        )}

      </div>

    </SurfaceCard>
  );
}
