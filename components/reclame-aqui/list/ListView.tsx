"use client";

import { useState } from "react";

import { Case } from "@/lib/models/case";

import { useScopedCases } from "@/lib/context/useScopedCases";

import CasesTable from "./CasesTable";
import CaseDrawer from "../drawer/CaseDrawer";

export default function ListView() {
  const { filteredCases } = useScopedCases("reclame-aqui");

  const [selectedCase, setSelectedCase] =
    useState<Case | null>(null);

  return (
    <>
      <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">

        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">

          <div>

            <h2 className="text-base font-semibold tracking-tight text-zinc-900">

              Lista de Reclamações

            </h2>

            <p className="mt-0.5 text-sm text-zinc-500">

              {filteredCases.length}{" "}
              {filteredCases.length === 1
                ? "reclamação encontrada"
                : "reclamações encontradas"}

            </p>

          </div>

        </div>

        {filteredCases.length === 0 ? (

          <p className="px-6 py-16 text-center text-sm text-zinc-400">
            Nenhuma reclamação corresponde aos filtros aplicados.
          </p>

        ) : (

          <CasesTable
            cases={filteredCases}
            onSelect={setSelectedCase}
          />

        )}

      </div>

      <CaseDrawer
        open={selectedCase !== null}
        data={selectedCase ?? undefined}
        onClose={() =>
          setSelectedCase(null)
        }
      />
    </>
  );
}