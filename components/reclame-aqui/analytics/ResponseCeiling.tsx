"use client";

import Link from "next/link";

import { Settings2, Timer } from "lucide-react";

import { Case } from "@/lib/models/case";

import { useSettings } from "@/lib/context/SettingsContext";

import {
  averageResponseByCategory,
  overCeiling,
} from "@/lib/services/ceiling.service";

import { toneOfSla } from "@/lib/services/sla.service";
import { formatElapsed } from "@/lib/services/reputation.service";
import { formatHours } from "@/lib/models/sla";

import SurfaceCard from "@/components/shared/SurfaceCard";

/**
 * Tempo médio de resposta por categoria contra o teto declarado.
 *
 * Sem teto, "19 dias e 17 horas" é só um número na tela. Com teto, cada
 * categoria passa a ter um alvo e a barra mostra quanto dele já foi
 * consumido.
 */
export default function ResponseCeiling({
  cases,
}: {
  cases: Case[];
}) {

  const { categories } = useSettings();

  const linhas = averageResponseByCategory(
    cases,
    categories
  );

  const estouradas = overCeiling(linhas);

  return (
    <SurfaceCard
      title="Tempo médio por categoria"
      description="Média de resposta do período contra o teto definido em Configurar fluxo."
      hint="A média considera apenas reclamações com tempo de resposta preenchido — categoria sem base não aparece. Categoria sem teto cadastrado não é cobrada."
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
                  title={`Base: ${item.samples} reclamação(ões) com tempo preenchido`}
                >
                  {formatElapsed(item.averageMinutes)}
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

            {estouradas === 0
              ? "Nenhuma categoria acima do teto no período."
              : `${estouradas} categoria(s) acima do teto no período.`}

          </p>
        </>

      )}

    </SurfaceCard>
  );
}
