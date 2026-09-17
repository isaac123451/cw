"use client";

import { useMemo } from "react";

import { useNps } from "@/lib/context/NpsContext";
import {
  criarIndice,
  regrasDeCausa,
  regrasDeTipoNps,
  sugerir,
  type Exemplo,
  type Sugestao,
} from "@/lib/models/sugestaoPorTexto";

/**
 * Sugestão de tipo e causa raiz do NPS pelo comentário (roadmap 2.0,
 * Fase 15).
 *
 * **Por que é client, e não ação de servidor.** O comentário de cada
 * ciclo já vem no `NpsContext` — é o mesmo texto que a ficha mostra em
 * citação —, então montar o índice aqui não busca nada a mais no banco.
 * Diferente do assunto do Reclame Aqui, que precisa do relato pesado
 * que a lista normalmente não carrega.
 *
 * **A base ainda é pequena.** Em 17/09/2026, só 4 ciclos têm comentário
 * e tipo classificados (e 3, causa raiz) — poucos para o cosseno dizer
 * algo sozinho. `sugerir` cai então quase todo no jogo de regras por
 * palavra (`regrasDeTipoNps`, `regrasDeCausa`), que não depende de
 * quantidade: a similaridade só ajuda a partir do que já foi corrigido,
 * e cresce sozinha a cada classificação nova.
 */
export function useSugestaoNps(comentario: string, nota: number) {
  const { responses, kinds, rootCauses } = useNps();

  const indices = useMemo(() => {
    const comTipo: Exemplo[] = responses.filter((r) => r.kind && r.comment.trim().length > 5).map((r) => ({ id: r.id, texto: r.comment, rotulo: r.kind! }));
    const comCausa: Exemplo[] = responses.filter((r) => r.rootCause && r.comment.trim().length > 5).map((r) => ({ id: r.id, texto: r.comment, rotulo: r.rootCause! }));
    return { tipo: criarIndice(comTipo), causa: criarIndice(comCausa), baseTipo: comTipo.length, baseCausa: comCausa.length };
  }, [responses]);

  return useMemo((): { tipo: Sugestao | null; causa: Sugestao | null } => {
    const texto = comentario.trim();
    if (texto.length < 6) return { tipo: null, causa: null };

    const nomesAtivos = kinds.filter((k) => k.active).map((k) => k.name);
    const causasAtivas = rootCauses.filter((c) => c.active).map((c) => c.name);

    return {
      tipo: sugerir(texto, { indice: indices.tipo, regras: regrasDeTipoNps(nota), valoresValidos: nomesAtivos, k: 5 }),
      causa: sugerir(texto, { indice: indices.causa, regras: regrasDeCausa(causasAtivas), valoresValidos: causasAtivas, k: 5 }),
    };
  }, [comentario, nota, indices, kinds, rootCauses]);
}
