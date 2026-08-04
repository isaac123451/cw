"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import {
  Plus,
  Upload,
  Settings2,
  BarChart3,
  LayoutGrid,
  Table,
  Search,
} from "lucide-react";

import { useCases } from "@/lib/context/CaseContext";

interface Props {
  view: "kanban" | "list";
  onChangeView: (value: "kanban" | "list") => void;
}

export default function Toolbar({
  view,
  onChangeView,
}: Props) {
  const { cases } = useCases();

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

  const [search, setSearch] = useState("");

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">

      <div className="flex items-center justify-between gap-5">

        <div className="flex items-center gap-3">

          <div className="relative">

            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
            />

            <input
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
              placeholder="Pesquisar reclamação..."
              className="
                h-11
                w-80
                rounded-xl
                border
                border-zinc-200
                pl-10
                pr-4
                outline-none
                transition
                focus:border-violet-500
              "
            />

          </div>

          <select className="h-11 rounded-xl border border-zinc-200 px-4">

            <option>Todas Empresas</option>

            {companies.map((item) => (

              <option key={item}>
                {item}
              </option>

            ))}

          </select>

          <select className="h-11 rounded-xl border border-zinc-200 px-4">

            <option>Todos Status</option>

            {status.map((item) => (

              <option key={item}>
                {item}
              </option>

            ))}

          </select>

          <select className="h-11 rounded-xl border border-zinc-200 px-4">

            <option>Todas Categorias</option>

            {categories.map((item) => (

              <option key={item}>
                {item}
              </option>

            ))}

          </select>

        </div>

        <div className="flex items-center gap-2">

          <button
            onClick={() => onChangeView("kanban")}
            className={`rounded-xl p-3 transition ${
              view === "kanban"
                ? "bg-violet-600 text-white"
                : "border border-zinc-200 hover:bg-zinc-50"
            }`}
          >
            <LayoutGrid size={18} />
          </button>

          <button
            onClick={() => onChangeView("list")}
            className={`rounded-xl p-3 transition ${
              view === "list"
                ? "bg-violet-600 text-white"
                : "border border-zinc-200 hover:bg-zinc-50"
            }`}
          >
            <Table size={18} />
          </button>

          <button className="flex items-center gap-2 rounded-xl border border-zinc-200 px-4 py-3 transition hover:bg-zinc-50">

            <Upload size={18} />

            Importar

          </button>

          <Link
            href="/reclame-aqui/analytics"
            className="flex items-center gap-2 rounded-xl border border-zinc-200 px-4 py-3 transition hover:bg-zinc-50"
          >

            <BarChart3 size={18} />

            Analytics

          </Link>

          <Link
            href="/reclame-aqui/configuracoes"
            className="flex items-center gap-2 rounded-xl border border-zinc-200 px-4 py-3 transition hover:bg-zinc-50"
          >

            <Settings2 size={18} />

            Fluxo

          </Link>

          <button className="flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-3 font-medium text-white transition hover:bg-violet-700">

            <Plus size={18} />

            Nova Reclamação

          </button>

        </div>

      </div>

    </div>
  );
}