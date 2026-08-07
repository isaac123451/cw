"use client";

import { useMemo } from "react";

import { useCases } from "@/lib/context/CaseContext";
import { byChannel, Channel } from "@/lib/services/case.service";

/**
 * Mesma API do `useCases`, porém recortada por canal de origem.
 * Evita que o módulo Reclame Aqui enxergue casos de redes sociais
 * (e vice-versa) sem espalhar `filter` por todos os componentes.
 */
export function useScopedCases(channel: Channel) {

  const context = useCases();

  const cases = useMemo(
    () => byChannel(context.cases, channel),
    [context.cases, channel]
  );

  const filteredCases = useMemo(
    () => byChannel(context.filteredCases, channel),
    [context.filteredCases, channel]
  );

  return { ...context, cases, filteredCases };
}
