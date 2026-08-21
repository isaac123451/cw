"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useEffect, useRef } from "react";

import { menuItems } from "@/core/navigation/menu";
import BrandMark from "@/components/shared/BrandMark";
import { cn } from "@/lib/utils";

const SCROLL_KEY = "cw:sidebar-scroll";

export default function Sidebar() {
  const pathname = usePathname();

  const navRef = useRef<HTMLElement>(null);

  /**
   * A navegação remonta o menu a cada rota e o scroll voltava ao topo,
   * "subindo" a lista. Guardamos e restauramos a posição.
   */
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    const saved = sessionStorage.getItem(SCROLL_KEY);
    if (saved) nav.scrollTop = Number(saved);

    const onScroll = () =>
      sessionStorage.setItem(
        SCROLL_KEY,
        String(nav.scrollTop)
      );

    nav.addEventListener("scroll", onScroll, {
      passive: true,
    });

    return () =>
      nav.removeEventListener("scroll", onScroll);
  }, [pathname]);

  const groups = [
    ...new Set(menuItems.map((item) => item.group)),
  ];

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-zinc-200/80 bg-white">

      {/* Logo */}

      <div className="flex h-16 items-center border-b border-zinc-200/80 px-5">

        <Link
          href="/dashboard"
          className="flex items-center gap-2.5"
        >
          <BrandMark size={32} />

          <div className="leading-tight">

            <p className="text-sm font-semibold tracking-tight text-zinc-900">
              CW Reputação
            </p>

            <p className="text-[11px] text-zinc-500">
              Customer Experience
            </p>

          </div>

        </Link>

      </div>

      {/* Navegação */}

      <nav
        ref={navRef}
        className="flex-1 overflow-y-auto px-3 py-4"
      >

        {groups.map((group) => (

          <div key={group} className="mb-4 last:mb-0">

            <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
              {group}
            </p>

            <div className="space-y-0.5">

              {menuItems
                .filter((item) => item.group === group)
                .map((item) => {
                  const Icon = item.icon;

                  const active =
                    pathname === item.href ||
                    pathname.startsWith(`${item.href}/`);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                        active
                          ? "bg-violet-600 text-white shadow-sm shadow-violet-600/25"
                          : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                      )}
                    >
                      <Icon
                        size={17}
                        className={cn(
                          "shrink-0 transition-colors",
                          active
                            ? "text-white"
                            : "text-zinc-400 group-hover:text-zinc-600"
                        )}
                      />

                      <span className="truncate">{item.title}</span>
                    </Link>
                  );
                })}

            </div>

          </div>

        ))}

      </nav>

      {/* Rodapé */}

      <div className="border-t border-zinc-200/80 p-3">

        <div className="rounded-xl bg-gradient-to-br from-violet-50 to-zinc-50 p-4 ring-1 ring-inset ring-violet-100">

          <p className="text-xs font-semibold text-zinc-800">
            CW Reputação
          </p>

          <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
            Versão {process.env.NEXT_PUBLIC_VERSAO} · Cardápio Web
          </p>

        </div>

      </div>

    </aside>
  );
}
