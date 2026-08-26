"use client";

import Link from "next/link";

import { BadgeAlert } from "lucide-react";

import { Case } from "@/lib/models/case";

import { caseHref } from "@/lib/services/case.service";

/**
 * Aviso de avaliações desconsideradas no período.
 *
 * Elas ficam fora do cálculo da nota, como o Reclame Aqui faz. O aviso
 * existe para a diferença não ser silenciosa: quem olha o número de
 * avaliações da tela precisa saber por que a base da nota é menor.
 */
export default function DisregardedNotice({
  cases,
}: {
  cases: Case[];
}) {

  const marcadas = cases.filter(
    (item) => item.evaluated && item.scoreDisregarded
  );

  if (marcadas.length === 0) return null;

  return (
    <div className="flex flex-wrap items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 px-5 py-4">

      <BadgeAlert
        size={17}
        className="mt-0.5 shrink-0 text-amber-600"
      />

      <div className="min-w-0 flex-1">

        <p className="text-sm font-medium text-amber-900">
          {marcadas.length === 1
            ? "1 avaliação marcada como desconsiderada neste período"
            : `${marcadas.length} avaliações marcadas como desconsideradas neste período`}
        </p>

        <p className="mt-1 text-xs leading-relaxed text-amber-800">
          Ficam fora do cálculo da nota, como o Reclame Aqui
          faz. Os casos seguem visíveis na lista, com a nota
          registrada.
        </p>

        <div className="mt-2.5 flex flex-wrap gap-1.5">

          {marcadas.slice(0, 6).map((item) => (

            <Link
              key={item.id}
              href={caseHref(item)}
              title={item.title}
              className="rounded-lg bg-white px-2 py-1 font-mono text-[11px] text-amber-800 ring-1 ring-inset ring-amber-200 transition-colors hover:bg-amber-100"
            >
              {item.protocol} · nota {item.score}
            </Link>

          ))}

          {marcadas.length > 6 && (
            <span className="px-1 py-1 text-[11px] text-amber-700">
              e mais {marcadas.length - 6}
            </span>
          )}

        </div>

      </div>

    </div>
  );
}
