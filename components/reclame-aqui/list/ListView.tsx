"use client";

import { useState } from "react";

import { Case } from "@/lib/models/case";

import { useCases } from "@/lib/context/CaseContext";

import CasesTable from "./CasesTable";
import CaseDrawer from "../drawer/CaseDrawer";

export default function ListView() {
  const { cases } = useCases();

  const [selectedCase, setSelectedCase] =
    useState<Case | null>(null);

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">

        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">

          <div>

            <h2 className="text-lg font-semibold">

              Lista de Reclamações

            </h2>

            <p className="text-sm text-zinc-500">

              {cases.length} reclamações encontradas

            </p>

          </div>

        </div>

        <CasesTable
          cases={cases}
          onSelect={setSelectedCase}
        />

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