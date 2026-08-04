"use client";

import {
  BarChart3,
  Filter,
  Plus,
  Settings2,
} from "lucide-react";

export default function ToolbarActions() {
  return (
    <div className="flex items-center gap-3">

      <button className="rounded-xl border px-4 py-2">

        <Filter
          size={18}
          className="mr-2 inline"
        />

        Mostrar resolvidos

      </button>

      <button className="rounded-xl border px-4 py-2">

        <Settings2
          size={18}
          className="mr-2 inline"
        />

        Configurar fluxo

      </button>

      <button className="rounded-xl border px-4 py-2">

        <BarChart3
          size={18}
          className="mr-2 inline"
        />

        Analytics

      </button>

      <button className="rounded-xl bg-violet-600 px-5 py-2 text-white">

        <Plus
          size={18}
          className="mr-2 inline"
        />

        Nova reclamação

      </button>

    </div>
  );
}