"use client";

import { useState } from "react";

import { Plus, Search, Trash2 } from "lucide-react";

import { useSettings } from "@/lib/context/SettingsContext";
import { useRascunho } from "@/lib/hooks/useRascunho";

import SurfaceCard from "@/components/shared/SurfaceCard";
import BarraDeSalvar from "@/components/shared/BarraDeSalvar";
import { ConfirmDelete } from "@/components/shared/Modal";

/**
 * Times da operação — a aba do módulo Reclame Aqui.
 *
 * **Editar não grava; o botão Salvar grava.** Antes cada tecla digitada
 * ia ao banco — ou melhor, ia para lugar nenhum: esta aba não tinha
 * gravação nenhuma até 21/08/2026, e o time cadastrado sumia no
 * recarregamento seguinte.
 *
 * Exclusão continua imediata, com a confirmação de sempre. Apagar já
 * pergunta antes; deixar a remoção pendente de um segundo clique criaria
 * a dúvida de se a linha ainda existe ou não.
 */
export default function TeamsSettings() {

  const { teams, saveTeam, removeTeam } = useSettings();

  const rascunho = useRascunho(teams, saveTeam);

  const [search, setSearch] = useState("");
  const [apagando, setApagando] = useState<
    { id: string; name: string } | null
  >(null);

  const visible = rascunho.itens.filter((item) =>
    item.name
      .toLowerCase()
      .includes(search.trim().toLowerCase())
  );

  function addTeam() {
    rascunho.adicionar({
      id: crypto.randomUUID(),
      name: "Novo time",
      legacyValue: "",
      order: rascunho.itens.length + 1,
      active: true,
    });
  }

  function confirmarExclusao() {

    if (!apagando) return;

    /**
     * Time que ainda não foi salvo nunca chegou ao banco — some do
     * rascunho e pronto. Chamar a exclusão para ele mandaria o servidor
     * apagar um id que não existe.
     */
    const existeNoBanco = teams.some(
      (item) => item.id === apagando.id
    );

    rascunho.esquecer(apagando.id);

    if (existeNoBanco) removeTeam(apagando.id);

    setApagando(null);
  }

  return (
    <>
      <SurfaceCard
        title="Times da Cardápio Web"
        description="Times usados para classificar responsáveis, investigação e áreas envolvidas nas reclamações."
        action={
          <button
            onClick={addTeam}
            className="flex shrink-0 items-center gap-2 rounded-xl border border-violet-200 px-3.5 py-2 text-sm font-medium text-violet-700 transition-colors hover:bg-violet-50"
          >
            <Plus size={15} />
            Novo time
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
              placeholder="Buscar time..."
              className="h-10 w-full rounded-xl border border-zinc-200 pl-10 pr-3 text-sm outline-none transition-colors focus:border-violet-400"
            />

          </div>

        </div>

        <div className="overflow-x-auto">

          <table className="min-w-full">

            <thead className="bg-zinc-50">

              <tr>

                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  Nome do time
                </th>

                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  Valor legado
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
                      value={item.name}
                      onChange={(e) =>
                        rascunho.alterar(item.id, {
                          name: e.target.value,
                        })
                      }
                      className="h-10 w-52 rounded-xl border border-zinc-200 px-3 text-sm outline-none transition-colors focus:border-violet-400"
                    />

                  </td>

                  <td className="px-5 py-3">

                    <input
                      value={item.legacyValue}
                      onChange={(e) =>
                        rascunho.alterar(item.id, {
                          legacyValue: e.target.value,
                        })
                      }
                      placeholder="Nome usado nas planilhas antigas"
                      className="h-10 w-full min-w-[220px] rounded-xl border border-zinc-200 px-3 text-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-violet-400"
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

                      Ativo

                    </label>

                  </td>

                  <td className="px-5 py-3 text-right">

                    <button
                      onClick={() =>
                        setApagando({
                          id: item.id,
                          name: item.name,
                        })
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
              Nenhum time encontrado.
            </p>
          )}

        </div>

        <BarraDeSalvar
          rascunho={rascunho}
          nome="times"
        />

      </SurfaceCard>

      <ConfirmDelete
        open={apagando !== null}
        label={apagando?.name ?? ""}
        onConfirm={confirmarExclusao}
        onCancel={() => setApagando(null)}
      />
    </>
  );
}
