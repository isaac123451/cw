"use client";

import { useCallback } from "react";

import { useCases } from "@/lib/context/CaseContext";
import { useMovements } from "@/lib/context/MovementsContext";
import { useNps } from "@/lib/context/NpsContext";
import { useSla } from "@/lib/context/SlaContext";
import { useAvaliacoesGoogle } from "@/lib/context/useAvaliacoesGoogle";
import { useAgora } from "@/lib/hooks/useAgora";

import { passosParaFechar, type PassoParaFechar } from "@/lib/models/guiaParaFechar";
import type { FrenteId } from "@/lib/models/frentes";
import { movementsOf, openMovementOf } from "@/lib/services/movement.service";

/**
 * Os passos que faltam de um item do dia, lidos dos mesmos dados que as
 * fichas usam — salvou na janela, o passo aparece feito aqui na hora.
 *
 * Devolve `null` quando o item não é de uma ficha (a agenda, a métrica)
 * ou quando a ficha ainda não chegou.
 */
export function usePassosParaFechar() {

  const { cases } = useCases();
  const { responses, kinds } = useNps();
  const { avaliacoes } = useAvaliacoesGoogle();
  const { movements } = useMovements();
  const { expediente } = useSla();
  const agora = useAgora();

  return useCallback(
    (frente: FrenteId | undefined, ref: string): PassoParaFechar[] | null => {
      if (!agora) return null;

      if (frente === "reclame-aqui" || frente === "redes") {
        const item = cases.find((c) => c.id === ref);
        if (!item) return null;
        if (frente === "redes") return passosParaFechar({ frente, item });
        const aberta = openMovementOf(item.id, movements);
        return passosParaFechar({
          frente,
          item,
          contexto: {
            areaAberta: aberta ? { destino: aberta.destination } : undefined,
            areasConcluidas: movementsOf(item.id, movements).filter((m) => m.returnedAt).length,
            agora,
          },
        });
      }

      if (frente === "nps") {
        const item = responses.find((r) => r.id === ref);
        return item ? passosParaFechar({ frente, item, contexto: { tipos: kinds, agora, expediente } }) : null;
      }

      if (frente === "google") {
        const item = avaliacoes.find((a) => a.id === ref);
        return item ? passosParaFechar({ frente, item }) : null;
      }

      return null;
    },
    [agora, cases, responses, kinds, avaliacoes, movements, expediente]
  );
}
