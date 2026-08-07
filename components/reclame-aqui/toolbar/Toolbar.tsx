"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import {
  BarChart3,
  LayoutGrid,
  Plus,
  Search,
  Settings2,
  Table,
  Upload,
  X,
} from "lucide-react";

import { useScopedCases } from "@/lib/context/useScopedCases";
import { useSettings } from "@/lib/context/SettingsContext";

import CreateCaseModal from "@/components/reclame-aqui/modals/CreateCaseModal";

interface Props {
  view: "kanban" | "list";
  onChangeView: (value: "kanban" | "list") => void;
}

const selectClass =
  "h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-700 outline-none transition-colors focus:border-violet-400";

export default function Toolbar({
  view,
  onChangeView,
}: Props) {
  const {
    cases,
    filteredCases,
    filters,
    setFilter,
    clearFilters,
  } = useScopedCases("reclame-aqui");

  const { tags } = useSettings();

  const companies = useMemo(
    () =>
      [...new Set(cases.map((c) => c.company))].sort(),
    [cases]
  );

  const status = useMemo(
    () =>
      [...new Set(cases.map((c) => c.status))].sort(),
    [cases]
  );

  const categories = useMemo(
    () =>
      [...new Set(cases.map((c) => c.category))].sort(),
    [cases]
  );

  const [createOpen, setCreateOpen] = useState(false);

  const hasFilters =
    filters.search !== "" ||
    filters.company !== "" ||
    filters.status !== "" ||
    filters.category !== "" ||
    filters.tag !== "";

  return (
    <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">

      <div className="flex flex-wrap items-center justify-between gap-4">

        <div className="flex flex-wrap items-center gap-2.5">

          <div className="relative">

            <Search
              size={16}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400"
            />

            <input
              value={filters.search}
              onChange={(e) =>
                setFilter("search", e.target.value)
              }
              placeholder="Buscar protocolo, cliente ou título..."
              className="h-10 w-72 rounded-xl border border-zinc-200 pl-10 pr-4 text-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-violet-400"
            />

          </div>

          <select
            value={filters.company}
            onChange={(e) =>
              setFilter("company", e.target.value)
            }
            className={selectClass}
          >
            <option value="">Todos os clientes</option>

            {companies.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <select
            value={filters.status}
            onChange={(e) =>
              setFilter("status", e.target.value)
            }
            className={selectClass}
          >
            <option value="">Todos Status</option>

            {status.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <select
            value={filters.category}
            onChange={(e) =>
              setFilter("category", e.target.value)
            }
            className={selectClass}
          >
            <option value="">Todas Categorias</option>

            {categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <select
            value={filters.tag}
            onChange={(e) =>
              setFilter("tag", e.target.value)
            }
            title="Filtrar por etiqueta operacional"
            className={selectClass}
          >
            <option value="">Todas Etiquetas</option>

            {tags
              .filter((item) => item.active)
              .map((item) => (
                <option key={item.id} value={item.name}>
                  {item.name}
                </option>
              ))}
          </select>

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
            >
              <X size={15} />
              Limpar
            </button>
          )}

        </div>

        <div className="flex items-center gap-2">

          <div className="flex items-center rounded-xl border border-zinc-200 p-1">

            <button
              onClick={() => onChangeView("kanban")}
              aria-label="Visualizar em Kanban"
              className={`rounded-lg p-2 transition-colors ${
                view === "kanban"
                  ? "bg-violet-600 text-white"
                  : "text-zinc-500 hover:bg-zinc-100"
              }`}
            >
              <LayoutGrid size={17} />
            </button>

            <button
              onClick={() => onChangeView("list")}
              aria-label="Visualizar em lista"
              className={`rounded-lg p-2 transition-colors ${
                view === "list"
                  ? "bg-violet-600 text-white"
                  : "text-zinc-500 hover:bg-zinc-100"
              }`}
            >
              <Table size={17} />
            </button>

          </div>

          <button className="flex h-10 items-center gap-2 rounded-xl border border-zinc-200 px-3.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50">
            <Upload size={16} />
            <span className="hidden lg:inline">Importar</span>
          </button>

          <Link
            href="/reclame-aqui/analytics"
            className="flex h-10 items-center gap-2 rounded-xl border border-zinc-200 px-3.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
          >
            <BarChart3 size={16} />
            <span className="hidden lg:inline">Analytics</span>
          </Link>

          <Link
            href="/reclame-aqui/configuracoes"
            className="flex h-10 items-center gap-2 rounded-xl border border-zinc-200 px-3.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
          >
            <Settings2 size={16} />
            <span className="hidden lg:inline">Fluxo</span>
          </Link>

          <button
            onClick={() => setCreateOpen(true)}
            className="flex h-10 items-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-violet-700"
          >
            <Plus size={16} />
            Nova Reclamação
          </button>

        </div>

      </div>

      {hasFilters && (
        <p className="mt-3 border-t border-zinc-100 pt-3 text-xs text-zinc-500">
          Exibindo{" "}
          <strong className="font-semibold text-zinc-700">
            {filteredCases.length}
          </strong>{" "}
          de {cases.length} reclamações.
        </p>
      )}

      <CreateCaseModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />

    </div>
  );
}
