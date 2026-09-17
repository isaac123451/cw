"use client";

import { Case, CRITERIOS } from "@/lib/models/case";
import { isOpen } from "@/lib/services/case.service";

import { useTratativa } from "./TratativaProvider";

interface Props {
  item: Case;
  className?: string;
  /** No quadro, "Normal" já triado é ruído: só Urgente, Alta e "a triar" aparecem. */
  ocultarNormal?: boolean;
}

const TOM: Record<Case["priority"], string> = {
  Urgente: "bg-rose-50 text-rose-700 ring-rose-200",
  Alta: "bg-orange-50 text-orange-700 ring-orange-200",
  Normal: "bg-zinc-100 text-zinc-600 ring-zinc-200",
};

/**
 * A criticidade do caso, e se ela já passou pela triagem.
 *
 * Caso em aberto sem triagem mostra "a triar", com contorno tracejado:
 * a prioridade que aparece ali ainda é a de entrada, não uma decisão de
 * ninguém. Clicar abre a triagem — com os critérios da documentação —
 * sem sair do quadro.
 */
export default function ChipPrioridade({ item, className = "", ocultarNormal = false }: Props) {

  const { abrirTriagem } = useTratativa();

  const aTriar = !item.triadaEm && isOpen(item);

  const marcados = CRITERIOS.filter((c) => item.criterios?.includes(c.id));

  const dica = aTriar
    ? "Ainda sem triagem — a prioridade é a de entrada. Clique para triar pelos critérios da documentação."
    : [
        `Triado${item.triadaPor ? ` por ${item.triadaPor}` : ""}.`,
        marcados.length > 0 ? `Critérios: ${marcados.map((c) => c.texto).join("; ")}.` : "Sem critério de Urgente ou Alta marcado.",
        "Clique para refazer a triagem.",
      ].join(" ");

  if (ocultarNormal && !aTriar && item.priority === "Normal") return null;

  return (
    <button
      type="button"
      title={dica}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        abrirTriagem(item);
      }}
      draggable={false}
      onDragStart={(e) => e.preventDefault()}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold transition-shadow hover:shadow-sm ${
        aTriar
          ? "border border-dashed border-violet-300 bg-white text-violet-700"
          : `ring-1 ring-inset ${TOM[item.priority]}`
      } ${className}`}
    >
      {aTriar ? (
        <>
          <span className="h-1.5 w-1.5 rounded-full bg-violet-500" aria-hidden />
          a triar
        </>
      ) : (
        item.priority
      )}
    </button>
  );
}
