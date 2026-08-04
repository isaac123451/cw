"use client";

import { useMemo, useState } from "react";
import CaseRow from "./CaseRow";
import { Case } from "@/lib/models/case";

interface Props {
  cases: Case[];
}

export default function CasesTableClient({ cases }: Props) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const filtered = useMemo(() => {
    let result = cases;

    if (query) {
      const q = query.toLowerCase();
      result = result.filter((c) =>
        (c.company || "").toLowerCase().includes(q) ||
        (c.id || "").toLowerCase().includes(q)
      );
    }

    if (status) {
      result = result.filter((c) => c.status === status);
    }

    if (category) {
      result = result.filter((c) => c.category === category);
    }

    if (priority) {
      result = result.filter((c) => c.priority === priority);
    }

    return result;
  }, [cases, query, status, category, priority]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page]);

  return (
    <div>
      <div className="mb-6 flex gap-4">
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
          placeholder="Pesquisar empresa..."
          className="w-80 rounded-xl border px-4 py-3"
        />

        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="rounded-xl border px-4 py-3"
        >
          <option value="">Status</option>
          <option value="Novo">Novo</option>
          <option value="Em Atendimento">Em Atendimento</option>
          <option value="Aguardando Cliente">Aguardando Cliente</option>
          <option value="Aguardando Interno">Aguardando Interno</option>
          <option value="Resolvido">Resolvido</option>
        </select>

        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(1);
          }}
          className="rounded-xl border px-4 py-3"
        >
          <option value="">Categoria</option>
          <option value="Fiscal">Fiscal</option>
          <option value="Financeiro">Financeiro</option>
          <option value="Marketplace">Marketplace</option>
        </select>

        <select
          value={priority}
          onChange={(e) => {
            setPriority(e.target.value);
            setPage(1);
          }}
          className="rounded-xl border px-4 py-3"
        >
          <option value="">Prioridade</option>
          <option value="Crítica">Crítica</option>
          <option value="Alta">Alta</option>
          <option value="Média">Média</option>
          <option value="Baixa">Baixa</option>
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-left">
              <th className="px-6 py-5">ID</th>
              <th>Empresa</th>
              <th>Origem</th>
              <th>Categoria</th>
              <th>Prioridade</th>
              <th>Status</th>
              <th>Proprietário</th>
              <th>SLA</th>
            </tr>
          </thead>

          <tbody>
            {pageItems.map((item) => (
              <CaseRow key={item.id} data={item} />
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="text-sm text-zinc-500">
          {filtered.length} resultado(s)
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded border px-3 py-1 disabled:opacity-50"
          >
            Anterior
          </button>

          <div className="px-3">{page} / {totalPages}</div>

          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="rounded border px-3 py-1 disabled:opacity-50"
          >
            Próximo
          </button>
        </div>
      </div>
    </div>
  );
}
