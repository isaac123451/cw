"use client";

import { useState } from "react";

import { Plus, Trash2 } from "lucide-react";

import SurfaceCard from "@/components/shared/SurfaceCard";
import BarraDeSalvar from "@/components/shared/BarraDeSalvar";

import { useRascunho } from "@/lib/hooks/useRascunho";
import { sincronizar } from "@/lib/context/sync";

import {
  centavosDoTexto,
  PlanKind,
  PlanOption,
  precoEmReais,
} from "@/lib/models/plan";

import {
  removePlan,
  savePlan,
} from "@/lib/actions/plans";

const campo =
  "h-9 w-full rounded-lg border border-zinc-200 px-2.5 text-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-violet-400";

interface Props {
  itens: PlanOption[];
  kind: PlanKind;
  titulo: string;
  descricao: string;
  dica: string;
  onSaved: () => Promise<void>;
}

/**
 * Cadastro de planos ou de módulos — a mesma tabela, dois recortes.
 *
 * Existe por causa das macros. O texto pronto que explica preço tinha o
 * valor **digitado dentro dele**, e preço digitado em texto envelhece
 * calado: ninguém revisa uma resposta pronta quando a tabela muda, e o
 * consumidor recebe um número que não existe mais.
 *
 * Com o cadastro, a macro escreve `{{planos}}` e a tabela é montada na
 * hora da inserção — o valor errado deixa de ser possível por
 * construção.
 */
export default function PlanosCard({
  itens,
  kind,
  titulo,
  descricao,
  dica,
  onSaved,
}: Props) {

  const doRecorte = itens.filter(
    (item) => item.kind === kind
  );

  const rascunho = useRascunho<PlanOption>(
    doRecorte,
    (item) => sincronizar(() => savePlan(item))
  );

  const [removendo, setRemovendo] = useState<string>();

  const ordenados = [...rascunho.itens].sort(
    (a, b) => a.order - b.order
  );

  async function excluir(item: PlanOption) {

    /**
     * Item que só existe no rascunho é esquecido, não apagado.
     *
     * Mandar o servidor apagar um id `padrao-` — ou um que ainda não
     * foi gravado — devolveria erro sobre uma linha que nunca existiu.
     */
    if (
      item.id.startsWith("padrao-") ||
      item.id.startsWith("novo-")
    ) {
      rascunho.esquecer(item.id);
      return;
    }

    setRemovendo(item.id);

    await sincronizar(() => removePlan(item.id));

    rascunho.esquecer(item.id);

    setRemovendo(undefined);

    await onSaved();
  }

  return (
    <SurfaceCard
      title={titulo}
      description={descricao}
      hint={dica}
      bodyClassName="p-0"
    >

      <ul className="divide-y divide-zinc-100">

        {ordenados.map((item) => (

          <li key={item.id} className="space-y-2 px-5 py-3.5">

            <div className="flex flex-wrap items-center gap-2">

              <input
                value={item.name}
                onChange={(e) =>
                  rascunho.alterar(item.id, {
                    name: e.target.value,
                  })
                }
                placeholder="Nome"
                className={`${campo} min-w-[180px] flex-1`}
              />

              <div className="flex shrink-0 items-center gap-1.5">

                <span className="text-xs text-zinc-500">
                  R$
                </span>

                <input
                  /*
                    O preço se digita como se escreve, e é guardado em
                    centavos. Dinheiro em ponto flutuante soma errado, e
                    o erro só aparece no total de um relatório meses
                    depois.
                  */
                  defaultValue={(
                    item.priceCents / 100
                  ).toFixed(2).replace(".", ",")}
                  onBlur={(e) =>
                    rascunho.alterar(item.id, {
                      priceCents: centavosDoTexto(
                        e.target.value
                      ),
                    })
                  }
                  placeholder="0,00"
                  className={`${campo} w-24 text-right tabular-nums`}
                />

                <span className="text-xs text-zinc-400">
                  /mês
                </span>

              </div>

              <input
                type="number"
                value={item.order}
                onChange={(e) =>
                  rascunho.alterar(item.id, {
                    order: Number(e.target.value),
                  })
                }
                title="Ordem na tabela"
                className={`${campo} w-16 shrink-0`}
              />

              <label className="flex shrink-0 items-center gap-1.5 text-xs text-zinc-600">
                <input
                  type="checkbox"
                  checked={item.active}
                  onChange={(e) =>
                    rascunho.alterar(item.id, {
                      active: e.target.checked,
                    })
                  }
                />
                ativo
              </label>

              <button
                onClick={() => excluir(item)}
                disabled={removendo === item.id}
                title="Excluir"
                className="shrink-0 rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"
              >
                <Trash2 size={14} />
              </button>

            </div>

            <input
              value={item.description ?? ""}
              onChange={(e) =>
                rascunho.alterar(item.id, {
                  description: e.target.value,
                })
              }
              placeholder="Para quem serve, em uma frase"
              className={campo}
            />

            {kind === "plano" && (
              <textarea
                value={item.features.join("\n")}
                onChange={(e) =>
                  rascunho.alterar(item.id, {
                    /*
                      Uma linha por recurso.

                      Lista em campo de texto separado por vírgula
                      quebra no primeiro recurso que tem vírgula dentro
                      — e "delivery, retirada e consumo no local" tem.
                    */
                    features: e.target.value.split("\n"),
                  })
                }
                rows={3}
                placeholder="O que está incluído — um por linha"
                className="w-full rounded-lg border border-zinc-200 px-2.5 py-2 text-xs outline-none transition-colors placeholder:text-zinc-400 focus:border-violet-400"
              />
            )}

            {!item.active && (
              <p className="text-[11px] text-zinc-400">
                Desativado: não entra na tabela que a macro
                monta.
              </p>
            )}

          </li>

        ))}

      </ul>

      <div className="border-t border-zinc-100 px-5 py-3">

        <button
          onClick={() =>
            rascunho.adicionar({
              id: `novo-${Date.now()}`,
              name: "",
              kind,
              priceCents: 0,
              description: "",
              features: [],
              order: rascunho.itens.length + 1,
              active: true,
            })
          }
          className="flex items-center gap-2 rounded-xl border border-dashed border-zinc-300 px-3.5 py-2 text-sm font-medium text-zinc-600 transition-colors hover:border-violet-300 hover:text-violet-700"
        >
          <Plus size={15} />
          {kind === "plano" ? "Novo plano" : "Novo módulo"}
        </button>

        <p className="mt-3 text-xs leading-relaxed text-zinc-500">
          A soma de hoje:{" "}
          <strong className="font-semibold text-zinc-700">
            {precoEmReais(
              ordenados
                .filter((item) => item.active)
                .reduce(
                  (total, item) =>
                    total + item.priceCents,
                  0
                )
            )}
          </strong>{" "}
          se alguém contratasse tudo. Serve de conferência
          contra a central de ajuda.
        </p>

      </div>

      <BarraDeSalvar
        rascunho={rascunho}
        nome={kind === "plano" ? "planos" : "módulos"}
      />

    </SurfaceCard>
  );
}
