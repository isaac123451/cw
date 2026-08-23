"use client";

import { useWorkspaceSlice } from "@/lib/context/useWorkspace";

import {
  PLANOS_PADRAO,
  PlanOption,
} from "@/lib/models/plan";

/**
 * Planos e módulos, da carga do workspace.
 *
 * Hook e não contexto: só duas telas leem — o cadastro e a inserção de
 * macro. Um provider a mais na árvore custaria uma renderização em toda
 * página para servir duas.
 */
export function usePlans() {
  return useWorkspaceSlice(
    (dados) => dados.plans,
    PLANOS_PADRAO.map((item, i) => ({
      ...item,
      id: `padrao-plano-${i}`,
    })) as PlanOption[]
  );
}
