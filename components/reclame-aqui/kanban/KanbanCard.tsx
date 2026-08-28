"use client";

import Link from "next/link";

import { useState } from "react";

import {
  Clock3,
  GripVertical,
  MapPin,
  Star,
  Trash2,
  TriangleAlert,
} from "lucide-react";

import { Case } from "@/lib/models/case";
import { TagChips } from "@/components/shared/TagPicker";
import { ConfirmDelete } from "@/components/shared/Modal";

import { useCases } from "@/lib/context/CaseContext";
import { useOwners } from "@/lib/hooks/useOwners";
import { caseHref } from "@/lib/services/case.service";

interface Props {
  item: Case;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
}

const priorityTone: Record<string, string> = {
  Crítica: "bg-rose-50 text-rose-700 ring-rose-100",
  Alta: "bg-orange-50 text-orange-700 ring-orange-100",
  Média: "bg-amber-50 text-amber-700 ring-amber-100",
  Baixa: "bg-zinc-100 text-zinc-600 ring-zinc-200",
};

export default function KanbanCard({
  item,
  onDragStart,
  onDragEnd,
}: Props) {

  const [dragging, setDragging] = useState(false);

  /** Diálogo de exclusão aberto. Apagar caso não tem desfazer. */
  const [confirmando, setConfirmando] = useState(false);

  const { updateCase, deleteCase } = useCases();
  const owners = useOwners();

  /**
   * Vazio é "sem responsável", não a string vazia.
   *
   * `Case.owner` é opcional; gravar `""` faria o cartão mostrar um
   * responsável de nome em branco e o filtro por responsável ganharia
   * uma opção invisível.
   */
  function atribuir(nome: string) {
    updateCase({
      ...item,
      owner: nome === "" ? undefined : nome,
    });
  }

  return (
    <>
    <Link
      href={caseHref(item)}
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData("text/plain", item.id);
        event.dataTransfer.effectAllowed = "move";
        setDragging(true);
        onDragStart(item.id);
      }}
      onDragEnd={() => {
        setDragging(false);
        onDragEnd();
      }}
      className={`group block cursor-grab rounded-xl border border-zinc-200 bg-white p-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-all duration-200 active:cursor-grabbing hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-[0_8px_20px_-8px_rgba(91,42,134,0.35)] ${
        dragging ? "opacity-40" : ""
      }`}
    >

      <div className="flex items-start justify-between gap-2">

        <span className="font-mono text-[10px] uppercase tracking-wide text-zinc-400">
          {item.protocol}
        </span>

        <div className="flex shrink-0 items-center gap-1">

          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${
              priorityTone[item.priority] ??
              "bg-zinc-100 text-zinc-600 ring-zinc-200"
            }`}
          >
            {item.priority}
          </span>

          {/*
            Excluir a reclamação, do próprio quadro.

            O Isaac: "crie a opção de excluir uma reclamação pelo quadro
            ou quando abrir ela". Existe porque a base recebe caso
            criado por engano — duplicata de captura, teste, reclamação
            aberta na frente errada — e o único jeito de tirar era pelo
            banco.

            **Só aparece no hover, e sempre pede confirmação.** O cartão
            é arrastável: um botão de excluir sempre visível fica a
            milímetros do gesto de mover, e apagar reclamação não tem
            desfazer.
          */}
          <button
            type="button"
            onClick={(e) => {
              /*
                O cartão inteiro é um link para o caso.

                Sem parar a propagação, o clique em excluir abriria a
                ficha por baixo do diálogo de confirmação.
              */
              e.preventDefault();
              e.stopPropagation();
              setConfirmando(true);
            }}
            title="Excluir esta reclamação"
            className="rounded p-0.5 text-zinc-300 opacity-0 transition-all hover:bg-rose-50 hover:text-rose-600 focus-visible:opacity-100 group-hover:opacity-100"
          >
            <Trash2 size={13} />
          </button>

          <GripVertical
            size={13}
            className="text-zinc-300 opacity-0 transition-opacity group-hover:opacity-100"
          />

        </div>

      </div>

      <h3 className="mt-1.5 line-clamp-2 text-sm font-semibold leading-snug text-zinc-900">
        {item.title}
      </h3>

      <p className="mt-1.5 truncate text-xs text-zinc-500">
        {item.company} · {item.customer}
      </p>

      <div className="mt-2 flex items-center gap-3 text-[11px] text-zinc-400">

        {(item.city || item.state) && (
          <span className="flex items-center gap-1">
            <MapPin size={11} />
            {[item.city, item.state]
              .filter(Boolean)
              .join("/")}
          </span>
        )}

        <span className="flex items-center gap-1">
          <Clock3 size={11} />
          {item.sla}
        </span>

        <span className="flex items-center gap-1">
          <Star
            size={11}
            className="fill-amber-400 text-amber-400"
          />
          {item.score ?? "-"}
        </span>

      </div>

      {item.tags && item.tags.length > 0 && (
        <div className="mt-2.5">
          <TagChips tags={item.tags} />
        </div>
      )}

      <div className="mt-3 flex items-center justify-between border-t border-zinc-100 pt-2.5">

        {/*
          Atribuir responsável sem sair do quadro.

          Antes o nome era só texto: para pôr alguém num caso era
          preciso abrir a tela do caso — e no Kanban, que é onde a
          operação distribui o trabalho, não havia caminho nenhum.

          O cartão inteiro é um link e é arrastável, então o seletor
          precisa das três travas abaixo: `preventDefault` no clique
          (senão navega), `stopPropagation` (senão o clique sobe para o
          link) e `draggable={false}` (senão arrastar para abrir a lista
          arrasta o cartão para outra coluna).
        */}
        <span
          className="flex min-w-0 items-center gap-1.5 text-[11px] text-zinc-500"
          draggable={false}
          onDragStart={(event) => event.preventDefault()}
        >

          <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold ${item.owner ? "bg-violet-100 text-violet-700" : "bg-zinc-100 text-zinc-400"}`}>
            {(item.owner ?? "?").slice(0, 1).toUpperCase()}
          </span>

          <select
            value={item.owner ?? ""}
            aria-label={`Responsável por ${item.protocol}`}
            title="Atribuir responsável"
            draggable={false}
            onDragStart={(event) => event.preventDefault()}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onChange={(event) => {
              event.preventDefault();
              event.stopPropagation();
              atribuir(event.target.value);
            }}
            className={`-ml-1 max-w-[130px] cursor-pointer truncate rounded-md border border-transparent bg-transparent px-1 py-0.5 text-[11px] outline-none transition-colors hover:border-zinc-200 hover:bg-zinc-50 focus:border-violet-400 ${item.owner ? "text-zinc-600" : "text-zinc-400"}`}
          >
            <option value="">Sem responsável</option>
            {owners.map((nome) => (
              <option key={nome} value={nome}>
                {nome}
              </option>
            ))}
          </select>

        </span>

        {item.churnRisk ? (
          <span className="flex items-center gap-1 text-[10px] font-semibold text-rose-600">
            <TriangleAlert size={11} />
            Churn
          </span>
        ) : (
          <span
            className={`text-[10px] font-semibold ${
              item.resolved
                ? "text-emerald-600"
                : "text-zinc-400"
            }`}
          >
            {item.resolved ? "Resolvido" : "Em aberto"}
          </span>
        )}

      </div>

      </Link>

      <ConfirmDelete
        open={confirmando}
        label={`${item.protocol} — ${item.title}`}
        onCancel={() => setConfirmando(false)}
        onConfirm={() => {
          deleteCase(item.id);
          setConfirmando(false);
        }}
      />

    </>
  );
}
