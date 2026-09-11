"use client";

import { useState } from "react";

import { UserRoundPen } from "lucide-react";

import {
  descreverFaltas,
  faltaNoCadastro,
  type FaltaNoCadastro,
} from "@/lib/models/case";

import { useScopedCases } from "@/lib/context/useScopedCases";
import { isOpen } from "@/lib/services/case.service";

import { useCompletar } from "./CompletarProvider";

/** Quantas aparecem antes do "e mais". */
const VISIVEIS = 4;

/**
 * O aviso no alto do quadro: reclamações que entraram sem o consumidor.
 *
 * O sino avisa em qualquer tela; aqui o aviso fica onde o trabalho está,
 * com o atalho para cada uma. Conta todas as do módulo em aberto, e não
 * só as do filtro: um filtro por responsável não pode esconder que
 * existe reclamação que ninguém consegue nem identificar.
 */
export default function AvisoIncompletas() {

  const { cases } = useScopedCases("reclame-aqui");
  const { abrir } = useCompletar();

  const [todas, setTodas] = useState(false);

  const incompletas = cases
    .filter((item) => isOpen(item) && faltaNoCadastro(item).length > 0)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  if (incompletas.length === 0) return null;

  const faltas = [
    ...new Set(incompletas.flatMap((item) => faltaNoCadastro(item))),
  ] as FaltaNoCadastro[];

  const mostradas = todas ? incompletas : incompletas.slice(0, VISIVEIS);

  return (
    <div
      role="status"
      className="rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-3"
    >

      <p className="flex items-start gap-2 text-sm text-amber-900">

        <UserRoundPen size={16} className="mt-0.5 shrink-0 text-amber-700" />

        <span>
          <strong className="font-semibold">
            {incompletas.length === 1
              ? "1 reclamação com dados do consumidor incompletos"
              : `${incompletas.length} reclamações com dados do consumidor incompletos`}
          </strong>{" "}
          — falta {descreverFaltas(faltas)}. Eles só aparecem na área da
          empresa do Reclame Aqui; complete por lá ou à mão.
        </span>

      </p>

      <div className="mt-2.5 flex flex-wrap gap-1.5 pl-6">

        {mostradas.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => abrir(item.id)}
            title={item.title}
            className="flex max-w-[280px] items-center gap-1.5 rounded-lg border border-amber-200 bg-white px-2.5 py-1 text-xs text-zinc-700 transition-colors hover:border-amber-300 hover:bg-amber-50"
          >
            <span className="font-mono text-[10px] text-amber-700">
              {item.protocol}
            </span>
            <span className="truncate">{item.title}</span>
          </button>
        ))}

        {incompletas.length > VISIVEIS && (
          <button
            type="button"
            onClick={() => setTodas(!todas)}
            className="rounded-lg px-2.5 py-1 text-xs font-medium text-amber-800 underline underline-offset-2 hover:text-amber-900"
          >
            {todas ? "mostrar menos" : `e mais ${incompletas.length - VISIVEIS}`}
          </button>
        )}

      </div>

    </div>
  );
}
