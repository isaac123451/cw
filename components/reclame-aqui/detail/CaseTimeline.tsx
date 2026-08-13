"use client";

import { History } from "lucide-react";

import { Case } from "@/lib/models/case";

import { useMovements } from "@/lib/context/MovementsContext";

import {
  buildTimeline,
  TIMELINE_TONE,
} from "@/lib/services/timeline.service";

import SurfaceCard from "@/components/shared/SurfaceCard";

function br(date?: string) {
  if (!date) return "—";
  return date.split("-").reverse().join("/");
}

/**
 * Histórico do caso.
 *
 * Antes era um bloco de JSX dentro do CaseDetail que montava a lista na
 * marra. Virou componente para a linha do tempo poder somar as
 * movimentações internas — que é o registro que faltava para o prazo de
 * movimentação existir.
 */
export default function CaseTimeline({
  data,
}: {
  data: Case;
}) {

  const { movements } = useMovements();

  const entries = buildTimeline(data, movements);

  return (
    <SurfaceCard
      title="Histórico da reclamação"
      description="Linha do tempo completa das mudanças registradas."
    >

      <ol className="relative space-y-5 before:absolute before:left-[5px] before:top-2 before:h-[calc(100%-1rem)] before:w-px before:bg-zinc-200 before:content-['']">

        {entries.map((item) => (

          <li key={item.id} className="relative pl-6">

            <span
              className={`absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-white ${TIMELINE_TONE[item.tone]}`}
            />

            <p className="text-sm font-medium text-zinc-800">
              {item.title}
            </p>

            <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">
              {br(item.at)} · {item.detail}
            </p>

          </li>

        ))}

      </ol>

      <p className="mt-5 flex items-center gap-2 border-t border-zinc-100 pt-4 text-xs text-zinc-400">
        <History size={13} />
        Rastreabilidade completa: origem, classificação,
        movimentações internas, resposta, avaliação e
        encerramento.
      </p>

    </SurfaceCard>
  );
}
