"use client";

import { useMemo } from "react";

import { useCases } from "@/lib/context/CaseContext";
import type { Case } from "@/lib/models/case";
import { nomeDaEtapaDasRedes } from "@/lib/models/redes";
import { byChannel, Channel } from "@/lib/services/case.service";

/**
 * Mesma API do `useCases`, porém recortada por canal de origem.
 * Evita que o módulo Reclame Aqui enxergue casos de redes sociais
 * (e vice-versa) sem espalhar `filter` por todos os componentes.
 */
export function useScopedCases(channel: Channel) {

  const context = useCases();

  const cases = useMemo(
    () => comEtapaDasRedes(byChannel(context.cases, channel), channel),
    [context.cases, channel]
  );

  const filteredCases = useMemo(
    () => comEtapaDasRedes(byChannel(context.filteredCases, channel), channel),
    [context.filteredCases, channel]
  );

  return { ...context, cases, filteredCases };
}

/**
 * Nas Redes, o status lido como etapa das Redes (03/11/2026): o que veio com
 * o nome de uma coluna do Reclame Aqui ("Avaliado como resolvido") volta a
 * cair na coluna "Resolvido" do quadro e na conta de resolvidos. Mesmo
 * objeto quando não muda nada, para não refazer a lista à toa.
 */
function comEtapaDasRedes(lista: Case[], channel: Channel): Case[] {
  if (channel !== "social") return lista;
  let mudou = false;
  const saida = lista.map((c) => {
    const nome = nomeDaEtapaDasRedes(c.status);
    if (nome === c.status) return c;
    mudou = true;
    return { ...c, status: nome };
  });
  return mudou ? saida : lista;
}
