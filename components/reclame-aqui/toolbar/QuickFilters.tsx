"use client";

export default function QuickFilters() {
  return (
    <div className="flex flex-wrap gap-3">

      <select className="rounded-lg border px-4 py-2">
        <option>Todas empresas</option>
      </select>

      <select className="rounded-lg border px-4 py-2">
        <option>Status</option>
      </select>

      <select className="rounded-lg border px-4 py-2">
        <option>Categoria</option>
      </select>

      <select className="rounded-lg border px-4 py-2">
        <option>Responsável</option>
      </select>

      <select className="rounded-lg border px-4 py-2">
        <option>Prioridade</option>
      </select>

    </div>
  );
}