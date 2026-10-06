"use client";

import type { ReactNode } from "react";

import LoadingPanel from "@/components/shared/LoadingPanel";
import { useCases } from "@/lib/context/CaseContext";
import { useNps } from "@/lib/context/NpsContext";

/**
 * As telas que contam só desenham com a base na mão (out/2026).
 *
 * Antes, nos primeiros segundos, o Índice pintava "Não recomendada · 0" e
 * escrevia "Resposta em 0%: meta cumprida" e "Mais 50 avaliações para o
 * mínimo de 50"; a Análise dizia "0 de 0 casos no recorte" e "Nenhuma
 * causa raiz marcada". Quem olhava primeiro levava um susto — ou
 * acreditava. `tambemNps` espera também as respostas do NPS, para quem
 * soma as frentes.
 */
export default function EsperaAsReclamacoes({ children, tambemNps = false }: { children: ReactNode; tambemNps?: boolean }) {
  const { cases, loading } = useCases();
  const { responses, loading: carregandoNps } = useNps();

  if (loading && cases.length === 0) return <LoadingPanel label="Carregando as reclamações…" />;
  if (tambemNps && carregandoNps && responses.length === 0) return <LoadingPanel label="Carregando o NPS…" />;

  return <>{children}</>;
}
