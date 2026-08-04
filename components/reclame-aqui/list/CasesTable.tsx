"use client";

import { Case } from "@/lib/models/case";

import CaseRow from "./CaseRow";

interface Props {
  cases: Case[];
  onSelect: (item: Case) => void;
}

export default function CasesTable({
  cases,
  onSelect,
}: Props) {
  return (
    <div className="overflow-auto">

      <table className="min-w-full">

        <thead className="sticky top-0 bg-zinc-50">

          <tr className="border-b border-zinc-200">

            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Protocolo
            </th>

            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Empresa
            </th>

            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Cliente
            </th>

            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Categoria
            </th>

            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Nota
            </th>

            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Resolvido
            </th>

            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Voltaria
            </th>

            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Status
            </th>

            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
              SLA
            </th>

            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Responsável
            </th>

          </tr>

        </thead>

        <tbody>

          {cases.map((item) => (

            <CaseRow
              key={item.id}
              data={item}
              onClick={() => onSelect(item)}
            />

          ))}

        </tbody>

      </table>

    </div>
  );
}