"use client";

import type { NpsResponseView } from "@/lib/models/nps";

/**
 * O NPS guardado no navegador (05/11/2026, Fase F).
 *
 * A lista inteira do NPS (5.087 respostas, 3,2 MB) era baixada a cada aba
 * nova ou recarga, e o Meu dia esperava por ela: ~2 s na Vercel, 26 s
 * medidos daqui, onde a rede até o banco é lenta. Agora a última lista fica
 * no IndexedDB, por pessoa: a tela abre com ela na hora e o servidor manda só
 * o que mudou desde então (`?desde=`). A lista inteira continua sendo relida
 * a cada 30 minutos — é o que pega o que foi apagado.
 *
 * É cópia do que a pessoa já via, no próprio navegador dela, e sai ao sair da
 * conta. Qualquer falha (navegador sem IndexedDB, janela anônima, cota) só
 * volta ao caminho de antes.
 */

const BANCO = "cw-reputacao";
const LOJA = "guardados";
const CHAVE = "nps";
/* Mais velho que isso, a cópia não serve nem de abertura: lê do zero. */
const VALE_POR_MS = 24 * 60 * 60_000;

export interface NpsGuardado {
  usuario: string;
  respostas: NpsResponseView[];
  /** O `agora` do servidor na última leitura — o `desde` da próxima. */
  agora: string;
  /** Quando foi a última leitura completa (ms). */
  completaEm: number;
}

function abrir(): Promise<IDBDatabase> {
  return new Promise((resolver, recusar) => {
    if (typeof indexedDB === "undefined") return recusar(new Error("sem IndexedDB"));
    const pedido = indexedDB.open(BANCO, 1);
    pedido.onupgradeneeded = () => {
      if (!pedido.result.objectStoreNames.contains(LOJA)) pedido.result.createObjectStore(LOJA);
    };
    pedido.onsuccess = () => resolver(pedido.result);
    pedido.onerror = () => recusar(pedido.error);
  });
}

async function naLoja<T>(modo: IDBTransactionMode, fazer: (loja: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const banco = await abrir();
  try {
    return await new Promise<T>((resolver, recusar) => {
      const pedido = fazer(banco.transaction(LOJA, modo).objectStore(LOJA));
      pedido.onsuccess = () => resolver(pedido.result);
      pedido.onerror = () => recusar(pedido.error);
    });
  } finally {
    banco.close();
  }
}

/** A cópia desta pessoa, se for recente; senão `null`. */
export async function lerNpsGuardado(usuario: string): Promise<NpsGuardado | null> {
  try {
    const g = (await naLoja("readonly", (l) => l.get(CHAVE))) as NpsGuardado | undefined;
    if (!g || g.usuario !== usuario || !Array.isArray(g.respostas)) return null;
    if (Date.now() - Date.parse(g.agora) > VALE_POR_MS) return null;
    return g;
  } catch {
    return null;
  }
}

export async function guardarNps(dados: NpsGuardado) {
  try {
    await naLoja("readwrite", (l) => l.put(dados, CHAVE));
  } catch {
    /* Sem espaço ou sem IndexedDB: só não guarda. */
  }
}

export async function esquecerNpsGuardado() {
  try {
    await naLoja("readwrite", (l) => l.delete(CHAVE));
  } catch {
    /* nada a esquecer */
  }
}
