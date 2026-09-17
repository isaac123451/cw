"use client";

import { Loader2 } from "lucide-react";

import CaseDetail from "@/components/reclame-aqui/detail/CaseDetail";
import FichaDoNps from "@/components/nps/ficha/FichaDoNps";

import { useCases } from "@/lib/context/CaseContext";
import type { FrenteDaJanela } from "@/lib/models/janelas";

/**
 * A ficha inteira dentro da mini-janela (Fase 12 do roadmap 2.0).
 *
 * O Isaac: "em cada frente eu consiga abrir mini janelas com tudo que
 * possui em cada caso para preenchimento, alteração, adição". A janela
 * essencial muda etapa, prioridade e responsável; esta mostra **a mesma
 * ficha da tela cheia** — dados do cliente, triagem, trilha, contatos,
 * áreas, anotações, etiquetas, impacto, resposta, encerramento —, no
 * formato empilhado que a lista já usava na prévia lateral.
 *
 * É a mesma ficha, e não uma cópia: tudo o que é corrigido ou acrescentado
 * nela vale aqui também, e as proteções de gravação (edição simultânea,
 * resultado do servidor) são as mesmas.
 */
export default function FichaCompletaNaJanela({ frente, id }: { frente: FrenteDaJanela; id: string }) {
  const { cases, loading } = useCases();

  if (frente === "nps") {
    return (
      <div className="p-3">
        <FichaDoNps id={id} naJanela />
      </div>
    );
  }

  const caso = cases.find((c) => c.id === id);

  if (!caso) {
    return (
      <p className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-zinc-500">
        {loading ? (
          <>
            <Loader2 size={15} className="animate-spin" /> Abrindo a ficha…
          </>
        ) : (
          "Este caso não está mais na base — pode ter sido excluído."
        )}
      </p>
    );
  }

  return (
    <div className="p-3">
      <CaseDetail data={caso} variant="drawer" />
    </div>
  );
}
