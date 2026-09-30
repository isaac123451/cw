"use client";

import { useCallback, useState } from "react";

/**
 * A largura real de um contêiner, para o gráfico desenhar em pixels (1.86).
 *
 * Os gráficos escalavam pelo `viewBox` com `h-auto w-full`: um desenho de
 * 720×220 numa tela de 1.400 px virava 1.400×430 — "sempre grandes
 * demais", e com a letra do eixo do tamanho de um título. Desenhando na
 * largura medida, a altura fica a que foi pedida e o texto, do tamanho
 * certo, em qualquer tela.
 *
 * Devolve um ref de callback (funciona mesmo quando o elemento aparece
 * depois) e a largura; antes da primeira medida, `inicial`.
 */
export function useLargura<T extends HTMLElement = HTMLDivElement>(inicial = 720) {
  const [largura, setLargura] = useState(inicial);

  const ref = useCallback((el: T | null) => {
    if (!el) return;
    const medir = () => {
      const w = Math.round(el.getBoundingClientRect().width);
      if (w > 0) setLargura((atual) => (Math.abs(atual - w) >= 1 ? w : atual));
    };
    medir();
    if (typeof ResizeObserver === "undefined") return;
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return [ref, largura] as const;
}
