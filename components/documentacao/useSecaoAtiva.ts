"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A seção que está sendo lida, para o índice acompanhar.
 *
 * `chave` são as âncoras do documento aberto, unidas por "|", na ordem
 * do texto. A seção lida é a última cujo título já passou da linha de
 * leitura (30% da altura do contêiner que rola, até 160 px do topo).
 *
 * Quem clica numa seção do índice ou chega por um link com `#` "fixa" a
 * seção: no fim do documento, as últimas seções nunca sobem até a linha
 * de leitura, e o índice marcaria a de cima em vez da que a pessoa
 * pediu. A fixação solta no primeiro gesto de rolagem da pessoa (roda,
 * toque, teclado).
 *
 * Mede na rolagem, não com `IntersectionObserver`: com a janela como
 * raiz, a margem era medida contra a janela de cima — dentro de um
 * iframe ou com zoom, uma seção já passada continuava "visível".
 */
export function useSecaoAtiva(chave: string) {
  const [ativa, setAtiva] = useState<string | null>(null);
  const fixada = useRef<string | null>(null);

  useEffect(() => {
    const ancoras = chave ? chave.split("|") : [];
    /* Outro documento: a seção fixada no anterior não vale aqui. */
    fixada.current = null;
    if (ancoras.length === 0) return;

    const raiz = quemRola(document.getElementById(ancoras[0]));
    const alvo: HTMLElement | Window = raiz ?? window;
    let quadro = 0;

    const medir = () => {
      quadro = 0;
      if (fixada.current) return setAtiva(fixada.current);
      const topo = raiz ? raiz.getBoundingClientRect().top : 0;
      const altura = raiz ? raiz.clientHeight : window.innerHeight;
      const linha = topo + Math.min(160, altura * 0.3);
      let lida = ancoras[0];
      for (const a of ancoras) {
        const el = document.getElementById(a);
        if (!el) continue;
        if (el.getBoundingClientRect().top <= linha) lida = a;
        else break;
      }
      setAtiva(lida);
    };
    const agendar = () => {
      if (!quadro) quadro = requestAnimationFrame(medir);
    };
    const soltar = () => {
      fixada.current = null;
    };

    alvo.addEventListener("scroll", agendar, { passive: true });
    alvo.addEventListener("wheel", soltar, { passive: true });
    alvo.addEventListener("touchmove", soltar, { passive: true });
    window.addEventListener("keydown", soltar);
    agendar();

    return () => {
      alvo.removeEventListener("scroll", agendar);
      alvo.removeEventListener("wheel", soltar);
      alvo.removeEventListener("touchmove", soltar);
      window.removeEventListener("keydown", soltar);
      if (quadro) cancelAnimationFrame(quadro);
    };
  }, [chave]);

  /** A seção que a pessoa pediu — vale até ela rolar por conta própria. */
  const fixar = useCallback((ancora: string) => {
    fixada.current = ancora;
    setAtiva(ancora);
  }, []);

  return [ativa, fixar] as const;
}

/** O primeiro ancestral com rolagem própria (no layout, o `<main>`). */
function quemRola(el: HTMLElement | null): HTMLElement | null {
  for (let p = el?.parentElement ?? null; p; p = p.parentElement) {
    const { overflowY } = getComputedStyle(p);
    if (overflowY === "auto" || overflowY === "scroll") return p;
  }
  return null;
}
