"use client";

import { useMemo, useState } from "react";

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
} from "lucide-react";

import { Case } from "@/lib/models/case";

import CaseRow from "./CaseRow";

interface Props {
  cases: Case[];
  onSelect: (item: Case) => void;
}

/**
 * As colunas que ordenam, e por qual valor.
 *
 * Nem toda coluna entra. "Status" e "Categoria" são rótulos de
 * classificação: ordenar por eles agrupa sem hierarquia, que é o que o
 * filtro já faz melhor. Entram as que têm ordem natural — data, nota,
 * nome — e o par resolvido/voltaria, onde a ordem separa dois grupos
 * que a operação lê como grupos.
 *
 * O mesmo desenho da lista de NPS, de propósito: são a mesma tarefa em
 * duas frentes, e dois padrões para triar seriam duas coisas para
 * aprender.
 */
const ORDENAVEIS: Record<
  string,
  (item: Case) => number | string
> = {
  Data: (item) => item.createdAt ?? "",
  Cliente: (item) => item.customer.toLowerCase(),
  Avaliação: (item) => (item.evaluated ? (item.score ?? 0) : -1),
  Responsável: (item) =>
    (item.owner || "zzz").toLowerCase(),
};

/**
 * As colunas, na ordem em que aparecem.
 *
 * Eram doze — 1.883 px numa tela de 1.366, com rolagem de lado e linha
 * de 93 px (Isaac: "a lista tem muito espaço"). Agora são sete: o
 * estabelecimento vai embaixo do cliente, nota + resolvido + voltaria
 * viram "Avaliação", status + prazo + o que fazer viram "Situação" e o
 * contato vai junto do responsável.
 */
const COLUNAS = [
  "Reclamação",
  "Data",
  "Cliente",
  "Categoria",
  "Avaliação",
  "Situação",
  "Responsável",
];

/* Larguras fixas: somam menos que a área útil de um notebook de 1.366 px. */
const LARGURA: Record<string, string> = {
  Reclamação: "",
  Data: "w-[76px]",
  Cliente: "w-[176px]",
  Categoria: "w-[100px]",
  Avaliação: "w-[72px]",
  Situação: "w-[232px]",
  Responsável: "w-[124px]",
};

/**
 * A lista em tabela.
 *
 * **A data ganhou coluna.** O Isaac: "melhore a parte da data e que
 * seja possível na parte de lista para verificar a data". Ela existia
 * na ficha e no kanban, e faltava justamente onde se compara um caso
 * com o outro — sem ela, a lista mostrava onze colunas e nenhuma
 * respondia "isto é de ontem ou de março".
 *
 * **Ordena nos dois sentidos.** Mais antigas primeiro para atacar a
 * fila; mais recentes para ver o que entrou hoje. As duas perguntas são
 * feitas todo dia, e o terceiro clique devolve a ordem que veio de fora
 * — que é por urgência, e é a que ninguém quer perder por acidente.
 */
export default function CasesTable({
  cases,
  onSelect,
}: Props) {

  const [ordem, setOrdem] = useState<{
    coluna: string;
    desc: boolean;
  } | null>(null);

  const ordenados = useMemo(() => {

    if (!ordem) return cases;

    const valor = ORDENAVEIS[ordem.coluna];

    if (!valor) return cases;

    return [...cases].sort((a, b) => {

      const x = valor(a);
      const y = valor(b);

      const cmp =
        typeof x === "number" && typeof y === "number"
          ? x - y
          : String(x).localeCompare(String(y), "pt-BR");

      return ordem.desc ? -cmp : cmp;
    });
  }, [cases, ordem]);

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
    <div className="flex-1 overflow-auto">

      <table className="w-full min-w-[980px] table-fixed">

        <thead className="sticky top-0 z-10 bg-zinc-50/95 backdrop-blur">

          <tr className="border-b border-zinc-200">

            {COLUNAS.map((h) => (

              <th
                key={h}
                className={`whitespace-nowrap px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-500 first:pl-5 last:pr-5 ${LARGURA[h] ?? ""}`}
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
                    className={`group/ord flex items-center gap-1.5 uppercase tracking-[0.06em] transition-colors hover:text-zinc-800 ${
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

          </tr>

        </thead>

        <tbody>

          {ordenados.map((item) => (

            <CaseRow
              key={item.id}
              data={item}
              onClick={() => onSelect(item)}
            />

          ))}

        </tbody>

      </table>

    </div>
  );
}
