"use client";

import { useState } from "react";

import { Plus, Trash2 } from "lucide-react";

import {
  IMPACT_DIRECTIONS,
  ImpactTypeOption,
} from "@/lib/models/impact";

import { useImpact } from "@/lib/context/ImpactContext";

import SurfaceCard from "@/components/shared/SurfaceCard";
import { ConfirmDelete } from "@/components/shared/Modal";

const campo =
  "h-10 w-full rounded-xl border border-zinc-200 px-3 text-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-violet-400";

/**
 * Cadastro dos tipos de impacto.
 *
 * Antes eram cinco valores fixos no código: incluir "Multa evitada" ou
 * "Renegociação" exigia mexer no fonte. A direção faz parte do cadastro
 * porque nem todo impacto soma — oferta concedida é dinheiro que saiu.
 */
export default function ImpactTypesCard() {

  const { types, records, saveType, removeType } =
    useImpact();

  const [excluindo, setExcluindo] =
    useState<ImpactTypeOption>();

  /** Quantos lançamentos usam cada tipo — impede exclusão às cegas. */
  function usos(nome: string) {
    return records.filter(
      (item) => item.type === nome
    ).length;
  }

  function adicionar() {
    saveType({
      id: crypto.randomUUID(),
      name: "Novo tipo",
      direction: "receita",
      description: "",
      order: types.length + 1,
      active: true,
    });
  }

  return (
    <>
      <SurfaceCard
        title="Tipos de impacto"
        description="O que a operação consegue registrar como resultado."
        hint="A direção define o sinal na conta: receita soma ao impacto, custo subtrai. Uma oferta concedida é custo — somá-la inflaria o resultado."
        action={
          <button
            onClick={adicionar}
            className="flex shrink-0 items-center gap-2 rounded-xl border border-violet-200 px-3.5 py-2 text-sm font-medium text-violet-700 transition-colors hover:bg-violet-50"
          >
            <Plus size={15} />
            Novo tipo
          </button>
        }
        bodyClassName="p-0"
      >

        <div className="overflow-x-auto">

          <table className="min-w-full">

            <thead className="bg-zinc-50">

              <tr>

                {[
                  "Nome",
                  "Direção",
                  "Quando usar",
                  "Lançamentos",
                  "Ativo",
                  "",
                ].map((head, index) => (
                  <th
                    key={head || index}
                    className="whitespace-nowrap px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500"
                  >
                    {head}
                  </th>
                ))}

              </tr>

            </thead>

            <tbody className="divide-y divide-zinc-100">

              {types.map((item) => (

                <tr
                  key={item.id}
                  className={`group text-sm ${item.active ? "" : "opacity-55"}`}
                >

                  <td className="px-5 py-3">
                    <input
                      value={item.name}
                      onChange={(e) =>
                        saveType({
                          ...item,
                          name: e.target.value,
                        })
                      }
                      className={`${campo} w-52`}
                    />
                  </td>

                  <td className="px-5 py-3">
                    <select
                      value={item.direction}
                      onChange={(e) =>
                        saveType({
                          ...item,
                          direction: e.target
                            .value as ImpactTypeOption["direction"],
                        })
                      }
                      title={
                        IMPACT_DIRECTIONS.find(
                          (d) => d.value === item.direction
                        )?.hint
                      }
                      className={`${campo} w-32`}
                    >
                      {IMPACT_DIRECTIONS.map((d) => (
                        <option
                          key={d.value}
                          value={d.value}
                        >
                          {d.label}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td className="px-5 py-3">
                    <input
                      value={item.description ?? ""}
                      onChange={(e) =>
                        saveType({
                          ...item,
                          description: e.target.value,
                        })
                      }
                      placeholder="Ex.: cliente desistiu do cancelamento."
                      className={`${campo} min-w-[260px]`}
                    />
                  </td>

                  <td className="whitespace-nowrap px-5 py-3 tabular-nums text-zinc-600">
                    {usos(item.name)}
                  </td>

                  <td className="px-5 py-3">
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-600">
                      <input
                        type="checkbox"
                        checked={item.active}
                        onChange={(e) =>
                          saveType({
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
                      onClick={() => setExcluindo(item)}
                      aria-label={`Excluir ${item.name}`}
                      title="Excluir tipo"
                      className="rounded-lg p-2 text-zinc-400 opacity-0 transition-all hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>

                </tr>

              ))}

            </tbody>

          </table>

          {types.length === 0 && (
            <p className="py-10 text-center text-sm text-zinc-400">
              Nenhum tipo cadastrado.
            </p>
          )}

        </div>

      </SurfaceCard>

      <ConfirmDelete
        open={Boolean(excluindo)}
        label={excluindo?.name ?? ""}
        onCancel={() => setExcluindo(undefined)}
        onConfirm={() => {
          if (excluindo) removeType(excluindo.id);
          setExcluindo(undefined);
        }}
      />
    </>
  );
}
