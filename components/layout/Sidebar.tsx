"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useEffect, useRef, useState } from "react";

import { ChevronDown } from "lucide-react";

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

  /**
   * Qual módulo está com a cascata aberta.
   *
   * `null` significa "ninguém mexeu ainda", e aí quem abre é o módulo da
   * rota atual — chegar em /reclame-aqui/analytics já mostra as irmãs,
   * sem exigir um clique para descobrir que elas existem.
   *
   * String vazia é "fechei na mão", e é diferente de `null`: sem essa
   * distinção, fechar a cascata do módulo em que se está a reabriria
   * sozinha no render seguinte.
   */
  const [expandido, setExpandido] = useState<
    string | null
  >(null);

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

                  const aberto =
                    expandido === item.href ||
                    (expandido === null && active);

                  return (
                    <div key={item.href}>

                      <div
                        className={cn(
                          "group flex items-center rounded-xl transition-colors",
                          active
                            ? "bg-violet-600 text-white shadow-sm shadow-violet-600/25"
                            : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                        )}
                      >

                        <Link
                          href={item.href}
                          className="flex min-w-0 flex-1 items-center gap-3 py-2 pl-3 text-sm font-medium"
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

                          <span className="truncate">
                            {item.title}
                          </span>
                        </Link>

                        {/*
                          A setinha separa dois desejos.

                          Clicar no nome é "quero ir para o módulo" — e
                          continua funcionando como sempre. Clicar na
                          seta é "quero ver o que tem dentro", e só isso:
                          não navega. Juntar os dois num clique só faria
                          espiar o menu custar uma navegação.
                        */}
                        {item.children && (
                          <button
                            type="button"
                            aria-label={`${aberto ? "Recolher" : "Expandir"} ${item.title}`}
                            aria-expanded={aberto}
                            onClick={() =>
                              setExpandido(
                                aberto ? "" : item.href
                              )
                            }
                            className={cn(
                              "shrink-0 rounded-lg p-2 transition-colors",
                              active
                                ? "text-white/80 hover:bg-white/15 hover:text-white"
                                : "text-zinc-400 hover:bg-zinc-200/70 hover:text-zinc-700"
                            )}
                          >
                            <ChevronDown
                              size={14}
                              className={cn(
                                "transition-transform",
                                aberto ? "rotate-180" : ""
                              )}
                            />
                          </button>
                        )}

                      </div>

                      {item.children && aberto && (

                        <div className="mb-1 mt-0.5 space-y-0.5 border-l border-zinc-200 pl-3 ml-5">

                          {item.children.map((filho) => {

                            /*
                              O primeiro filho aponta para o próprio
                              módulo. Comparar por prefixo o marcaria
                              como ativo em todas as telas de dentro.
                            */
                            const ativoFilho =
                              filho.href === item.href
                                ? pathname === filho.href
                                : pathname.startsWith(
                                    filho.href
                                  );

                            return (
                              <Link
                                key={filho.href}
                                href={filho.href}
                                className={cn(
                                  "block truncate rounded-lg px-3 py-1.5 text-[13px] transition-colors",
                                  ativoFilho
                                    ? "bg-violet-50 font-medium text-violet-800"
                                    : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
                                )}
                              >
                                {filho.title}
                              </Link>
                            );
                          })}

                        </div>

                      )}

                    </div>
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
