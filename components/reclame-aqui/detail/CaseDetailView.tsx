"use client";

import Link from "next/link";

import { FileQuestion } from "lucide-react";

import { useCases } from "@/lib/context/CaseContext";

import CaseDetail from "./CaseDetail";

interface Props {
  id: string;
}

/**
 * Lê o caso do contexto (e não do mock direto) para que edições feitas
 * aqui e movimentações no Kanban fiquem em sincronia.
 */
export default function CaseDetailView({ id }: Props) {

  const { cases } = useCases();

  const data = cases.find((item) => item.id === id);

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-white py-20 text-center">

        <FileQuestion size={28} className="text-zinc-300" />

        <p className="mt-3 text-sm font-medium text-zinc-700">
          Reclamação não encontrada.
        </p>

        <p className="mt-1 text-sm text-zinc-500">
          O caso pode ter sido removido da base.
        </p>

        <Link
          href="/reclame-aqui"
          className="mt-5 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-800"
        >
          Voltar para Reclame Aqui
        </Link>

      </div>
    );
  }

  return <CaseDetail data={data} />;
}
