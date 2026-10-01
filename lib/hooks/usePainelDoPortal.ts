"use client";

import { useEffect, useState } from "react";

import { leitura } from "@/lib/lote";

import type { PainelDoPortal } from "@/lib/services/painelDoPortal.service";

/* Em lote, por rota (1.116): sai junto com as outras leituras da tela, em paralelo e fora da fila. */
const lerPainelDoPortal = leitura("painelDoPortal");

/* Uma leitura por carga da página: o quadro e o índice pedem o mesmo painel. */
let emCurso: Promise<Record<string, PainelDoPortal>> | null = null;

/**
 * O painel oficial do Reclame Aqui, o mais recente de cada período (1.86).
 * Vazio até chegar — e vazio se o vigia ainda não o leu.
 */
export function usePainelDoPortal() {
  const [paineis, setPaineis] = useState<Record<string, PainelDoPortal>>({});

  useEffect(() => {
    let vivo = true;
    emCurso ??= lerPainelDoPortal()
      .then((r) => (r.ok ? r.atuais : {}))
      .catch(() => ({}));
    emCurso.then((p) => {
      if (vivo) setPaineis(p);
    });
    const soltar = setTimeout(() => {
      emCurso = null;
    }, 60_000);
    return () => {
      vivo = false;
      clearTimeout(soltar);
    };
  }, []);

  return paineis;
}
