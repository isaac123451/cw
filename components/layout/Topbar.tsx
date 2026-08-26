"use client";

import { usePathname } from "next/navigation";

import { Search } from "lucide-react";

import { menuItems } from "@/core/navigation/menu";
import UserMenu from "./UserMenu";
import NotificationsMenu from "./NotificationsMenu";
import { useSession } from "@/lib/context/SessionContext";
import ThemeToggle from "@/components/shared/ThemeToggle";

export default function Topbar() {

  const pathname = usePathname();

  const user = useSession();

  const current = menuItems.find(
    (item) =>
      pathname === item.href ||
      pathname.startsWith(`${item.href}/`)
  );

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-6 border-b border-zinc-200/80 bg-white/85 px-6 backdrop-blur-md lg:px-8">

      <div className="min-w-0">

        <p className="truncate text-sm font-semibold text-zinc-900">
          {current?.title ?? "CW Reputação"}
        </p>

        <p className="truncate text-xs text-zinc-500">
          Cardápio Web · Experiência do Cliente
        </p>

      </div>

      <div className="flex items-center gap-3">

        <div className="relative hidden md:block">

          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400"
            size={16}
          />

          <input
            className="h-10 w-64 rounded-xl border border-zinc-200 bg-zinc-50/80 pl-10 pr-4 text-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-violet-400 focus:bg-white"
            placeholder="Buscar na plataforma..."
          />

        </div>

        <ThemeToggle />

        <NotificationsMenu />

        <UserMenu
          name={user?.name ?? "Visitante"}
          email={user?.email ?? "modo demonstração"}
          authenticated={Boolean(user)}
          admin={user?.role === "ADMIN"}
        />

      </div>

    </header>
  );
}
