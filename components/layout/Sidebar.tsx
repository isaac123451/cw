"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { menuItems } from "@/core/navigation/menu";
import { cn } from "@/lib/utils";

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-72 flex-col border-r border-zinc-200 bg-white">

      {/* Logo */}

      <div className="border-b border-zinc-200 p-6">

        <Link
          href="/dashboard"
          className="flex items-center gap-3"
        >
          <img
            src="/logo.svg"
            alt="CW Reputação"
            className="h-10 w-auto"
          />

          <div>

            <h1 className="text-lg font-bold">
              CW Reputação
            </h1>

            <p className="text-xs text-zinc-500">
              Customer Experience
            </p>

          </div>

        </Link>

      </div>

      {/* Navegação */}

      <nav className="flex-1 space-y-2 p-4">

        {menuItems.map((item) => {
          const Icon = item.icon;

          const active =
            pathname === item.href ||
            pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all",
                active
                  ? "bg-violet-600 text-white shadow-md"
                  : "text-zinc-600 hover:bg-zinc-100"
              )}
            >
              <Icon size={20} />

              <span>{item.title}</span>
            </Link>
          );
        })}

      </nav>

      {/* Rodapé */}

      <div className="border-t border-zinc-200 p-4">

        <div className="rounded-xl bg-zinc-100 p-4">

          <p className="text-sm font-semibold">
            CW Reputação
          </p>

          <p className="mt-1 text-xs text-zinc-500">
            Versão 1.0.0
          </p>

        </div>

      </div>

    </aside>
  );
}