"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { GripHorizontal, X } from "lucide-react";

import type { Case } from "@/lib/models/case";
import { caseHref } from "@/lib/services/case.service";

/**
 * A mini janela do gráfico (21/10/2026).
 *
 * "Quando eu clicar em uma coluna de um gráfico, dependendo se tiver alguma
 * informação para apresentar, é preciso abrir uma mini janela com os casos
 * ou informações." Uma janela só, montada no layout; qualquer gráfico abre
 * com `abrirJanelaDeCasos` — sem precisar de estado próprio nem de modal.
 *
 * Painel flutuante pela regra da casa: arrastável pelo topo, sem fundo
 * escurecido nem desfoque, fecha no X ou com Esc.
 */

export interface LinhaDaJanela {
  titulo: string;
  detalhe?: string;
  href?: string;
}

export interface ConteudoDaJanela {
  titulo: string;
  /** Uma linha curta embaixo do título: o que a coluna conta. */
  descricao?: string;
  casos?: Case[];
  /** Informação que não é caso (ex.: avaliações do Google, respostas do NPS). */
  linhas?: LinhaDaJanela[];
}

const EVENTO = "cw:janela-de-casos";

/** Abre a mini janela. Sem casos nem linhas, não abre — a coluna vazia não tem o que mostrar. */
export function abrirJanelaDeCasos(conteudo: ConteudoDaJanela) {
  if (!conteudo.casos?.length && !conteudo.linhas?.length) return;
  window.dispatchEvent(new CustomEvent<ConteudoDaJanela>(EVENTO, { detail: conteudo }));
}

const LIMITE = 200;
const dia = (iso?: string) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(2, 4)}` : "");

export default function JanelaDeCasos() {
  const [conteudo, setConteudo] = useState<ConteudoDaJanela | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const arraste = useRef<{ dx: number; dy: number } | null>(null);

  useEffect(() => {
    const abrir = (e: Event) => {
      setConteudo((e as CustomEvent<ConteudoDaJanela>).detail);
      /* Abre sempre no mesmo canto, à direita, longe do menu. */
      setPos((p) => p ?? { x: Math.max(16, window.innerWidth - 440), y: 88 });
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setConteudo(null);
    window.addEventListener(EVENTO, abrir);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener(EVENTO, abrir);
      window.removeEventListener("keydown", esc);
    };
  }, []);

  if (!conteudo || !pos) return null;

  const casos = conteudo.casos ?? [];
  const linhas = conteudo.linhas ?? [];
  const total = casos.length + linhas.length;

  const comecar = (e: React.PointerEvent) => {
    arraste.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const mover = (e: React.PointerEvent) => {
    if (!arraste.current) return;
    setPos({
      x: Math.min(window.innerWidth - 120, Math.max(0, e.clientX - arraste.current.dx)),
      y: Math.min(window.innerHeight - 60, Math.max(0, e.clientY - arraste.current.dy)),
    });
  };

  return (
    <div
      role="dialog"
      aria-label={conteudo.titulo}
      className="fixed z-[70] flex max-h-[70vh] w-[min(420px,calc(100vw-32px))] flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-[0_12px_32px_rgba(16,24,40,0.16)]"
      style={{ left: pos.x, top: pos.y }}
    >
      <div
        onPointerDown={comecar}
        onPointerMove={mover}
        onPointerUp={() => (arraste.current = null)}
        className="flex cursor-grab items-start gap-2 border-b border-zinc-100 px-3.5 py-2.5 active:cursor-grabbing"
      >
        <GripHorizontal size={14} className="mt-1 shrink-0 text-zinc-300" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-zinc-900">
            {conteudo.titulo} <span className="font-normal text-zinc-500">· {total}</span>
          </p>
          {conteudo.descricao && <p className="mt-0.5 text-xs text-zinc-500">{conteudo.descricao}</p>}
        </div>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setConteudo(null)}
          className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
          aria-label="Fechar"
        >
          <X size={15} />
        </button>
      </div>

      <ul className="divide-y divide-zinc-100 overflow-y-auto">
        {casos.slice(0, LIMITE).map((c) => (
          <li key={c.id}>
            <Link href={caseHref(c)} className="block px-3.5 py-2 hover:bg-zinc-50">
              <p className="flex items-baseline justify-between gap-2">
                <span className="truncate text-sm font-medium text-zinc-800">{c.customer || "Sem nome"}</span>
                <span className="shrink-0 text-[11px] tabular-nums text-zinc-400">{dia(c.createdAt)}</span>
              </p>
              <p className="truncate text-xs text-zinc-500">{c.title}</p>
              <p className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] text-zinc-400">
                <span className="font-mono text-violet-700">{c.protocol}</span>
                <span>{c.status}</span>
                {c.evaluated && (
                  <span className="text-zinc-600">
                    nota {c.score ?? "—"}
                    {c.resolved ? " · resolvida" : " · não resolvida"}
                    {c.evaluatedAt ? ` · avaliada ${dia(c.evaluatedAt)}` : ""}
                  </span>
                )}
              </p>
            </Link>
          </li>
        ))}
        {linhas.slice(0, LIMITE).map((l, i) => {
          const corpo = (
            <>
              <p className="truncate text-sm text-zinc-800">{l.titulo}</p>
              {l.detalhe && <p className="truncate text-xs text-zinc-500">{l.detalhe}</p>}
            </>
          );
          return (
            <li key={`l${i}`}>
              {l.href ? (
                <Link href={l.href} className="block px-3.5 py-2 hover:bg-zinc-50">
                  {corpo}
                </Link>
              ) : (
                <div className="px-3.5 py-2">{corpo}</div>
              )}
            </li>
          );
        })}
      </ul>
      {total > LIMITE && <p className="border-t border-zinc-100 px-3.5 py-2 text-xs text-zinc-500">Mostrando {LIMITE} de {total}.</p>}
    </div>
  );
}
