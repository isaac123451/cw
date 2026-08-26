"use client";

import { useState } from "react";

import { Plus, Search, Trash2 } from "lucide-react";

import { useSettings } from "@/lib/context/SettingsContext";
import { useRascunho } from "@/lib/hooks/useRascunho";
import { useScopedCases } from "@/lib/context/useScopedCases";

import SurfaceCard from "@/components/shared/SurfaceCard";
import BarraDeSalvar from "@/components/shared/BarraDeSalvar";

/**
 * As cores que uma etiqueta pode ter.
 *
 * Eram oito, e o Isaac pediu mais: com poucas cores, a nona etiqueta
 * repete a cor da primeira e a distinção visual — que é a razão de a
 * etiqueta ser colorida — desaparece. Uma etiqueta que tem a mesma cor
 * de outra é uma etiqueta que só se lê pelo texto, e aí a cor virou
 * enfeite.
 *
 * Vinte e quatro, em três intensidades de oito matizes. As intensidades
 * importam tanto quanto os matizes: dois verdes diferentes distinguem-se
 * de relance, e é isso que se pede a um quadro cheio.
 *
 * Todas passam em contraste sobre branco no texto do chip — o
 * `TagPicker` desenha a cor a 18% de opacidade no fundo e cheia no
 * texto, então a cor precisa ser legível sozinha.
 */
const PALETTE = [
  // Vivas
  "#22C55E",
  "#0EA5E9",
  "#7C3AED",
  "#F59E0B",
  "#EF4444",
  "#EC4899",
  "#14B8A6",
  "#71717A",

  // Escuras — mesma família, outra leitura
  "#15803D",
  "#0369A1",
  "#5B21B6",
  "#B45309",
  "#B91C1C",
  "#BE185D",
  "#0F766E",
  "#3F3F46",

  // Outros matizes, para quem já usou os oito primeiros
  "#65A30D",
  "#4F46E5",
  "#9333EA",
  "#EA580C",
  "#DC2626",
  "#DB2777",
  "#0891B2",
  "#525252",
];

export default function TagsSettings() {

  const { tags, saveTag, removeTag } = useSettings();

  /**
   * Editar não grava; o botão Salvar grava.
   *
   * Antes cada tecla digitada ia ao banco: o nome pela metade virava
   * uma gravação, e nunca havia um momento em que dissesse "salvo".
   * Ver `lib/hooks/useRascunho.ts`.
   */
  const rascunho = useRascunho(tags, saveTag);

  /**
   * Apagar continua imediato — não precisa de Salvar. A trava é outra:
   * item que só existe no rascunho nunca chegou ao banco, e mandar
   * apagar um id inexistente devolveria erro do servidor.
   */
  function apagar(id: string) {

    const existeNoBanco = tags.some(
      (item) => item.id === id
    );

    rascunho.esquecer(id);

    if (existeNoBanco) removeTag(id);
  }

  const { cases } = useScopedCases("reclame-aqui");

  const [search, setSearch] = useState("");

  const visible = rascunho.itens.filter((item) =>
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
    rascunho.adicionar({
      id: crypto.randomUUID(),
      name: "Nova etiqueta",
      color: PALETTE[tags.length % PALETTE.length],
      description: "",
      order: rascunho.itens.length + 1,
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
                            rascunho.alterar(item.id, { color })
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
                        rascunho.alterar(item.id, {
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
                        rascunho.alterar(item.id, {
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
                      onClick={() => apagar(item.id)}
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

      <BarraDeSalvar

        rascunho={rascunho}

        nome="etiquetas"

        genero="f"

      />


    </SurfaceCard>
  );
}
