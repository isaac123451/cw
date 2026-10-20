"use client";

import { useEffect, useRef, useState, type MouseEvent as EventoDoReact } from "react";

/** A caixa do painel. */
export const CLASSE_DO_PAINEL = "fixed z-50 rounded-xl border border-zinc-200 bg-white p-2 shadow-[0_12px_32px_-12px_rgba(16,24,40,0.25)]";

/**
 * Um painel pequeno preso a um botão, fixo na tela (20/10/2026).
 *
 * Fixo, e não absoluto, porque mora dentro de tabelas e listas com rolagem
 * — o absoluto era cortado. Abre abaixo do botão, alinhado à direita dele;
 * perto do fim da tela, acima. Fecha no clique fora, no Esc, ao rolar e ao
 * redimensionar.
 */
export function usePainelPreso(largura = 260, alturaEstimada = 300) {
  const [aberto, setAberto] = useState(false);
  const [posicao, setPosicao] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const botao = useRef<HTMLButtonElement>(null);
  const painel = useRef<HTMLDivElement>(null);

  function alternar(e: EventoDoReact<HTMLButtonElement>) {
    e.stopPropagation();
    const r = e.currentTarget.getBoundingClientRect();
    setPosicao({
      left: Math.max(8, Math.min(window.innerWidth - largura - 8, r.right - largura)),
      top: r.bottom + 6 + alturaEstimada > window.innerHeight ? Math.max(8, r.top - 6 - alturaEstimada) : r.bottom + 6,
    });
    setAberto((a) => !a);
  }

  useEffect(() => {
    if (!aberto) return;
    const fechar = () => setAberto(false);
    function fora(e: MouseEvent) {
      if (!painel.current?.contains(e.target as Node) && !botao.current?.contains(e.target as Node)) fechar();
    }
    function tecla(e: KeyboardEvent) {
      if (e.key === "Escape") fechar();
    }
    function rolou(e: Event) {
      if (!painel.current?.contains(e.target as Node)) fechar();
    }
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", tecla);
    window.addEventListener("scroll", rolou, true);
    window.addEventListener("resize", fechar);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", tecla);
      window.removeEventListener("scroll", rolou, true);
      window.removeEventListener("resize", fechar);
    };
  }, [aberto]);

  return {
    aberto,
    alternar,
    fechar: () => setAberto(false),
    botao,
    painel,
    /** A posição do painel na tela. */
    estilo: { top: posicao.top, left: posicao.left, width: largura },
  };
}
