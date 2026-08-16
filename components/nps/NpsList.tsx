"use client";

import { Pencil, Trash2 } from "lucide-react";

import {
  NpsResponseView,
  segmentOf,
} from "@/lib/models/nps";

import { slaState } from "@/lib/services/nps.service";

const slaTone: Record<string, string> = {
  estourado: "bg-rose-50 text-rose-700 ring-rose-100",
  "vence-hoje":
    "bg-amber-50 text-amber-700 ring-amber-100",
  "no-prazo": "bg-sky-50 text-sky-700 ring-sky-100",
  cumprido:
    "bg-emerald-50 text-emerald-700 ring-emerald-100",
  encerrado: "bg-zinc-100 text-zinc-500 ring-zinc-200",
};

const slaLabel: Record<string, string> = {
  estourado: "Fora do prazo",
  "vence-hoje": "Vence hoje",
  "no-prazo": "No prazo",
  cumprido: "Contatado",
  encerrado: "Encerrado",
};

function dataCurta(iso: string) {
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano.slice(2)}`;
}

interface Props {
  itens: NpsResponseView[];
  onOpen: (item: NpsResponseView) => void;
  onEdit: (item: NpsResponseView) => void;
  onDelete: (item: NpsResponseView) => void;
  /** Só ADMIN exclui; o botão some para os demais. */
  podeExcluir: boolean;
}

/**
 * Lista em tabela, no mesmo formato do Reclame Aqui.
 *
 * A leitura aqui é de triagem — quem está fora do prazo, que tipo, qual
 * causa — então as colunas repetem as decisões da lista de reclamações
 * em vez de inventar um segundo padrão para a mesma tarefa.
 */
export default function NpsList({
  itens,
  onOpen,
  onEdit,
  onDelete,
  podeExcluir,
}: Props) {

  return (
    <div className="overflow-x-auto">

      <table className="min-w-full">

        <thead className="bg-zinc-50">
          <tr>
            {[
              "Nota",
              "Cliente",
              "Tipo",
              "Causa raiz",
              "Respondido",
              "Prazo",
              "Status",
            ].map((h) => (
              <th
                key={h}
                className="whitespace-nowrap px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500"
              >
                {h}
              </th>
            ))}
            <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Ações
            </th>
          </tr>
        </thead>

        <tbody className="divide-y divide-zinc-100">

          {itens.map((item) => {

            const seg = segmentOf(item.score);
            const estado = slaState(item);

            return (
              <tr
                key={item.id}
                onClick={() => onOpen(item)}
                className="group cursor-pointer transition-colors hover:bg-zinc-50/70"
              >

                <td className="whitespace-nowrap px-5 py-3">
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-semibold text-white"
                    style={{ background: seg.color }}
                    title={seg.label}
                  >
                    {item.score}
                  </span>
                </td>

                <td className="px-5 py-3">
                  <p className="max-w-[220px] truncate text-sm font-medium text-zinc-800">
                    {item.customer}
                  </p>
                  {item.company && (
                    <p className="max-w-[220px] truncate text-xs text-zinc-500">
                      {item.company}
                    </p>
                  )}
                </td>

                <td className="whitespace-nowrap px-5 py-3 text-sm text-zinc-600">
                  {item.kind ?? (
                    <span className="text-zinc-300">
                      —
                    </span>
                  )}
                </td>

                <td className="whitespace-nowrap px-5 py-3">
                  {item.rootCause ? (
                    <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] text-zinc-600">
                      {item.rootCause}
                    </span>
                  ) : (
                    <span className="text-zinc-300">—</span>
                  )}
                </td>

                <td className="whitespace-nowrap px-5 py-3 text-sm tabular-nums text-zinc-500">
                  {dataCurta(item.respondedAt)}
                </td>

                <td className="whitespace-nowrap px-5 py-3 text-sm tabular-nums text-zinc-500">
                  {dataCurta(item.firstContactDueAt)}
                </td>

                <td className="whitespace-nowrap px-5 py-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-[10px] font-medium ring-1 ring-inset ${slaTone[estado]}`}
                  >
                    {slaLabel[estado]}
                  </span>
                </td>

                <td className="whitespace-nowrap px-5 py-3 text-right">

                  <span className="flex justify-end opacity-0 transition-opacity group-hover:opacity-100">

                    <button
                      onClick={(e) => {
                        // Sem isto o clique abriria a tratativa junto.
                        e.stopPropagation();
                        onEdit(item);
                      }}
                      title="Editar registro"
                      className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-violet-50 hover:text-violet-700"
                    >
                      <Pencil size={14} />
                    </button>

                    {podeExcluir && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(item);
                        }}
                        title="Excluir registro"
                        className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}

                  </span>

                </td>

              </tr>
            );
          })}

        </tbody>

      </table>

      {itens.length === 0 && (
        <p className="py-10 text-center text-sm text-zinc-400">
          Nenhuma resposta neste recorte.
        </p>
      )}

    </div>
  );
}
