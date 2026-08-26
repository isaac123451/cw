"use client";

import Link from "next/link";

import { Settings2, Timer } from "lucide-react";

import { Case } from "@/lib/models/case";

import { useSettings } from "@/lib/context/SettingsContext";

import {
  responseByCategory,
  overCeiling,
  totalBreaches,
} from "@/lib/services/ceiling.service";

import { toneOfSla } from "@/lib/services/sla.service";
import { formatElapsed } from "@/lib/services/reputation.service";
import { formatHours } from "@/lib/models/sla";

import SurfaceCard from "@/components/shared/SurfaceCard";

/**
 * Tempo de resposta por categoria contra o teto declarado.
 *
 * **A barra mede o pior caso, não a média.** Teto é um máximo, e a média
 * de um conjunto que contém um desastre é a maneira mais confiável de
 * esconder o desastre: dez respostas em uma hora e uma esquecida por
 * cem dão média de dez, e a tela pintava de verde contra um teto de
 * vinte e quatro enquanto um consumidor esperava quatro dias.
 *
 * A média continua na linha, à direita, porque as duas perguntas são
 * legítimas e diferentes — o pior diz se alguém foi abandonado, a média
 * diz se a categoria vai bem no geral.
 */
export default function ResponseCeiling({
  cases,
}: {
  cases: Case[];
}) {

  const { categories } = useSettings();

  const linhas = responseByCategory(cases, categories);

  const estouradas = overCeiling(linhas);
  const reclamacoesEstouradas = totalBreaches(linhas);

  /** Quantas categorias nem teto têm — ver o rodapé. */
  const semTeto = linhas.filter(
    (item) => item.ceilingHours === undefined
  ).length;

  return (
    <SurfaceCard
      title="Resposta por categoria"
      description="O pior tempo de cada categoria contra o teto definido em Configurar fluxo."
      hint="A barra mede o pior caso, porque teto é máximo: uma média dentro do teto pode esconder uma reclamação esquecida por dias. Só entram reclamações com tempo de resposta preenchido; categoria sem teto cadastrado não é cobrada."
      action={
        <Link
          href="/reclame-aqui/configuracoes"
          title="Definir o teto de cada categoria na aba Categorias"
          className="flex shrink-0 items-center gap-2 rounded-xl border border-zinc-200 px-3.5 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
        >
          <Settings2 size={15} />
          Definir tetos
        </Link>
      }
    >

      {linhas.length === 0 ? (

        <p className="rounded-xl border border-dashed border-zinc-200 py-10 text-center text-sm text-zinc-400">
          Nenhuma reclamação com tempo de resposta
          preenchido no período.
        </p>

      ) : (

        <>
          <ul className="space-y-2.5">

            {linhas.map((item) => (

              <li
                key={item.category}
                className="flex flex-wrap items-center gap-3"
              >

                <span className="w-40 shrink-0 truncate text-sm font-medium text-zinc-700">
                  {item.category}
                </span>

                <span className="h-2 min-w-24 flex-1 overflow-hidden rounded-full bg-zinc-100">
                  <span
                    className={`block h-full rounded-full transition-[width] duration-500 ${item.situation === "estourado" ? "bg-rose-500" : item.situation === "atencao" ? "bg-amber-500" : item.situation === "dentro" ? "bg-emerald-500" : "bg-zinc-300"}`}
                    style={{
                      width: `${Math.min(item.usage ?? 100, 100)}%`,
                    }}
                  />
                </span>

                <span
                  className="w-32 shrink-0 text-right text-sm font-semibold tabular-nums text-zinc-900"
                  title={`Pior tempo de resposta da categoria. Base: ${item.samples} reclamação(ões) com tempo preenchido.`}
                >
                  {formatElapsed(item.worstMinutes)}
                </span>

                <span
                  className="w-28 shrink-0 text-right text-xs tabular-nums text-zinc-400"
                  title="Média da categoria — contexto, não é o que o teto cobra."
                >
                  méd. {formatElapsed(item.averageMinutes)}
                </span>

                <span className="w-28 shrink-0 text-right text-xs tabular-nums text-zinc-400">
                  {item.ceilingHours
                    ? `teto ${formatHours(item.ceilingHours)}`
                    : "sem teto"}
                </span>

                <span
                  className={`w-20 shrink-0 rounded-full px-2 py-0.5 text-center text-[11px] font-semibold tabular-nums ring-1 ring-inset ${toneOfSla(item.situation)}`}
                >
                  {item.usage === undefined
                    ? "—"
                    : `${Math.round(item.usage)}%`}
                </span>

              </li>

            ))}

          </ul>

          <p className="mt-5 flex items-center gap-2 border-t border-zinc-100 pt-4 text-xs text-zinc-500">

            <Timer size={13} className="text-zinc-400" />

            {/*
              Categorias **e** reclamações.

              "2 categorias acima do teto" não diz se foram dois casos
              ou duzentos — e a diferença decide se o problema é um
              atendimento esquecido ou um processo quebrado.
            */}
            {/*
              Sem teto cadastrado, o zero é mudo.

              "Nenhuma reclamação passou do teto" e "nenhum teto foi
              definido" dão o mesmo zero e significam o contrário: no
              primeiro caso a operação está em dia, no segundo ninguém
              está medindo. Hoje **nenhuma** categoria tem teto, então
              esta é a mensagem que aparece.
            */}
            {semTeto === linhas.length
              ? `Nenhuma categoria tem teto cadastrado — sem prazo definido, nada pode ser apontado como estouro. O pior tempo acima já é real: defina os tetos em Configurar fluxo.`
              : estouradas === 0
                ? "Nenhuma reclamação passou do teto da sua categoria no período."
                : `${reclamacoesEstouradas} reclamação(ões) passaram do teto, em ${estouradas} categoria(s).`}

          </p>
        </>

      )}

    </SurfaceCard>
  );
}
