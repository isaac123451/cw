"use client";

import { LayoutGrid, Table } from "lucide-react";

interface Props {
  view: "kanban" | "list";
  onChange: (view: "kanban" | "list") => void;
}

export default function ViewSwitcher({
  view,
  onChange,
}: Props) {
  return (
    <div className="flex rounded-xl border bg-zinc-50 p-1">

      <button
        onClick={() => onChange("kanban")}
        className={`flex items-center gap-2 rounded-lg px-5 py-2 ${
          view === "kanban"
            ? "bg-violet-600 text-white"
            : ""
        }`}
      >
        <LayoutGrid size={18} />

        Kanban
      </button>

      <button
        onClick={() => onChange("list")}
        className={`flex items-center gap-2 rounded-lg px-5 py-2 ${
          view === "list"
            ? "bg-violet-600 text-white"
            : ""
        }`}
      >
        <Table size={18} />

        Lista
      </button>

    </div>
  );
}