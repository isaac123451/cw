"use client";

import type { ReactNode } from "react";

import LoadingPanel from "@/components/shared/LoadingPanel";
import { useCases } from "@/lib/context/CaseContext";

/**
 * As telas do Reclame Aqui que contam só desenham com a base na mão
 * (out/2026).
 *
 * Antes, nos primeiros segundos, o Índice pintava "Não recomendada · 0" e
 * escrevia "Resposta em 0%: meta cumprida" e "Mais 50 avaliações para o
 * mínimo de 50"; a Análise, os Gráficos, a Calculadora, a Triagem e o
 * Pedir avaliação faziam o mesmo com os seus números. Quem olhava
 * primeiro levava um susto — ou acreditava.
 */
export default function EsperaAsReclamacoes({ children }: { children: ReactNode }) {
  const { cases, loading } = useCases();

  if (loading && cases.length === 0) return <LoadingPanel label="Carregando as reclamações…" />;

  return <>{children}</>;
}
