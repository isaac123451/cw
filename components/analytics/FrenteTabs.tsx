"use client";

import Link from "next/link";

import {
  ArrowUpRight,
  Gauge,
  AtSign,
  Layers,
  MessageSquareWarning,
} from "lucide-react";

export type Frente =
  | "tudo"
  | "reclame-aqui"
  | "social"
  | "nps";

const ABAS: {
  id: Frente;
  label: string;
  icone: typeof Layers;
  hint: string;
}[] = [
  {
    id: "tudo",
    label: "Tudo",
    icone: Layers,
    hint: "Reclame Aqui e Redes Sociais no mesmo recorte.",
  },
  {
    id: "reclame-aqui",
    label: "Reclame Aqui",
    icone: MessageSquareWarning,
    hint: "Só as reclamações do portal.",
  },
  {
    id: "social",
    label: "Redes Sociais",
    icone: AtSign,
    hint: "Só os atendimentos de rede social.",
  },
  {
    id: "nps",
    label: "NPS",
    icone: Gauge,
    hint: "A pesquisa do portal — outra base, outros indicadores.",
  },
];

/**
 * As frentes, como abas do módulo de Analytics.
 *
 * O Isaac pediu: "o analytics do nps e redes sociais estarão no módulo
 * de analytics, é preciso que tenha abas separadas para verificar cada
 * um".
 *
 * Antes a tela somava tudo num recorte só. Somar faz sentido para
 * "quantos atendimentos tivemos", e faz muito pouco para todo o resto:
 * 341 reclamações e 2 atendimentos de Instagram num mesmo gráfico de
 * categorias significam um gráfico de reclamações com ruído. Separar é
 * o que deixa cada frente ser lida pelo que ela é.
 *
 * **O NPS é outra base.** Ele não vive em `Case` — é `NpsResponse`, com
 * nota de 0 a 10, promotores e detratores, e nenhuma das colunas que os
 * outros dois têm. Por isso a aba dele não filtra a mesma lista: leva
 * para a análise que já existe, inteira, em vez de uma versão pela
 * metade encaixada aqui à força.
 */
export default function FrenteTabs({
  atual,
  onChange,
}: {
  atual: Frente;
  onChange: (f: Frente) => void;
}) {

  return (
    <nav className="overflow-x-auto">

      <div className="flex min-w-max items-center gap-1 rounded-2xl border border-zinc-200/80 bg-white p-1.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">

        {ABAS.map((aba) => {

          const Icone = aba.icone;
          const ativa = aba.id === atual;

          /*
            A aba do NPS é um link, não um botão.

            As outras três recortam a mesma lista e ficam nesta tela; o
            NPS tem análise própria e completa. Fingir que é uma aba
            igual às outras — e mostrar meia análise — seria pior do que
            levar até a inteira.
          */
          if (aba.id === "nps") {
            return (
              <Link
                key={aba.id}
                href="/nps/analise"
                title={aba.hint}
                className="flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
              >
                <Icone size={16} />
                {aba.label}
                <ArrowUpRight
                  size={13}
                  className="opacity-50"
                />
              </Link>
            );
          }

          return (
            <button
              key={aba.id}
              type="button"
              onClick={() => onChange(aba.id)}
              title={aba.hint}
              aria-pressed={ativa}
              className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition-colors ${
                ativa
                  ? "bg-violet-700 text-white shadow-sm shadow-violet-700/25"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
              }`}
            >
              <Icone size={16} />
              {aba.label}
            </button>
          );
        })}

      </div>

    </nav>
  );
}
