"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  BarChart3,
  Calculator,
  LayoutGrid,
  LineChart,
  LucideIcon,
  Settings2,
} from "lucide-react";

interface Item {
  label: string;
  href: string;
  icon: LucideIcon;
  hint: string;
}

const items: Item[] = [
  {
    label: "Quadro",
    href: "/reclame-aqui",
    icon: LayoutGrid,
    hint: "Kanban e lista das reclamações",
  },
  {
    label: "Analytics",
    href: "/reclame-aqui/analytics",
    icon: BarChart3,
    hint: "Nota RA, indicadores e diagnóstico",
  },
  {
    label: "Gráficos",
    href: "/reclame-aqui/graficos",
    icon: LineChart,
    hint: "Índices por mês, janela móvel e série diária",
  },
  {
    label: "Calculadora",
    href: "/reclame-aqui/calculadora",
    icon: Calculator,
    hint: "Simule a reputação do período atual ou do próximo",
  },
  {
    label: "Configurar fluxo",
    href: "/reclame-aqui/configuracoes",
    icon: Settings2,
    hint: "Status, categorias, times, tags e checklist",
  },
];

/** Subnavegação do módulo: dá acesso direto às funcionalidades do RA. */
export default function ModuleNav() {

  const pathname = usePathname();

  return (
    <nav className="overflow-x-auto">

      <div className="flex min-w-max items-center gap-1 rounded-2xl border border-zinc-200/80 bg-white p-1.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">

        {items.map((item) => {

          const Icon = item.icon;

          const active =
            item.href === "/reclame-aqui"
              ? pathname === "/reclame-aqui"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.hint}
              className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-violet-700 text-white shadow-sm shadow-violet-700/25"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
              }`}
            >

              <Icon size={16} />

              {item.label}

            </Link>
          );
        })}

      </div>

    </nav>
  );
}
