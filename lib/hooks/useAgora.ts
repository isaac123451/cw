"use client";

import { useSyncExternalStore } from "react";

/**
 * O instante atual, que anda sozinho a cada minuto.
 *
 * **Um relógio para a tela inteira.** Um quadro com cinquenta cartões,
 * cada um com o seu `setInterval`, seriam cinquenta timers acordando o
 * navegador para dizer a mesma hora. Aqui há um só, ligado enquanto
 * alguém o assiste.
 *
 * **Nulo no servidor, de propósito.** O relógio de um prazo muda de
 * minuto em minuto; se o servidor desenhasse "vence em 2h40" e o
 * navegador hidratasse um minuto depois com "2h39", o React acusaria a
 * divergência. Quem recebe `null` desenha o chip só depois de montar.
 */

const INTERVALO_MS = 60_000;

let agoraAtual = 0;
let timer: ReturnType<typeof setInterval> | null = null;
const ouvintes = new Set<() => void>();

function assinar(ouvinte: () => void) {

  ouvintes.add(ouvinte);

  if (!timer) {
    agoraAtual = Date.now();
    timer = setInterval(() => {
      agoraAtual = Date.now();
      for (const o of ouvintes) o();
    }, INTERVALO_MS);
  }

  return () => {
    ouvintes.delete(ouvinte);

    if (ouvintes.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

function ler() {
  if (!agoraAtual) agoraAtual = Date.now();
  return agoraAtual;
}

export function useAgora(): Date | null {

  const t = useSyncExternalStore(assinar, ler, () => 0);

  return t ? new Date(t) : null;
}
