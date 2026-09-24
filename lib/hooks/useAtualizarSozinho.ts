"use client";

import { useEffect, useRef } from "react";

/**
 * Relê os dados sozinho — o fim do "sempre é preciso clicar em recarregar".
 *
 * O Isaac: "além de que sempre é preciso clicar em recarregar, verifique
 * isso". As listas (reclamações, NPS) eram lidas uma vez ao abrir a
 * plataforma: o que outra pessoa, a extensão ou o vigia gravassem só
 * aparecia recarregando a página. Agora relê ao voltar para a aba (se já
 * passou um minuto) e a cada `intervaloMs` com a aba à vista — nunca com
 * ela escondida, para não gastar banco à toa.
 */
export function useAtualizarSozinho(reler: () => unknown, ativo: boolean, intervaloMs = 180_000) {
  const ultima = useRef(0);
  const releitura = useRef(reler);

  useEffect(() => {
    releitura.current = reler;
  });

  useEffect(() => {
    if (!ativo) return;
    ultima.current = Date.now();

    const talvez = (minimo: number) => {
      if (document.visibilityState !== "visible" || Date.now() - ultima.current < minimo) return;
      ultima.current = Date.now();
      void releitura.current();
    };

    const aoVoltar = () => talvez(60_000);
    const relogio = window.setInterval(() => talvez(intervaloMs - 1_000), intervaloMs);

    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener("focus", aoVoltar);
    return () => {
      window.clearInterval(relogio);
      document.removeEventListener("visibilitychange", aoVoltar);
      window.removeEventListener("focus", aoVoltar);
    };
  }, [ativo, intervaloMs]);
}
