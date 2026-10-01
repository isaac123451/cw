"use client";

import type { Leituras, NomeDaLeitura } from "@/lib/leituras/registro";

/**
 * As leituras da tela em lote, fora da fila das server actions (1.116) — ver
 * `app/api/leitura/lote/route.ts`.
 *
 * `leitura("meuDia")` devolve uma função com a mesma assinatura da action.
 * As chamadas feitas dentro de uma janela curta (o tempo de a tela montar)
 * vão juntas numa ida só, e a rota as roda em paralelo — sem esperar a
 * carga inicial nem umas às outras.
 */

type Pedido = { nome: NomeDaLeitura; args: unknown[]; resolver: (v: unknown) => void; rejeitar: (e: unknown) => void };

const JANELA_MS = 15;

let fila: Pedido[] = [];
let relogio: ReturnType<typeof setTimeout> | null = null;

async function despachar() {
  const lote = fila;
  fila = [];
  relogio = null;
  try {
    const resposta = await fetch("/api/leitura/lote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pedidos: lote.map(({ nome, args }) => ({ nome, args })) }),
      cache: "no-store",
    });
    if (!resposta.ok) throw new Error(`lote: ${resposta.status}`);
    const { respostas } = (await resposta.json()) as { respostas: { ok: boolean; valor?: unknown; erro?: string }[] };
    lote.forEach((p, i) => {
      const r = respostas[i];
      if (r?.ok) p.resolver(r.valor);
      else p.rejeitar(new Error(r?.erro ?? "A leitura falhou."));
    });
  } catch (erro) {
    for (const p of lote) p.rejeitar(erro);
  }
}

export function leitura<N extends NomeDaLeitura>(nome: N): (...args: Parameters<Leituras[N]>) => ReturnType<Leituras[N]> {
  return ((...args: unknown[]) =>
    new Promise((resolver, rejeitar) => {
      fila.push({ nome, args, resolver, rejeitar });
      if (!relogio) relogio = setTimeout(despachar, JANELA_MS);
    })) as unknown as (...args: Parameters<Leituras[N]>) => ReturnType<Leituras[N]>;
}
