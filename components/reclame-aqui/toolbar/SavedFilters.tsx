"use client";

import { useState } from "react";

import {
  Bookmark,
  BookmarkPlus,
  Check,
  ChevronDown,
  Trash2,
} from "lucide-react";

import type { CaseFilters } from "@/lib/context/CaseContext";
import { useSavedFilters } from "@/lib/context/SavedFiltersContext";
import { useToast } from "@/lib/context/ToastContext";

import {
  countCriteria,
  describeCriteria,
  sameCriteria,
} from "@/lib/models/savedFilter";

interface Props {
  /** Combinação que está valendo na tela. */
  criteria: CaseFilters;
  onApply: (value: CaseFilters) => void;
}

/**
 * Guarda e reaplica combinações de filtro.
 *
 * Recebe o critério por prop em vez de ler o contexto: assim a mesma
 * barra serve Redes Sociais quando aquele módulo tiver dados.
 */
export default function SavedFilters({
  criteria,
  onApply,
}: Props) {

  const { filters, saveFilter, removeFilter } =
    useSavedFilters();

  const { notify } = useToast();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  const ativos = countCriteria(criteria);

  const meus = filters.filter((item) => !item.builtIn);
  const prontos = filters.filter((item) => item.builtIn);

  /**
   * Salvar diz o que fez.
   *
   * O botão gravava calado, e sobrescrever um filtro de mesmo nome era
   * o desfecho mais fácil de não perceber: a gaveta fechava igual, e a
   * combinação anterior tinha ido embora.
   */
  function handleSave() {

    const resultado = saveFilter(name, criteria);

    if (resultado === "vazio") {
      notify({
        tone: "error",
        title: "Não deu para salvar o filtro.",
        detail:
          "Ele precisa de um nome e de pelo menos um critério na barra.",
      });
      return;
    }

    notify({
      tone: "success",
      title:
        resultado === "atualizado"
          ? `"${name.trim()}" foi atualizado.`
          : `"${name.trim()}" foi salvo.`,
      detail: describeCriteria(criteria).join(" · "),
    });

    setName("");
    setOpen(false);
  }

  function handleRemove(
    item: (typeof filters)[number]
  ) {

    removeFilter(item.id);

    notify({
      tone: "info",
      title: `"${item.name}" foi excluído.`,
      detail: "Os filtros da operação continuam ali.",
    });
  }

  function renderItem(
    item: (typeof filters)[number]
  ) {

    const atual = sameCriteria(item.criteria, criteria);

    return (
      <li key={item.id} className="group relative">

        <button
          onClick={() => {
            onApply(item.criteria);
            setOpen(false);
          }}
          title={describeCriteria(item.criteria).join(" · ")}
          className={`flex w-full flex-col items-start gap-0.5 rounded-xl px-3 py-2.5 pr-9 text-left transition-colors ${atual ? "bg-violet-50" : "hover:bg-zinc-50"}`}
        >

          <span className="flex w-full items-center gap-2">

            <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-800">
              {item.name}
            </span>

            {atual && (
              <Check
                size={14}
                className="shrink-0 text-violet-700"
              />
            )}

          </span>

          <span className="block truncate text-[11px] leading-snug text-zinc-500">
            {describeCriteria(item.criteria).join(" · ")}
          </span>

        </button>

        {!item.builtIn && (
          <button
            onClick={() => handleRemove(item)}
            aria-label={`Excluir o filtro ${item.name}`}
            title="Excluir este filtro"
            className="absolute right-2 top-2.5 rounded-lg p-1.5 text-zinc-400 opacity-0 transition-colors hover:bg-rose-50 hover:text-rose-600 focus:opacity-100 group-hover:opacity-100"
          >
            <Trash2 size={14} />
          </button>
        )}

      </li>
    );
  }

  return (
    <div className="relative">

      <button
        onClick={() => setOpen((value) => !value)}
        title="Aplicar ou guardar uma combinação de filtros"
        className="flex h-10 items-center gap-1.5 rounded-xl border border-zinc-200 px-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
      >

        <Bookmark size={15} />

        <span className="hidden lg:inline">Filtros</span>

        {meus.length > 0 && (
          <span className="rounded-full bg-zinc-100 px-1.5 text-[11px] font-semibold text-zinc-600">
            {meus.length}
          </span>
        )}

        <ChevronDown size={13} className="opacity-60" />

      </button>

      {open && (

        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />

          <div className="absolute left-0 top-[calc(100%+6px)] z-50 w-80 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_12px_32px_-12px_rgba(16,24,40,0.25)]">

            <p className="border-b border-zinc-100 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
              Da operação
            </p>

            <ul className="p-1.5">
              {prontos.map(renderItem)}
            </ul>

            <p className="border-y border-zinc-100 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
              Meus filtros
            </p>

            {meus.length === 0 ? (

              <p className="px-4 py-4 text-xs leading-relaxed text-zinc-500">
                Nenhum filtro guardado ainda. Monte a
                combinação na barra e salve aqui embaixo.
              </p>

            ) : (

              <ul className="max-h-64 overflow-y-auto p-1.5">
                {meus.map(renderItem)}
              </ul>

            )}

            <div className="border-t border-zinc-100 bg-zinc-50/60 p-3">

              {ativos === 0 ? (

                <p className="text-xs text-zinc-500">
                  Selecione ao menos um filtro na barra para
                  poder salvar.
                </p>

              ) : (

                <>
                  <div className="flex items-center gap-2">

                    <input
                      value={name}
                      onChange={(e) =>
                        setName(e.target.value)
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSave();
                      }}
                      placeholder="Nome do filtro"
                      className="h-9 min-w-0 flex-1 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-violet-400"
                    />

                    <button
                      onClick={handleSave}
                      disabled={name.trim() === ""}
                      title="Guardar a combinação atual"
                      className="flex h-9 items-center gap-1.5 rounded-xl bg-violet-600 px-3 text-sm font-medium text-white transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400"
                    >
                      <BookmarkPlus size={15} />
                      Salvar
                    </button>

                  </div>

                  <p className="mt-2 truncate text-[11px] text-zinc-500">
                    {describeCriteria(criteria).join(" · ")}
                  </p>

                </>

              )}

            </div>

          </div>
        </>

      )}

    </div>
  );
}
