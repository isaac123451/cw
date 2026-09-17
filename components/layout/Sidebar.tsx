"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { ChevronDown, PanelLeftClose, PanelLeftOpen, Pin, PinOff } from "lucide-react";

import { GRUPOS_DO_MENU, itemDeConfiguracoes, menuItems, type MenuItem } from "@/core/navigation/menu";
import BrandMark from "@/components/shared/BrandMark";
import { cn } from "@/lib/utils";

import { useAgenda } from "@/lib/context/AgendaContext";
import { useCases } from "@/lib/context/CaseContext";
import { useNps } from "@/lib/context/NpsContext";
import { useSla } from "@/lib/context/SlaContext";
import { useAvaliacoesGoogle } from "@/lib/context/useAvaliacoesGoogle";
import { useAgora } from "@/lib/hooks/useAgora";
import { contadoresDoMenu, numeroCurto, type ContadorDoMenu } from "@/lib/models/contadoresDoMenu";

/**
 * O menu lateral (roadmap 2.0, Fase 11).
 *
 * Era uma lista de 25 itens em quatro grupos, com o ativo em roxo cheio.
 * O Isaac: "repaginada principalmente deste menu lateral", "pontos na
 * plataforma que não consigo achar". Agora:
 *
 * - **grupos pelo dia de trabalho** — Hoje, Frentes, Pessoas e contas,
 *   Inteligência, Conhecimento —, com Configurações no rodapé;
 * - **o número do que pede ação** ao lado de cada frente, com a conta da
 *   própria tela (ver `contadoresDoMenu`), vermelho só quando há atraso;
 * - **fixados**: qualquer item vai para o topo com o alfinete;
 * - **recolhido**: só ícones, para quem trabalha com a tela cheia de
 *   janelas. Fixados e recolhido ficam no navegador de cada um.
 */

const SCROLL_KEY = "cw:sidebar-scroll";
const FIXADOS_KEY = "cw:menu-fixados";
const RECOLHIDO_KEY = "cw:menu-recolhido";

/* Preferências do menu num armazenamento externo simples, lido sem efeito. */
const ouvintes = new Set<() => void>();
function lerLocal(chave: string) {
  try {
    return localStorage.getItem(chave);
  } catch {
    return null;
  }
}
function gravarLocal(chave: string, valor: string) {
  try {
    localStorage.setItem(chave, valor);
  } catch {
    /* Sem armazenamento, a escolha vale até fechar a aba. */
  }
  ouvintes.forEach((o) => o());
}
function usePreferenciaLocal(chave: string) {
  return useSyncExternalStore(
    (ouvir) => {
      ouvintes.add(ouvir);
      return () => ouvintes.delete(ouvir);
    },
    () => lerLocal(chave),
    () => null
  );
}

function useContadores(): Record<string, ContadorDoMenu> {
  const { cases } = useCases();
  const { responses } = useNps();
  const { tasks } = useAgenda();
  const { rules, expediente } = useSla();
  const { avaliacoes } = useAvaliacoesGoogle();
  const agora = useAgora();

  return useMemo(() => {
    if (!agora) return {};
    return contadoresDoMenu({
      casos: cases,
      nps: responses,
      googleAbertas: avaliacoes.filter((a) => a.status === "aberta").length,
      tarefas: tasks,
      regras: rules,
      expediente,
      agora,
    });
  }, [cases, responses, tasks, rules, expediente, avaliacoes, agora]);
}

