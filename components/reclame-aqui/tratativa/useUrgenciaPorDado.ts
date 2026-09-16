"use client";

import { useMemo } from "react";

import { useCases } from "@/lib/context/CaseContext";
import { useEstablishments } from "@/lib/context/EstablishmentsContext";
import { useNps } from "@/lib/context/NpsContext";
import { usePlans } from "@/lib/hooks/usePlans";

import type { Case } from "@/lib/models/case";
import { urgenciaPorDado } from "@/lib/models/urgenciaPorDado";

/** A urgência que os dados sugerem para o caso — a mesma conta na triagem e na ficha. */
export function useUrgenciaPorDado(caso: Case) {
  const { cases } = useCases();
  const { establishments } = useEstablishments();
  const { responses } = useNps();
  const [planos] = usePlans();

  return useMemo(
    () => urgenciaPorDado(caso, { casos: cases, estabelecimentos: establishments, planos, nps: responses }),
    [caso, cases, establishments, planos, responses]
  );
}
