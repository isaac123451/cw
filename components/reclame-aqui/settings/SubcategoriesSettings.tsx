"use client";

import { useState } from "react";

import { Plus, Search, Trash2 } from "lucide-react";

import { useSettings } from "@/lib/context/SettingsContext";
import { useRascunho } from "@/lib/hooks/useRascunho";

import SurfaceCard from "@/components/shared/SurfaceCard";
import BarraDeSalvar from "@/components/shared/BarraDeSalvar";

export default function SubcategoriesSettings() {

  const {
    categories,
    subcategories,
    saveSubcategory,
    removeSubcategory,
  } = useSettings();

  /**
   * Editar não grava; o botão Salvar grava.
   *
   * Antes cada tecla digitada ia ao banco: o nome pela metade virava
   * uma gravação, e nunca havia um momento em que dissesse "salvo".
   * Ver `lib/hooks/useRascunho.ts`.
   */
  const rascunho = useRascunho(subcategories, saveSubcategory);

  /**
   * Apagar continua imediato — não precisa de Salvar. A trava é outra:
   * item que só existe no rascunho nunca chegou ao banco, e mandar
   * apagar um id inexistente devolveria erro do servidor.
   */
  function apagar(id: string) {

    const existeNoBanco = subcategories.some(
      (item) => item.id === id
    );

    rascunho.esquecer(id);

    if (existeNoBanco) removeSubcategory(id);
  }

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");

  const visible = rascunho.itens.filter((item) => {

    if (filter && item.category !== filter) {
      return false;
    }

    return item.name
      .toLowerCase()
      .includes(search.trim().toLowerCase());
  });

  function addSubcategory() {
    rascunho.adicionar({
      id: crypto.randomUUID(),
      category: categories[0]?.name ?? "",
      name: "Nova subcategoria",
      description: "",
      order: rascunho.itens.length + 1,
      active: true,
    });
  }

  return (
    <SurfaceCard
      title="Subcategorias"
      description="Detalham o motivo da reclamação dentro de cada categoria. Toda subcategoria precisa de uma categoria válida."
      action={
        <button
          onClick={addSubcategory}
          className="flex shrink-0 items-center gap-2 rounded-xl border border-violet-200 px-3.5 py-2 text-sm font-medium text-violet-700 transition-colors hover:bg-violet-50"
        >
          <Plus size={15} />
          Nova subcategoria
        </button>
      }
      bodyClassName="p-0"
    >

      <div className="flex flex-wrap gap-3 border-b border-zinc-100 p-4">

        <div className="relative max-w-xs flex-1">

          <Search
            size={15}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400"
          />

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar subcategoria..."
            className="h-10 w-full rounded-xl border border-zinc-200 pl-10 pr-3 text-sm outline-none transition-colors focus:border-violet-400"
          />

        </div>

        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="h-10 rounded-xl border border-zinc-200 px-3 text-sm text-zinc-700 outline-none transition-colors focus:border-violet-400"
        >
          <option value="">Todas as categorias</option>

          {categories.map((item) => (
            <option key={item.id} value={item.name}>
              {item.name}
            </option>
          ))}
        </select>

      </div>

      <div className="overflow-x-auto">

        <table className="min-w-full">

          <thead className="bg-zinc-50">

            <tr>

              <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                Categoria
              </th>

              <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                Subcategoria
              </th>

              <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                Descrição
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

                  <select
                    value={item.category}
                    onChange={(e) =>
                      rascunho.alterar(item.id, {
                        category: e.target.value,
                      })
                    }
                    className="h-10 w-44 rounded-xl border border-zinc-200 px-3 text-sm outline-none transition-colors focus:border-violet-400"
                  >
                    {categories.map((option) => (
                      <option
                        key={option.id}
                        value={option.name}
                      >
                        {option.name}
                      </option>
                    ))}
                  </select>

                </td>

                <td className="px-5 py-3">

                  <input
                    value={item.name}
                    onChange={(e) =>
                      rascunho.alterar(item.id, {
                        name: e.target.value,
                      })
                    }
                    className="h-10 w-56 rounded-xl border border-zinc-200 px-3 text-sm outline-none transition-colors focus:border-violet-400"
                  />

                </td>

                <td className="px-5 py-3">

                  <input
                    value={item.description}
                    onChange={(e) =>
                      rascunho.alterar(item.id, {
                        description: e.target.value,
                      })
                    }
                    placeholder="Ex.: detalhamento do problema dentro da categoria."
                    className="h-10 w-full min-w-[240px] rounded-xl border border-zinc-200 px-3 text-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-violet-400"
                  />

                </td>

                <td className="px-5 py-3">

                  <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-600">

                    <input
                      type="checkbox"
                      checked={item.active}
                      onChange={(e) =>
                        rascunho.alterar(item.id, {
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
                    onClick={() =>
                      apagar(item.id)
                    }
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
            Nenhuma subcategoria encontrada.
          </p>
        )}

      </div>

      <BarraDeSalvar

        rascunho={rascunho}

        nome="subcategorias"

        genero="f"

      />


    </SurfaceCard>
  );
}