export default function Sidebar({ forcarAberto = false }: { forcarAberto?: boolean }) {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);

  const fixadosBruto = usePreferenciaLocal(FIXADOS_KEY);
  const recolhidoBruto = usePreferenciaLocal(RECOLHIDO_KEY);
  const recolhido = !forcarAberto && recolhidoBruto === "1";

  const fixados = useMemo<string[]>(() => {
    try {
      const lista = JSON.parse(fixadosBruto ?? "[]");
      return Array.isArray(lista) ? lista.filter((h) => typeof h === "string") : [];
    } catch {
      return [];
    }
  }, [fixadosBruto]);

  const contadores = useContadores();

  /* A navegação remonta o menu a cada rota: a rolagem volta de onde estava. */
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const saved = sessionStorage.getItem(SCROLL_KEY);
    if (saved) nav.scrollTop = Number(saved);
    const onScroll = () => sessionStorage.setItem(SCROLL_KEY, String(nav.scrollTop));
    nav.addEventListener("scroll", onScroll, { passive: true });
    return () => nav.removeEventListener("scroll", onScroll);
  }, [pathname]);

  /*
    Qual cascata está aberta. `null` = ninguém mexeu, e abre a do módulo
    atual; "" = fechada à mão (sem isso, fechar a do módulo atual a
    reabriria sozinha no render seguinte).
  */
  const [expandido, setExpandido] = useState<string | null>(null);

  function alternarFixado(href: string) {
    const lista = fixados.includes(href) ? fixados.filter((h) => h !== href) : [...fixados, href];
    gravarLocal(FIXADOS_KEY, JSON.stringify(lista));
  }

  const ativo = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const itemFixados = fixados
    .map((href) => [...menuItems, itemDeConfiguracoes].find((m) => m.href === href))
    .filter((m): m is MenuItem => Boolean(m));

  /* Função que devolve JSX, e não componente: um componente declarado aqui dentro remontaria a cada render. */
  function linha(item: MenuItem, emFixados = false) {
    const Icon = item.icon;
    const eAtivo = ativo(item.href);
    const aberto = !recolhido && Boolean(item.children) && (expandido === item.href || (expandido === null && eAtivo));
    const contador = contadores[item.href];
    const mostraContador = contador && contador.valor > 0;
    const fixado = fixados.includes(item.href);

    return (
      <div key={`${emFixados ? "fixado:" : ""}${item.href}`}>
        <div
          className={cn(
            "group relative flex h-8 items-center rounded-md transition-colors",
            eAtivo ? "bg-white text-zinc-900 shadow-[0_1px_2px_rgba(16,24,40,0.06)] ring-1 ring-zinc-200/80" : "text-zinc-600 hover:bg-zinc-200/50 hover:text-zinc-900"
          )}
        >
          <Link
            href={item.href}
            title={recolhido ? `${item.title}${mostraContador ? ` · ${contador.explicacao}` : ""}` : undefined}
            className={cn("flex h-full min-w-0 flex-1 items-center gap-2.5 text-[13px]", recolhido ? "justify-center" : "pl-2.5", eAtivo && "font-medium")}
          >
            <span className="relative">
              <Icon size={16} strokeWidth={eAtivo ? 2.2 : 1.8} className={cn("shrink-0", eAtivo ? "text-violet-700" : "text-zinc-400 group-hover:text-zinc-600")} />
              {recolhido && mostraContador && (
                <span className={cn("absolute -right-1.5 -top-1 h-2 w-2 rounded-full ring-2 ring-zinc-50", contador.urgente ? "bg-rose-500" : "bg-violet-500")} />
              )}
            </span>
            {!recolhido && <span className="truncate">{item.title}</span>}
          </Link>

          {!recolhido && (
            <div className="flex items-center gap-0.5 pr-1">
              <button
                type="button"
                onClick={() => alternarFixado(item.href)}
                title={fixado ? "Tirar dos fixados" : "Fixar no topo do menu"}
                aria-label={fixado ? `Tirar ${item.title} dos fixados` : `Fixar ${item.title} no topo do menu`}
                /* Aparece ao passar o mouse ou ao chegar pelo teclado. */
                className="hidden rounded p-1 text-zinc-400 hover:bg-zinc-200/70 hover:text-zinc-700 focus-visible:block group-focus-within:block group-hover:block"
              >
                {fixado ? <PinOff size={12} /> : <Pin size={12} />}
              </button>

              {mostraContador && (
                <span
                  title={contador.explicacao}
                  className={cn(
                    "min-w-5 rounded px-1.5 text-center text-[11px] font-medium tabular-nums leading-5",
                    contador.urgente ? "bg-rose-50 text-rose-700" : "text-zinc-500"
                  )}
                >
                  {numeroCurto(contador.valor)}
                </span>
              )}

              {item.children && !emFixados && (
                <button
                  type="button"
                  aria-label={`${aberto ? "Recolher" : "Expandir"} ${item.title}`}
                  aria-expanded={aberto}
                  onClick={() => setExpandido(aberto ? "" : item.href)}
                  className="rounded p-1 text-zinc-400 hover:bg-zinc-200/70 hover:text-zinc-700"
                >
                  <ChevronDown size={13} className={cn("transition-transform", aberto && "rotate-180")} />
                </button>
              )}
            </div>
          )}
        </div>

        {item.children && aberto && !emFixados && (
          <div className="mb-1 ml-[18px] mt-0.5 space-y-px border-l border-zinc-200 pl-2.5">
            {item.children.map((filho) => {
              /* O primeiro filho é o próprio módulo: comparar por prefixo o marcaria em todas as telas de dentro. */
              const ativoFilho = filho.href === item.href ? pathname === filho.href : pathname.startsWith(filho.href);
              return (
                <Link
                  key={filho.href}
                  href={filho.href}
                  className={cn(
                    "block truncate rounded px-2 py-1 text-[12.5px] transition-colors",
                    ativoFilho ? "font-medium text-violet-800" : "text-zinc-500 hover:bg-zinc-200/50 hover:text-zinc-900"
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
  }

  return (
    <aside className={cn("flex h-screen shrink-0 flex-col border-r border-zinc-200/80 bg-zinc-50 transition-[width] duration-150", recolhido ? "w-[60px]" : "w-60")}>
      <div className={cn("flex h-16 items-center border-b border-zinc-200/70", recolhido ? "justify-center" : "justify-between pl-4 pr-2")}>
        <Link href="/meu-dia" className="flex min-w-0 items-center gap-2.5" title="CW Reputação">
          <BrandMark size={26} />
          {!recolhido && (
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-[13px] font-semibold tracking-tight text-zinc-900">CW Reputação</span>
              <span className="block truncate text-[11px] text-zinc-500">Cardápio Web</span>
            </span>
          )}
        </Link>
        {!recolhido && !forcarAberto && (
          <button
            type="button"
            onClick={() => gravarLocal(RECOLHIDO_KEY, "1")}
            title="Recolher o menu"
            aria-label="Recolher o menu"
            className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-200/60 hover:text-zinc-700"
          >
            <PanelLeftClose size={16} />
          </button>
        )}
      </div>

      <nav ref={navRef} aria-label="Menu principal" className={cn("rolagem-fina flex-1 overflow-y-auto py-3", recolhido ? "px-2" : "px-2.5")}>
        {itemFixados.length > 0 && (
          <div className="mb-3">
            {!recolhido && <p className="px-2.5 pb-1 text-[11px] font-medium text-zinc-400">Fixados</p>}
            <div className="space-y-px">
              {itemFixados.map((item) => (
                linha(item, true)
              ))}
            </div>
          </div>
        )}

        {GRUPOS_DO_MENU.map((grupo) => (
          <div key={grupo} className="mb-3 last:mb-0">
            {recolhido ? (
              <div className="mx-2 mb-2 border-t border-zinc-200/80 first:hidden" />
            ) : (
              <p className="px-2.5 pb-1 text-[11px] font-medium text-zinc-400">{grupo}</p>
            )}
            <div className="space-y-px">
              {menuItems
                .filter((item) => item.group === grupo)
                .map((item) => (
                  linha(item)
                ))}
            </div>
          </div>
        ))}
      </nav>

      <div className={cn("space-y-px border-t border-zinc-200/70 py-2", recolhido ? "px-2" : "px-2.5")}>
        {linha(itemDeConfiguracoes)}
        {recolhido ? (
          <button
            type="button"
            onClick={() => gravarLocal(RECOLHIDO_KEY, "0")}
            title="Abrir o menu"
            aria-label="Abrir o menu"
            className="flex h-8 w-full items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-200/50 hover:text-zinc-700"
          >
            <PanelLeftOpen size={16} />
          </button>
        ) : (
          <Link href="/novidades" title="O que mudou" className="block px-2.5 pt-1 text-[11px] text-zinc-400 hover:text-violet-700">
            Versão {process.env.NEXT_PUBLIC_VERSAO}
          </Link>
        )}
      </div>
    </aside>
  );
}
