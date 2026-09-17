"use client";

import { useRef, useState, type PointerEvent as PointerEventReact } from "react";

import Link from "next/link";

import { Columns3, ExternalLink, GripHorizontal, Layers, Maximize2, Minimize2, Minus, PanelBottomClose, X } from "lucide-react";

import { JanelaAtual, useJanelasComRascunho } from "@/lib/context/rascunhosDasJanelas";

import IconeDaFrente from "@/components/shared/IconeDaFrente";

import { useJanelas } from "@/lib/context/JanelasContext";
import {
  LARGURA_DA_FICHA_COMPLETA,
  LARGURA_DA_JANELA,
  ROTULO_DA_FRENTE,
  type Janela,
} from "@/lib/models/janelas";

import JanelaDoCaso from "@/components/janelas/JanelaDoCaso";
import JanelaDoNps from "@/components/janelas/JanelaDoNps";
import JanelaDoGoogle from "@/components/janelas/JanelaDoGoogle";
import FichaCompletaNaJanela from "@/components/janelas/FichaCompletaNaJanela";

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

  const { fechar, focar, minimizar, mover, alternarCompleta } = useJanelas();
  const comRascunho = useJanelasComRascunho();
  const temRascunho = comRascunho.has(janela.id);

  /*
    Fechar com algo digitado e não salvo pede um segundo clique. Um
    diálogo por cima da janela seria pesado para uma janela pequena; o
    próprio botão vira "Descartar?" por alguns segundos.
  */
  const [confirmarFechar, setConfirmarFechar] = useState(false);
  function pedirFechar() {
    if (!temRascunho || confirmarFechar) return fechar(janela.id);
    setConfirmarFechar(true);
    setTimeout(() => setConfirmarFechar(false), 4000);
  }

  /* Google já mostra tudo na própria janela; as outras frentes têm as duas formas. */
  const temCompleta = janela.frente !== "google";
  const completa = temCompleta && Boolean(janela.completa);

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
      style={{
        left: janela.x,
        top: janela.y,
        zIndex: 70 + janela.z,
        width: `min(${completa ? LARGURA_DA_FICHA_COMPLETA : LARGURA_DA_JANELA}px, calc(100vw - 16px))`,
        height: completa ? "min(820px, calc(100vh - 72px))" : undefined,
      }}
      className={`fixed ${janela.minimizada ? "hidden" : "flex"} ${completa ? "min-h-[320px] min-w-[360px] max-w-[calc(100vw-16px)] resize" : "max-h-[min(640px,calc(100vh-24px))]"} max-h-[calc(100vh-24px)] flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-[0_24px_60px_-20px_rgba(16,24,40,0.35)] dark:border-zinc-700`}
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
        {temRascunho && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" title="Há alterações não salvas" aria-label="Há alterações não salvas" />}

        {temCompleta && (
          <button
            type="button"
            onClick={() => alternarCompleta(janela.id)}
            title={completa ? "Voltar ao essencial" : "Ficha completa nesta janela"}
            aria-label={completa ? "Voltar ao essencial" : "Abrir a ficha completa nesta janela"}
            aria-pressed={completa}
            className="rounded-md p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-violet-700"
          >
            {completa ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        )}
        <Link
          href={linkDaFicha(janela)}
          title="Abrir a ficha em tela cheia"
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
        {confirmarFechar ? (
          <button
            type="button"
            onClick={pedirFechar}
            title="Fechar e descartar o que não foi salvo"
            className="rounded-md bg-rose-50 px-1.5 py-0.5 text-[11px] font-medium text-rose-700 hover:bg-rose-100"
          >
            Descartar?
          </button>
        ) : (
          <button
            type="button"
            onClick={pedirFechar}
            title="Fechar a janela"
            aria-label="Fechar a janela"
            className="rounded-md p-1 text-zinc-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
          >
            <X size={14} />
          </button>
        )}
      </header>

      <div className="rolagem-fina min-h-0 flex-1 overflow-y-auto">
        <JanelaAtual.Provider value={janela.id}>
        {completa ? (
          <FichaCompletaNaJanela frente={janela.frente} id={janela.ref} />
        ) : janela.frente === "nps" ? (
          <JanelaDoNps id={janela.ref} />
        ) : janela.frente === "google" ? (
          <JanelaDoGoogle id={janela.ref} />
        ) : (
          <JanelaDoCaso id={janela.ref} frente={janela.frente} />
        )}
        </JanelaAtual.Provider>
      </div>
    </div>
  );
}

export default function JanelasHost() {

  const { janelas, minimizar, fechar, organizar, minimizarTodas } = useJanelas();
  const comRascunho = useJanelasComRascunho();

  if (janelas.length === 0) return null;

  const minimizadas = janelas.filter((j) => j.minimizada);
  const visiveis = janelas.length - minimizadas.length;

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

      {(minimizadas.length > 0 || visiveis >= 2) && (
        <div
          className="fixed bottom-3 right-3 z-[69] flex max-w-[calc(100vw-24px)] flex-wrap items-center justify-end gap-1.5"
          aria-label="Janelas minimizadas"
        >
          {/* Com duas ou mais abertas, arrumar de uma vez. */}
          {visiveis >= 2 && (
            <span className="flex items-center gap-0.5 rounded-lg border border-zinc-200 bg-white p-0.5 shadow-lg shadow-zinc-900/10">
              <button type="button" onClick={() => organizar("lado-a-lado")} title="Lado a lado" aria-label="Organizar lado a lado" className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-violet-700">
                <Columns3 size={14} />
              </button>
              <button type="button" onClick={() => organizar("cascata")} title="Em cascata" aria-label="Organizar em cascata" className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-violet-700">
                <Layers size={14} />
              </button>
              <button type="button" onClick={minimizarTodas} title="Minimizar todas" aria-label="Minimizar todas as janelas" className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800">
                <PanelBottomClose size={14} />
              </button>
            </span>
          )}
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
                {comRascunho.has(j.id) && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" title="Rascunho não salvo" aria-label="Rascunho não salvo" />}
              </button>
              <button
                type="button"
                /* Com rascunho, fechar pela bandeja reabre a janela: descartar se confirma lá, à vista. */
                onClick={() => (comRascunho.has(j.id) ? minimizar(j.id, false) : fechar(j.id))}
                title={comRascunho.has(j.id) ? "Tem rascunho: abrir para decidir" : "Fechar"}
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
