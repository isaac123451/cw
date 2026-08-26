"use client";

import Link from "next/link";

import { useMemo } from "react";

import {
  ArrowRight,
  Plus,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import SurfaceCard from "@/components/shared/SurfaceCard";

import { useImpact } from "@/lib/context/ImpactContext";
import { hojeNaOperacao } from "@/lib/services/reputation.service";

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

const typeTone: Record<string, string> = {
  "Cancelamento evitado": "text-emerald-600",
  "Cliente recuperado": "text-violet-600",
  "Módulo contratado": "text-sky-600",
  "Valor recuperado": "text-amber-600",
  "Oferta concedida": "text-rose-600",
};

/** "2026-08" do mês anterior a uma chave `AAAA-MM`. */
function mesAnterior(chave: string) {

  const [ano, mes] = chave.split("-").map(Number);

  return mes === 1
    ? `${ano - 1}-12`
    : `${ano}-${String(mes - 1).padStart(2, "0")}`;
}

/**
 * O impacto financeiro no painel.
 *
 * O cartão somava **a base inteira** e mostrava três números grandes.
 * Um total acumulado desde sempre não responde nada: ele só cresce, e
 * "R$ 148 mil" é o mesmo número em janeiro e em agosto, com a diferença
 * de que em agosto ele pode significar que ninguém registrou nada desde
 * março.
 *
 * Agora o recorte é o **mês corrente**, comparado com o anterior — que
 * é a leitura que muda o que se faz hoje. O acumulado continua ali
 * embaixo, como contexto, e não como manchete.
 */
export default function ImpactSummary() {

  const { records } = useImpact();

  const dados = useMemo(() => {

    const mes = hojeNaOperacao().slice(0, 7);
    const anterior = mesAnterior(mes);

    const soma = (lista: typeof records) => ({
      entradas: lista
        .filter((item) => item.amount > 0)
        .reduce((sum, item) => sum + item.amount, 0),

      custos: lista
        .filter((item) => item.amount < 0)
        .reduce((sum, item) => sum + item.amount, 0),

      liquido: lista.reduce(
        (sum, item) => sum + item.amount,
        0
      ),

      quantidade: lista.length,
    });

    const doMes = records.filter((item) =>
      item.date.startsWith(mes)
    );

    const doAnterior = records.filter((item) =>
      item.date.startsWith(anterior)
    );

    return {
      mes: soma(doMes),
      anterior: soma(doAnterior),
      total: soma(records),

      /*
        As retenções contam à parte porque são o resultado que a área
        defende numa reunião: dinheiro preservado, e não gerado.
      */
      retencoes: doMes.filter((item) =>
        item.type
          .toLowerCase()
          .includes("cancelamento evitado")
      ).length,

      recentes: [...records]
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 4),
    };

  }, [records]);

  /** A variação do líquido contra o mês passado, em porcentagem. */
  const variacao =
    dados.anterior.liquido !== 0
      ? ((dados.mes.liquido - dados.anterior.liquido) /
          Math.abs(dados.anterior.liquido)) *
        100
      : null;

  return (
    <SurfaceCard
      title="Impacto no negócio"
      description={
        dados.total.quantidade === 0
          ? "Nenhum resultado financeiro registrado ainda."
          : `${dados.mes.quantidade} lançamento(s) neste mês · ${dados.total.quantidade} no total.`
      }
      action={
        <Link
          href="/impacto"
          className="flex shrink-0 items-center gap-1.5 text-sm font-medium text-violet-700 transition-colors hover:text-violet-900"
        >
          Ver tudo
          <ArrowRight size={14} />
        </Link>
      }
    >

      {/*
        O zero que explica o motivo.

        Sem isto, o cartão mostrava R$ 0 em três caixas e uma lista
        vazia — o que se lê como "a operação não gerou resultado", e não
        como "ninguém registrou". São coisas muito diferentes, e a
        segunda tem conserto num clique.
      */}
      {dados.total.quantidade === 0 ? (

        <div className="rounded-xl border border-dashed border-zinc-200 px-5 py-8 text-center">

          <p className="text-sm font-medium text-zinc-700">
            Nada registrado até agora.
          </p>

          <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-zinc-500">
            Não é que a operação não tenha gerado
            resultado — é que ele não foi lançado. Cada
            cancelamento evitado ou módulo contratado
            depois de uma tratativa entra aqui.
          </p>

          <Link
            href="/impacto"
            className="mt-3.5 inline-flex items-center gap-1.5 rounded-xl border border-violet-200 px-3 py-1.5 text-xs font-medium text-violet-700 transition-colors hover:bg-violet-50"
          >
            <Plus size={13} />
            Registrar o primeiro
          </Link>

        </div>

      ) : (

        <>

          <div className="grid grid-cols-3 gap-3">

            {[
              {
                label: "Entradas",
                value: dados.mes.entradas,
                tone: "text-emerald-700",
                bg: "bg-emerald-50/60 ring-emerald-100",
                title:
                  "Valor preservado ou gerado neste mês.",
              },
              {
                label: "Ofertas",
                value: dados.mes.custos,
                tone: "text-rose-700",
                bg: "bg-rose-50/60 ring-rose-100",
                title:
                  "Descontos e cortesias concedidos neste mês para resolver casos.",
              },
              {
                label: "Líquido",
                value: dados.mes.liquido,
                tone: "text-violet-700",
                bg: "bg-violet-50/60 ring-violet-100",
                title:
                  "Entradas menos ofertas, neste mês.",
              },
            ].map((item) => (

              <div
                key={item.label}
                title={item.title}
                className={`rounded-xl p-3.5 ring-1 ring-inset ${item.bg}`}
              >

                <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                  {item.label}
                </p>

                <p
                  className={`mt-1 text-base font-semibold tabular-nums ${item.tone}`}
                >
                  {money.format(item.value)}
                </p>

              </div>

            ))}

          </div>

          {/*
            A comparação, que é o que dá sentido ao número.

            "R$ 12.400 neste mês" sozinho não diz se foi um mês bom.
            Ao lado do mês anterior, diz.
          */}
          <p className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-500">

            {variacao !== null && (
              <span
                className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-semibold ${
                  variacao >= 0
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-rose-50 text-rose-700"
                }`}
              >
                {variacao >= 0 ? (
                  <TrendingUp size={11} />
                ) : (
                  <TrendingDown size={11} />
                )}
                {variacao >= 0 ? "+" : ""}
                {variacao.toFixed(0)}%
              </span>
            )}

            <span>
              mês passado:{" "}
              {money.format(dados.anterior.liquido)}
            </span>

            <span>·</span>

            <span>
              acumulado:{" "}
              {money.format(dados.total.liquido)}
            </span>

            {dados.retencoes > 0 && (
              <>
                <span>·</span>
                <span className="font-medium text-emerald-700">
                  {dados.retencoes} cancelamento(s)
                  evitado(s)
                </span>
              </>
            )}

          </p>

          {dados.recentes.length > 0 && (

            <ul className="mt-4 space-y-2 border-t border-zinc-100 pt-4">

              {dados.recentes.map((item) => (

                <li
                  key={item.id}
                  className="flex items-center gap-3 text-sm"
                >

                  <span className="min-w-0 flex-1">

                    <span className="block truncate font-medium text-zinc-700">
                      {item.company}
                    </span>

                    <span
                      className={`text-[11px] ${
                        typeTone[item.type] ??
                        "text-zinc-500"
                      }`}
                    >
                      {item.type}
                    </span>

                  </span>

                  <span
                    className={`shrink-0 text-sm font-semibold tabular-nums ${
                      item.amount < 0
                        ? "text-rose-600"
                        : "text-emerald-600"
                    }`}
                  >
                    {money.format(item.amount)}
                  </span>

                </li>

              ))}

            </ul>

          )}

        </>

      )}

    </SurfaceCard>
  );
}
