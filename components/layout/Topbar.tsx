"use client";

import { Bell, Search } from "lucide-react";

export default function Topbar() {
  return (
    <header className="sticky top-0 z-40 flex h-20 items-center justify-between border-b border-zinc-200 bg-white px-8">

      <div>

        <h2 className="text-2xl font-bold">
          Bom dia 👋
        </h2>

        <p className="text-zinc-500">
          Vamos cuidar da reputação da Cardápio Web.
        </p>

      </div>

      <div className="flex items-center gap-5">

        <div className="relative">

          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400"
            size={18}
          />

          <input
            className="w-80 rounded-2xl border border-zinc-200 bg-zinc-50 py-3 pl-12 outline-none focus:border-violet-400"
            placeholder="Pesquisar..."
          />

        </div>

        <button className="rounded-2xl border border-zinc-200 p-3 hover:bg-zinc-100">

          <Bell size={20} />

        </button>

      </div>

    </header>
  );
}