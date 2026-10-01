"use client";

import { useEffect, useSyncExternalStore } from "react";

import { leitura } from "@/lib/lote";

import type { RetratoDaEspera } from "@/lib/models/esperaNoWhatsapp";

/* Em lote, por rota (1.116): sai junto com as outras leituras da tela, em paralelo e fora da fila. */
const lerEsperaNoWhatsapp = leitura("espera");

/**
 * O retrato da lista do WhatsApp (1.108), lido a cada minuto — um só
 * pedido para todas as partes da tela que usam (o aviso e o plano).
 */
const INTERVALO_MS = 60_000;

let atual: RetratoDaEspera | null = null;
let ouvintes = new Set<() => void>();
let relogio: ReturnType<typeof setInterval> | null = null;

function ler() {
  lerEsperaNoWhatsapp()
    .then((r) => {
      atual = r;
      ouvintes.forEach((o) => o());
    })
    .catch(() => {});
}

function assinar(ouvinte: () => void) {
  ouvintes.add(ouvinte);
  if (!relogio) {
    ler();
    relogio = setInterval(ler, INTERVALO_MS);
  }
  return () => {
    ouvintes.delete(ouvinte);
    if (ouvintes.size === 0 && relogio) {
      clearInterval(relogio);
      relogio = null;
      ouvintes = new Set();
    }
  };
}

export function useEsperaNoWhatsapp(): RetratoDaEspera | null {
  const retrato = useSyncExternalStore(assinar, () => atual, () => null);
  /* Voltar para a aba lê de novo na hora, sem esperar o próximo minuto. */
  useEffect(() => {
    const aoVoltar = () => document.visibilityState === "visible" && ler();
    document.addEventListener("visibilitychange", aoVoltar);
    return () => document.removeEventListener("visibilitychange", aoVoltar);
  }, []);
  return retrato;
}
