"use client";

import { useMemo, useState } from "react";

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Pencil,
  Trash2,
} from "lucide-react";

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
 * As colunas que se pode ordenar, e por qual valor.
 *
 * Nem toda coluna ordena: "Status" e "Causa raiz" são rótulos de
 * classificação, e ordenar alfabeticamente por eles agrupa sem
 * hierarquia nenhuma — o que o filtro já faz melhor. As que ordenam são
 * as que têm ordem natural: nota, prazo, data.
 */
const ORDENAVEIS: Record<
  string,
  (item: NpsResponseView) => number | string
> = {
  Nota: (item) => item.score,
  Cliente: (item) => item.customer.toLowerCase(),
  Respondido: (item) => item.respondedAt,
  Prazo: (item) => item.firstContactDueAt,
};

/**
 * Lista em tabela, no mesmo formato do Reclame Aqui.
 *
 * A leitura aqui é de triagem — quem está fora do prazo, que tipo, qual
 * causa — então as colunas repetem as decisões da lista de reclamações
 * em vez de inventar um segundo padrão para a mesma tarefa.
 *
 * **As colunas com ordem natural ordenam nos dois sentidos.** O Isaac
 * pediu: "que seja possível deixar crescente e descrescente quando eu
 * clicar em algo como na nota, respondido, etc". As duas direções
 * respondem perguntas diferentes e as duas são feitas todo dia — as
 * notas mais baixas primeiro para saber quem socorrer, as mais altas
 * para achar quem pedir depoimento.
 */
export default function NpsList({
  itens,
  onOpen,
  onEdit,
  onDelete,
  podeExcluir,
}: Props) {

  /**
   * Nenhuma ordenação escolhida mantém a que veio de fora.
   *
   * A lista chega ordenada por urgência — quem está fora do prazo em
   * cima. Escolher uma coluna por acidente e perder esse arranjo, sem
   * jeito de voltar, seria pior do que não ordenar; por isso o terceiro
   * clique na mesma coluna desliga.
   */
  const [ordem, setOrdem] = useState<{
    coluna: string;
    desc: boolean;
  } | null>(null);

  const ordenados = useMemo(() => {

    if (!ordem) return itens;

    const valor = ORDENAVEIS[ordem.coluna];

    if (!valor) return itens;

    return [...itens].sort((a, b) => {

      const x = valor(a);
      const y = valor(b);

      const cmp =
        typeof x === "number" && typeof y === "number"
          ? x - y
          : String(x).localeCompare(String(y), "pt-BR");

      return ordem.desc ? -cmp : cmp;
    });
  }, [itens, ordem]);

  function alternar(coluna: string) {

    setOrdem((atual) => {

      if (atual?.coluna !== coluna) {
        return { coluna, desc: false };
      }

      // Crescente -> decrescente -> sem ordenação.
      return atual.desc ? null : { coluna, desc: true };
    });
  }

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

                {ORDENAVEIS[h] ? (

                  <button
                    type="button"
                    onClick={() => alternar(h)}
                    title={
                      ordem?.coluna === h
                        ? ordem.desc
                          ? "Clique para voltar à ordem original"
                          : "Clique para inverter"
                        : `Ordenar por ${h}`
                    }
                    className={`group/ord flex items-center gap-1.5 uppercase tracking-wide transition-colors hover:text-zinc-800 ${
                      ordem?.coluna === h
                        ? "text-violet-700"
                        : ""
                    }`}
                  >

                    {h}

                    {ordem?.coluna === h ? (
                      ordem.desc ? (
                        <ArrowDown size={12} />
                      ) : (
                        <ArrowUp size={12} />
                      )
                    ) : (
                      <ArrowUpDown
                        size={12}
                        className="opacity-0 transition-opacity group-hover/ord:opacity-40"
                      />
                    )}

                  </button>

                ) : (
                  h
                )}

              </th>
            ))}
            <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Ações
            </th>
          </tr>
        </thead>

        <tbody className="divide-y divide-zinc-100">

          {ordenados.map((item) => {

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
