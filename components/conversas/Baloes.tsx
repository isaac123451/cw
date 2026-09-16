"use client";

import { Fragment } from "react";

import type { Lado } from "@/lib/models/conversa";
import { paredeDe } from "@/lib/services/horasUteis";

export interface BalaoDaConversa {
  id: string;
  de: Lado;
  autor?: string | null;
  texto: string;
  em?: string | null;
}

function diaDe(iso?: string | null) {
  if (!iso) return "";
  return paredeDe(new Date(iso)).dia;
}

function horaDe(iso?: string | null) {
  if (!iso) return "";
  const { min } = paredeDe(new Date(iso));
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

function diaPorExtenso(dia: string) {
  const [a, m, d] = dia.split("-");
  return `${d}/${m}/${a}`;
}

/**
 * A conversa em balões, como no WhatsApp: o cliente à esquerda, nós à
 * direita, os avisos do sistema no meio e uma divisória a cada dia. A
 * hora é a de Brasília.
 */
export default function Baloes({
  mensagens,
  destaque = "",
  foco,
  acoes,
}: {
  mensagens: BalaoDaConversa[];
  destaque?: string;
  /** A ocorrência da busca em que se está: ganha o anel forte e é para ela que a tela rola. */
  foco?: string | null;
  /** Um botão pequeno ao lado de cada balão (ex.: "é a validação"). */
  acoes?: (m: BalaoDaConversa) => React.ReactNode;
}) {
  const termo = destaque.trim().toLowerCase();
  return (
    <ol className="space-y-1.5">
      {mensagens.map((m, i) => {
        const dia = diaDe(m.em);
        const novoDia = dia && dia !== diaDe(mensagens[i - 1]?.em);
        const achou = termo.length >= 2 && m.texto.toLowerCase().includes(termo);
        return (
          <Fragment key={m.id}>
            {novoDia && (
              <li className="flex justify-center py-2" aria-hidden>
                <span className="rounded-full bg-zinc-100 px-3 py-0.5 text-[11px] font-medium text-zinc-500">{diaPorExtenso(dia)}</span>
              </li>
            )}
            {m.de === "sistema" ? (
              <li className="flex justify-center">
                <p className="max-w-md rounded-xl bg-amber-50 px-3 py-1.5 text-center text-[11px] leading-4 text-amber-800">{m.texto}</p>
              </li>
            ) : (
              <li data-msg={m.id} className={`group flex items-end gap-2 ${m.de === "nos" ? "flex-row-reverse" : ""}`}>
                <div
                  className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-sm leading-6 shadow-[0_1px_1px_rgba(16,24,40,0.05)] ${
                    m.de === "nos" ? "rounded-br-md bg-violet-100 text-violet-950" : "rounded-bl-md bg-white text-zinc-800 ring-1 ring-inset ring-zinc-200"
                  } ${m.id === foco ? "ring-2 ring-amber-500" : achou ? "ring-2 ring-amber-200" : ""}`}
                >
                  {m.autor && m.de === "cliente" && <p className="text-[11px] font-semibold text-violet-700">{m.autor}</p>}
                  <p className="whitespace-pre-wrap break-words">{m.texto}</p>
                  <p className={`mt-0.5 text-right text-[10px] ${m.de === "nos" ? "text-violet-700/70" : "text-zinc-400"}`}>{horaDe(m.em)}</p>
                </div>
                {acoes && <div className="opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">{acoes(m)}</div>}
              </li>
            )}
          </Fragment>
        );
      })}
    </ol>
  );
}
