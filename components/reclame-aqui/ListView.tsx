"use client";

import CaseTable from "./CaseTable";

export default function ListView() {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white">

      <div className="flex items-center justify-between border-b p-6">

        <div>

          <h2 className="text-xl font-semibold">
            Lista de Reclamações
          </h2>

          <p className="mt-1 text-sm text-zinc-500">
            Visualize e gerencie todos os casos do Reclame Aqui.
          </p>

        </div>

      </div>

      <CaseTable />

    </div>
  );
}