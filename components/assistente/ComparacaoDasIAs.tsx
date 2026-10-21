"use client";

import { useState } from "react";
import { ChevronRight, Scale } from "lucide-react";

import type { Comparacao } from "@/lib/services/comparacaoDeModelos.service";

const segundos = (ms: number) => `${(ms / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} s`;

/**
 * As respostas de cada IA, embaixo da síntese (09/10/2026; tela em
 * 21/10/2026). A resposta de cima é a síntese do juiz; aqui ficam qual IA
 * ele escolheu e por quê, e cada resposta para conferir — fechadas, para
 * não empurrar a conversa para baixo.
 */
export default function ComparacaoDasIAs({ comparacao }: { comparacao: Comparacao }) {
  const [aberta, setAberta] = useState<string | null>(null);
  const escolhida = comparacao.respostas.find((r) => r.provedor === comparacao.melhor.provedor);

  return (
    <div className="mt-3 border-t border-zinc-100 pt-3">
      <p className="flex items-start gap-2 text-xs text-zinc-600">
        <Scale size={14} className="mt-0.5 shrink-0 text-violet-600" />
        <span>
          {escolhida ? (
            <>
              <b className="font-semibold text-zinc-800">Melhor: {escolhida.nome}.</b> {comparacao.melhor.porque}
            </>
          ) : (
            comparacao.melhor.porque
          )}{" "}
          <span className="text-zinc-400">A resposta acima é a síntese.</span>
        </span>
      </p>
      <ul className="mt-2 space-y-1">
        {comparacao.respostas.map((r) => {
          const aqui = aberta === r.provedor;
          return (
            <li key={r.provedor} className="rounded-lg ring-1 ring-inset ring-zinc-200">
              <button
                type="button"
                onClick={() => setAberta(aqui ? null : r.provedor)}
                aria-expanded={aqui}
                disabled={!r.texto}
                className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs disabled:cursor-default"
              >
                <ChevronRight size={13} className={`shrink-0 text-zinc-400 transition-transform ${aqui ? "rotate-90" : ""} ${r.texto ? "" : "opacity-0"}`} />
                <span className="font-medium text-zinc-800">{r.nome}</span>
                {r.provedor === comparacao.melhor.provedor && <span className="rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700">escolhida</span>}
                <span className="truncate text-zinc-400">{r.modelo ?? ""}</span>
                <span className={`ml-auto shrink-0 tabular-nums ${r.texto ? "text-zinc-400" : "text-rose-700"}`}>{r.texto ? segundos(r.ms) : (r.erro ?? "não respondeu")}</span>
              </button>
              {aqui && r.texto && <p className="whitespace-pre-wrap border-t border-zinc-100 px-3 py-2 text-xs leading-relaxed text-zinc-700">{r.texto}</p>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
