"use client";

import type { MouseEvent } from "react";

import { AppWindow } from "lucide-react";

import { useJanelas } from "@/lib/context/JanelasContext";
import type { FrenteDaJanela } from "@/lib/models/janelas";

/**
 * "Abrir em janela": o atalho que mora em cada item de lista.
 *
 * Para o clique **não vazar** para o item — o cartão do quadro e a linha
 * da lista abrem a ficha ao clicar, e abrir a janela não pode, ao mesmo
 * tempo, navegar para longe dela.
 */
export default function BotaoAbrirEmJanela({
  frente,
  referencia,
  titulo,
  className = "",
  rotulo = false,
}: {
  frente: FrenteDaJanela;
  /** O id do caso, da resposta do NPS ou da avaliação. (Não "ref": é nome reservado do React.) */
  referencia: string;
  titulo: string;
  className?: string;
  /** Mostra "Janela" ao lado do ícone, para barras com espaço. */
  rotulo?: boolean;
}) {

  const { abrir } = useJanelas();

  function clicar(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    abrir({ frente, ref: referencia, titulo });
  }

  return (
    <button
      type="button"
      onClick={clicar}
      onPointerDown={(e) => e.stopPropagation()}
      title="Abrir numa mini-janela — dá para abrir várias e continuar navegando"
      aria-label={`Abrir ${titulo} numa mini-janela`}
      className={`inline-flex shrink-0 items-center gap-1 rounded-md p-1 text-zinc-400 transition-colors hover:bg-violet-50 hover:text-violet-700 ${className}`}
    >
      <AppWindow size={14} />
      {rotulo && <span className="text-xs font-medium">Janela</span>}
    </button>
  );
}
