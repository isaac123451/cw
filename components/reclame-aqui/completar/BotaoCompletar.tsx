"use client";

import { UserRoundPen } from "lucide-react";

import {
  Case,
  descreverFaltas,
  faltaNoCadastro,
} from "@/lib/models/case";

import { useCompletar } from "./CompletarProvider";

/**
 * "Completar", no cartão do Kanban, na linha da lista e na tela do caso.
 *
 * Só aparece quando falta algo — a reclamação que entrou pelo vigia sem
 * nome, contato ou CPF/CNPJ. Numa base completa, ele não existe.
 *
 * O cartão do Kanban é um link arrastável e a linha da lista abre a
 * prévia: o clique para aqui (`preventDefault` e `stopPropagation`) e o
 * botão não arrasta, senão completar viraria abrir o caso ou mover de
 * coluna.
 */
export default function BotaoCompletar({
  item,
  className = "",
}: {
  item: Case;
  className?: string;
}) {

  const { abrir } = useCompletar();

  const faltas = faltaNoCadastro(item);

  if (faltas.length === 0) return null;

  return (
    <button
      type="button"
      draggable={false}
      onDragStart={(evento) => evento.preventDefault()}
      onClick={(evento) => {
        evento.preventDefault();
        evento.stopPropagation();
        abrir(item.id);
      }}
      title={`Falta ${descreverFaltas(faltas)} — completar`}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200 transition-colors hover:bg-amber-100 ${className}`}
    >
      <UserRoundPen size={11} />
      Completar
    </button>
  );
}
