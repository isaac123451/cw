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
    <div className="flex-1 overflow-auto">

      <table className="min-w-full">

        <thead className="sticky top-0 z-10 bg-zinc-50/95 backdrop-blur">

          <tr className="border-b border-zinc-200">

            <th className="whitespace-nowrap px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-500">
              ID
            </th>

            <th className="whitespace-nowrap px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-500">
              Estabelecimento
            </th>

            <th className="whitespace-nowrap px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-500">
              Cliente
            </th>

            <th className="whitespace-nowrap px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-500">
              Categoria
            </th>

            <th className="whitespace-nowrap px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-500">
              Nota
            </th>

            <th className="whitespace-nowrap px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-500">
              Resolvido
            </th>

            <th className="whitespace-nowrap px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-500">
              Voltaria
            </th>

            <th className="whitespace-nowrap px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-500">
              Status
            </th>

            <th className="whitespace-nowrap px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-500">
              SLA
            </th>

            <th className="whitespace-nowrap px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-500">
              Responsável
            </th>

            <th className="whitespace-nowrap px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-500">
              Contato
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