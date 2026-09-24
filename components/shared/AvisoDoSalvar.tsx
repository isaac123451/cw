"use client";

import { Check, Loader2, RotateCcw, TriangleAlert } from "lucide-react";

import type { SalvarAoSair } from "@/lib/hooks/useSalvarAoSair";

/**
 * O que a ficha que grava sozinha tem a dizer — e só quando tem.
 *
 * Mesma ilha da `BarraDeSalvar` (base da janela, escura, acompanha a
 * rolagem), menor, porque não pede nada: diz o que está acontecendo.
 * "Grava ao sair do campo" aparece enquanto se digita, para ninguém
 * procurar o botão que saiu; "salvo · desfazer" depois de o servidor
 * confirmar; e o erro, que fica até alguém tentar de novo.
 */
export default function AvisoDoSalvar<T>({ salvar }: { salvar: SalvarAoSair<T> }) {

  const { estado, pendente } = salvar;
  if (estado.tipo === "parado" && !pendente) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
      <p
        role="status"
        aria-live="polite"
        className={`pointer-events-auto flex max-w-[calc(100vw-2rem)] flex-wrap items-center gap-x-3 gap-y-1 rounded-xl px-3.5 py-2 text-xs shadow-[0_16px_40px_-12px_rgba(16,24,40,0.45)] ring-1 ${
          estado.tipo === "erro" ? "bg-rose-950 text-rose-100 ring-rose-400/30" : "bg-zinc-900 text-white/75 ring-white/10"
        }`}
      >
        {estado.tipo === "salvando" && (
          <span className="flex items-center gap-1.5">
            <Loader2 size={13} className="animate-spin motion-reduce:animate-none" /> salvando…
          </span>
        )}

        {estado.tipo === "salvo" && (
          <>
            <span className="flex items-center gap-1.5 text-emerald-300">
              <Check size={13} strokeWidth={2.5} /> salvo
            </span>
            <button
              type="button"
              onClick={salvar.desfazer}
              className="flex items-center gap-1 rounded px-1 font-medium text-white/80 hover:bg-white/10 hover:text-white"
            >
              <RotateCcw size={12} /> desfazer
            </button>
          </>
        )}

        {estado.tipo === "erro" && (
          <>
            <span className="flex items-center gap-1.5">
              <TriangleAlert size={13} /> {estado.erro}
            </span>
            <button
              type="button"
              onClick={estado.tipo === "erro" ? estado.tentar : undefined}
              className="rounded px-1 font-semibold text-white hover:bg-white/10"
            >
              tentar de novo
            </button>
          </>
        )}

        {estado.tipo === "parado" && pendente && (
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> grava ao sair do campo
          </span>
        )}
      </p>
    </div>
  );
}
