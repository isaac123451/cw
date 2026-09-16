"use client";

import { useRef, type PointerEvent as PointerEventReact } from "react";

import Link from "next/link";

import { ExternalLink, GripHorizontal, Minus, X } from "lucide-react";

import IconeDaFrente from "@/components/shared/IconeDaFrente";

import { useJanelas } from "@/lib/context/JanelasContext";
import {
  LARGURA_DA_JANELA,
  ROTULO_DA_FRENTE,
  type Janela,
} from "@/lib/models/janelas";

import JanelaDoCaso from "@/components/janelas/JanelaDoCaso";
import JanelaDoNps from "@/components/janelas/JanelaDoNps";
import JanelaDoGoogle from "@/components/janelas/JanelaDoGoogle";

/**
 * As janelas abertas e a bandeja das minimizadas.
 *
 * **Sem fundo escurecido e sem desfoque**, de propósito: a janela é para
 * trabalhar *junto* com a página de trás — ler a reclamação enquanto se
 * preenche o NPS do mesmo cliente —, e qualquer véu por cima do fundo
 * desfaz isso. Foi o que o Isaac pediu para os painéis flutuantes.
 */

function linkDaFicha(j: Janela) {
  if (j.frente === "nps") return `/nps/${j.ref}`;
  if (j.frente === "google") return `/google?avaliacao=${j.ref}`;
  if (j.frente === "redes") return `/redes-sociais/${j.ref}`;
  return `/reclame-aqui/${j.ref}`;
}

function Moldura({ janela }: { janela: Janela }) {

  const { fechar, focar, minimizar, mover } = useJanelas();

  const el = useRef<HTMLDivElement>(null);
  const arrasto = useRef<{ x0: number; y0: number; x: number; y: number } | null>(null);

  /*
    Arrastar move o elemento direto, sem estado por pixel; a posição só
    vai para o contexto (e para a sessão) ao soltar. Redesenhar a ficha
    inteira a cada movimento do mouse deixaria o arrasto engasgado
    justamente com várias janelas abertas.
  */
  function comecar(e: PointerEventReact<HTMLElement>) {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button, a, input, select, textarea")) return;
    arrasto.current = { x0: e.clientX, y0: e.clientY, x: janela.x, y: janela.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function arrastar(e: PointerEventReact<HTMLElement>) {
    const a = arrasto.current;
    if (!a || !el.current) return;
    el.current.style.left = `${a.x + e.clientX - a.x0}px`;
    el.current.style.top = `${a.y + e.clientY - a.y0}px`;
  }

  function soltar(e: PointerEventReact<HTMLElement>) {
    const a = arrasto.current;
    if (!a) return;
    arrasto.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
    mover(janela.id, a.x + e.clientX - a.x0, a.y + e.clientY - a.y0);
  }

  return (
    <div
      ref={el}
      role="dialog"
      aria-label={`${ROTULO_DA_FRENTE[janela.frente]}: ${janela.titulo}`}
      onPointerDownCapture={() => focar(janela.id)}
      style={{ left: janela.x, top: janela.y, zIndex: 70 + janela.z, width: `min(${LARGURA_DA_JANELA}px, calc(100vw - 16px))` }}
      className={`fixed ${janela.minimizada ? "hidden" : "flex"} max-h-[min(640px,calc(100vh-24px))] flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl shadow-zinc-900/15 dark:border-zinc-700`}
    >
      <header
        onPointerDown={comecar}
        onPointerMove={arrastar}
        onPointerUp={soltar}
        onPointerCancel={soltar}
        title="Arraste para mover"
        className="flex cursor-move touch-none select-none items-center gap-2 border-b border-zinc-100 bg-zinc-50/80 px-3 py-2 dark:border-zinc-800"
      >
        <GripHorizontal size={13} className="shrink-0 text-zinc-300" aria-hidden />
        <IconeDaFrente frente={janela.frente} size={14} />
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-zinc-800">{janela.titulo}</span>

        <Link
          href={linkDaFicha(janela)}
          title="Abrir a ficha completa"
          className="rounded-md p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-violet-700"
        >
          <ExternalLink size={14} />
        </Link>
        <button
          type="button"
          onClick={() => minimizar(janela.id)}
          title="Minimizar para a bandeja"
          className="rounded-md p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
        >
          <Minus size={14} />
        </button>
        <button
          type="button"
          onClick={() => fechar(janela.id)}
          title="Fechar a janela"
          className="rounded-md p-1 text-zinc-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
        >
          <X size={14} />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {janela.frente === "nps" ? (
          <JanelaDoNps id={janela.ref} />
        ) : janela.frente === "google" ? (
          <JanelaDoGoogle id={janela.ref} />
        ) : (
          <JanelaDoCaso id={janela.ref} frente={janela.frente} />
        )}
      </div>
    </div>
  );
}

export default function JanelasHost() {

  const { janelas, minimizar, fechar } = useJanelas();

  if (janelas.length === 0) return null;

  const minimizadas = janelas.filter((j) => j.minimizada);

  return (
    <>
      {janelas.map((j) => (
        /*
          A minimizada **continua montada**, só escondida: o rascunho
          digitado nela sobrevive a ir para a bandeja e voltar. Tirá-la
          da árvore jogaria fora o que a pessoa escreveu sem salvar.
        */
        <Moldura key={j.id} janela={j} />
      ))}

      {minimizadas.length > 0 && (
        <div
          className="fixed bottom-3 right-3 z-[69] flex max-w-[calc(100vw-24px)] flex-wrap justify-end gap-1.5"
          aria-label="Janelas minimizadas"
        >
          {minimizadas.map((j) => (
            <span
              key={j.id}
              className="flex max-w-56 items-center gap-1.5 rounded-xl border border-zinc-200 bg-white py-1 pl-2 pr-1 text-xs shadow-lg shadow-zinc-900/10"
            >
              <button
                type="button"
                onClick={() => minimizar(j.id, false)}
                title={`Restaurar: ${j.titulo}`}
                className="flex min-w-0 items-center gap-1.5 text-zinc-700 hover:text-violet-700"
              >
                <IconeDaFrente frente={j.frente} size={12} />
                <span className="truncate">{j.titulo}</span>
              </button>
              <button
                type="button"
                onClick={() => fechar(j.id)}
                title="Fechar"
                className="rounded-md p-0.5 text-zinc-400 hover:bg-rose-50 hover:text-rose-600"
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
    </>
  );
}
