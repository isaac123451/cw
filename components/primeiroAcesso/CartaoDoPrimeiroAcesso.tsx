"use client";

import Link from "next/link";

import { ArrowRight, Sparkles, X } from "lucide-react";

import { usePrimeiroAcesso } from "@/components/primeiroAcesso/usePrimeiroAcesso";

import { progressoDoGuia } from "@/lib/models/primeiroAcesso";

/**
 * O roteiro do primeiro acesso no alto do Meu dia, enquanto não termina.
 *
 * Uma linha: quantos passos faltam, o próximo e o botão para continuar.
 * Quem já conhece a plataforma esconde (gravado); o roteiro inteiro
 * continua em Conhecimento → Primeiro acesso.
 */
export default function CartaoDoPrimeiroAcesso() {
  const { estado, gravando, dispensar } = usePrimeiroAcesso();
  if (!estado || estado.dispensadoEm) return null;

  const { feitos, total, proximo, concluido } = progressoDoGuia(estado);
  if (concluido || !proximo) return null;

  return (
    <section aria-label="Primeiro acesso" className="flex flex-wrap items-center gap-4 rounded-2xl bg-violet-50/60 px-4 py-3 ring-1 ring-inset ring-violet-100">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-violet-700 ring-1 ring-inset ring-violet-100">
        <Sparkles size={17} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-violet-950">
          Primeiro acesso · {feitos} de {total}
        </p>
        <p className="truncate text-xs text-zinc-600">Próximo: {proximo.titulo}</p>
      </div>
      <span className="hidden h-1.5 w-28 overflow-hidden rounded-full bg-white ring-1 ring-inset ring-violet-100 sm:block" aria-hidden>
        <span className="block h-full rounded-full bg-violet-600" style={{ width: `${Math.round((feitos / total) * 100)}%` }} />
      </span>
      <Link href="/primeiro-acesso" className="inline-flex items-center gap-1.5 rounded-xl bg-violet-700 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-violet-800">
        Continuar o roteiro <ArrowRight size={13} />
      </Link>
      <button
        type="button"
        onClick={() => dispensar(true)}
        disabled={gravando === "dispensar"}
        title="Já conheço — esconder do Meu dia"
        aria-label="Esconder o roteiro do Meu dia"
        className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-white hover:text-zinc-700 disabled:opacity-50"
      >
        <X size={15} />
      </button>
    </section>
  );
}
