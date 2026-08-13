"use client";

import { useEffect } from "react";

import { X } from "lucide-react";

import { useCases } from "@/lib/context/CaseContext";

import CaseDetail from "@/components/reclame-aqui/detail/CaseDetail";

interface Props {
  open: boolean;
  /** Id do caso — não o objeto, para o painel refletir as edições. */
  caseId?: string;
  onClose: () => void;
}

/**
 * Prévia lateral aberta pela lista.
 *
 * Renderiza exatamente o mesmo CaseDetail da tela cheia: antes existiam
 * duas implementações diferentes e a do drawer era só maquete — as abas
 * de histórico, checklist, notas e anexos não recebiam o caso e mostravam
 * conteúdo fixo para todo mundo.
 */
export default function CaseDrawer({
  open,
  caseId,
  onClose,
}: Props) {

  const { cases } = useCases();

  const data = cases.find((item) => item.id === caseId);

  useEffect(() => {

    if (!open) return;

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };

  }, [open, onClose]);

  if (!open || !data) return null;

  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/40"
      />

      <aside className="fixed right-0 top-0 z-50 flex h-screen w-[860px] max-w-full flex-col bg-white shadow-2xl">

        <div className="flex items-center justify-between border-b border-zinc-200/80 px-6 py-3">

          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
            Prévia da reclamação
          </p>

          <button
            onClick={onClose}
            title="Fechar (Esc)"
            className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
          >
            <X size={17} />
          </button>

        </div>

        <div className="flex-1 overflow-y-auto">

          <CaseDetail data={data} variant="drawer" />

        </div>

      </aside>
    </>
  );
}
