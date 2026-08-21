"use client";

import { useMemo } from "react";

import { useCases } from "@/lib/context/CaseContext";
import { useTeams } from "@/lib/context/TeamsContext";

/**
 * Quem pode receber um caso.
 *
 * A união de duas fontes, e as duas são necessárias: o cadastro de
 * Times manda, mas as 333 reclamações importadas trazem responsáveis
 * que nunca foram cadastrados ali. Sem a união, o seletor esconderia
 * justamente quem já tem caso na mão — e a lista do filtro deixaria de
 * casar com o que aparece nos cartões.
 *
 * Estava duplicado na `Toolbar`; virou gancho quando o Kanban passou a
 * precisar da mesma lista para atribuir responsável.
 */
export function useOwners() {

  const { cases } = useCases();
  const { people } = useTeams();

  return useMemo(() => {

    const nomes = new Set<string>();

    for (const item of cases) {
      if (item.owner) nomes.add(item.owner);
    }

    for (const pessoa of people) {
      nomes.add(pessoa.name);
    }

    return [...nomes].sort((a, b) => a.localeCompare(b));

  }, [cases, people]);
}
