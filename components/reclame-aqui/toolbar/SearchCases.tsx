"use client";

import { Search } from "lucide-react";

export default function SearchCases() {
  return (
    <div className="flex w-[520px] items-center rounded-xl border px-4">

      <Search
        size={18}
        className="text-zinc-400"
      />

      <input
        placeholder="Buscar protocolo, empresa, cliente ou reclamação..."
        className="h-12 w-full bg-transparent px-3 outline-none"
      />

    </div>
  );
}