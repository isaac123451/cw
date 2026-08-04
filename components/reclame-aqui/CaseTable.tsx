"use client";

import CaseRow from "./CaseRow";

import { mockCases } from "@/lib/data/mockCases";

export default function CaseTable() {
  return (
    <div className="overflow-auto">

      <table className="w-full">

        <thead>

          <tr className="border-b bg-zinc-50 text-left text-sm">

            <th className="px-5 py-4">Protocolo</th>

            <th>Empresa</th>

            <th>Cliente</th>

            <th>Cidade</th>

            <th>UF</th>

            <th>Categoria</th>

            <th>Status</th>

            <th>Prioridade</th>

            <th>Nota</th>

            <th>Resolveu?</th>

            <th>Voltaria?</th>

            <th>Responsável</th>

            <th>SLA</th>

            <th>Atualizado</th>

          </tr>

        </thead>

        <tbody>

          {mockCases.map((item) => (

            <CaseRow
              key={item.id}
              data={item}
            />

          ))}

        </tbody>

      </table>

    </div>
  );
}