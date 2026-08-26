"use client";

import { useState } from "react";

import { Plus, Search, Trash2 } from "lucide-react";

import { useSettings } from "@/lib/context/SettingsContext";
import { useRascunho } from "@/lib/hooks/useRascunho";

import SurfaceCard from "@/components/shared/SurfaceCard";
import BarraDeSalvar from "@/components/shared/BarraDeSalvar";

export default function ChecklistSettings() {

  const {
    checklist,
    saveChecklistItem,
    removeChecklistItem,
  } = useSettings();

  /**
   * Editar não grava; o botão Salvar grava.
   *
   * Antes cada tecla digitada ia ao banco: o nome pela metade virava
   * uma gravação, e nunca havia um momento em que dissesse "salvo".
   * Ver `lib/hooks/useRascunho.ts`.
   */
  const rascunho = useRascunho(checklist, saveChecklistItem);

  /**
   * Apagar continua imediato — não precisa de Salvar. A trava é outra:
   * item que só existe no rascunho nunca chegou ao banco, e mandar
   * apagar um id inexistente devolveria erro do servidor.
   */
  function apagar(id: string) {

    const existeNoBanco = checklist.some(
      (item) => item.id === id
    );

    rascunho.esquecer(id);

    if (existeNoBanco) removeChecklistItem(id);
  }

  const [search, setSearch] = useState("");

  const visible = rascunho.itens.filter((item) =>
    item.label
      .toLowerCase()
      .includes(search.trim().toLowerCase())
  );

  /**
   * A chave nasce do nome, e some da tela.
   *
   * Ela era uma coluna editável ao lado do item, e o Isaac perguntou
   * para que serve — pergunta certa: **nada no sistema lê esse campo**.
   * Nenhuma tela, nenhum serviço, nenhuma rota. Era um campo técnico
   * exposto a quem cadastra, pedindo uma decisão sem consequência.
   *
   * A coluna continua no banco porque é `NOT NULL` e porque um
   * identificador estável do item pode vir a servir — para uma
   * integração, um relatório, uma migração. O que muda é quem a
   * escreve: aqui, derivada do nome, em vez de ninguém saber o que
   * digitar.
   */
  function chaveDe(label: string) {
    return (
      label
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 48) || "item"
    );
  }

  function addItem() {
    rascunho.adicionar({
      id: crypto.randomUUID(),
      label: "Novo item",
      key: chaveDe("Novo item"),
      required: false,
      order: rascunho.itens.length + 1,
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
                      rascunho.alterar(item.id, {
                        label: e.target.value,
                        key: chaveDe(e.target.value),
                      })
                    }
                    className="h-10 w-full min-w-[240px] rounded-xl border border-zinc-200 px-3 text-sm outline-none transition-colors focus:border-violet-400"
                  />

                </td>

                <td className="px-5 py-3">

                  <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-600">

                    <input
                      type="checkbox"
                      checked={item.required}
                      onChange={(e) =>
                        rascunho.alterar(item.id, {
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
                        rascunho.alterar(item.id, {
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
                      apagar(item.id)
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

      <BarraDeSalvar

        rascunho={rascunho}

        nome="itens do checklist"

        genero="m"

      />


    </SurfaceCard>
  );
}
