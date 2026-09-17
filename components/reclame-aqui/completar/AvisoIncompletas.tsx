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


  /*
    Uma linha, e a lista só quando pedida. Era um bloco amarelo de três
    linhas acima do quadro, empurrando as colunas para baixo em toda
    abertura — e o que ele pede cabe num botão: completar a próxima.
  */
  return (
    <div role="status" className="rounded-lg border border-amber-200/80 bg-amber-50/60 px-3 py-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-amber-900">
        <UserRoundPen size={15} className="shrink-0 text-amber-600" />
        <span className="min-w-0">
          <strong className="font-medium">
            {incompletas.length === 1 ? "1 reclamação" : `${incompletas.length} reclamações`} sem os dados do consumidor
          </strong>
          <span className="text-amber-800/80"> · falta {descreverFaltas(faltas)}</span>
        </span>
        <span className="ml-auto flex items-center gap-3">
          <button type="button" onClick={() => abrir(incompletas[0].id)} className="font-medium text-amber-900 underline-offset-2 hover:underline">
            Completar a mais recente
          </button>
          <button type="button" onClick={() => setTodas(!todas)} aria-expanded={todas} className="text-amber-800/80 underline-offset-2 hover:underline">
            {todas ? "esconder" : "ver todas"}
          </button>
        </span>
      </div>

      {todas && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {incompletas.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => abrir(item.id)}
              title={item.title}
              className="flex max-w-[300px] items-center gap-1.5 rounded-md border border-amber-200 bg-white px-2 py-1 text-xs text-zinc-700 transition-colors hover:border-amber-300"
            >
              <span className="shrink-0 whitespace-nowrap font-mono text-[10px] text-amber-700">{item.protocol}</span>
              <span className="truncate">{item.title}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
