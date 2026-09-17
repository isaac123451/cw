"use client";

import { cargaInicial, type CargaInicial } from "@/lib/actions/cargaInicial";

/**
 * O lado do navegador da carga inicial (ver `lib/actions/cargaInicial`).
 *
 * O primeiro provider que pede dispara a ida única; os outros aguardam a
 * mesma resposta e pegam a sua parte. **A parte só vale na abertura**:
 * passados alguns segundos da resposta, quem pede de novo — um recarregar
 * depois de gravar, uma remontagem — vai pelo caminho próprio, para nunca
 * servir dado velho. Parte que falhou no servidor também vai pelo
 * caminho próprio.
 */

const VALIDADE_MS = 10_000;

let pendente: Promise<CargaInicial> | null = null;
let chegouEm = 0;

function carga() {
  if (!pendente) {
    pendente = cargaInicial()
      .then((c) => {
        chegouEm = Date.now();
        return c;
      })
      .catch((erro) => {
        pendente = null;
        throw erro;
      });
  }
  return pendente;
}

type Valor<K extends keyof CargaInicial> = Extract<CargaInicial[K], { ok: true }>["valor"];

export async function daCargaInicial<K extends keyof CargaInicial>(
  chave: K,
  caminhoProprio: () => Promise<Valor<K>>
): Promise<Valor<K>> {
  if (chegouEm && Date.now() - chegouEm > VALIDADE_MS) return caminhoProprio();

  try {
    const c = await carga();
    const p = c[chave];
    if (p.ok) return p.valor as Valor<K>;
  } catch {
    /* A ida única caiu inteira: cada parte tenta pelo seu caminho. */
  }

  return caminhoProprio();
}
