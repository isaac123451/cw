"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Fragment, useEffect, useRef } from "react";

import { TELAS_DO_RA } from "@/core/navigation/moduloReclameAqui";

/**
 * Subnavegação do módulo: dá acesso direto às funcionalidades do RA.
 *
 * Uma fileira só (out/2026). Eram doze abas grandes que quebravam em duas
 * linhas e uma lista diferente da do menu lateral. Agora as telas vêm de
 * `TELAS_DO_RA` — a mesma do menu —, separadas por grupo (trabalhar,
 * acompanhar, ajustar), e a fileira rola de lado quando a tela é estreita
 * em vez de crescer para baixo. A ativa entra na vista sozinha, só de lado.
 */
export default function ModuleNav() {

  const pathname = usePathname();
  const fileira = useRef<HTMLDivElement>(null);

  /* A aba ativa entra na vista — só de lado, nunca rolando a página. */
  useEffect(() => {
    const caixa = fileira.current;
    const ativa = caixa?.querySelector<HTMLElement>("[aria-current=page]");
    if (!caixa || !ativa) return;
    const fora = ativa.offsetLeft + ativa.offsetWidth - (caixa.scrollLeft + caixa.clientWidth);
    if (fora > 0) caixa.scrollLeft += fora + 16;
    else if (ativa.offsetLeft < caixa.scrollLeft) caixa.scrollLeft = ativa.offsetLeft - 16;
  }, [pathname]);

  return (
    <nav aria-label="Telas do Reclame Aqui">

      <div ref={fileira} className="relative flex items-center gap-0.5 overflow-x-auto rounded-2xl border border-zinc-200/80 bg-white p-1 shadow-[0_1px_2px_rgba(16,24,40,0.04)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">

        {TELAS_DO_RA.map((item, i) => {

          const Icon = item.icon;

          const active =
            item.href === "/reclame-aqui"
              ? pathname === "/reclame-aqui"
              : pathname.startsWith(item.href);

          const novoGrupo = i > 0 && TELAS_DO_RA[i - 1].grupo !== item.grupo;

          return (
            <Fragment key={item.href}>
              {novoGrupo && <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-zinc-200" />}
              <Link
                href={item.href}
                data-tour={`modulo-${item.href.split("/").pop()}`}
                title={item.hint}
                aria-current={active ? "page" : undefined}
                className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-1.5 text-[13px] font-medium transition-colors ${
                  active
                    ? "bg-violet-700 text-white shadow-sm shadow-violet-700/25"
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                }`}
              >
                <Icon size={15} />
                {item.label}
              </Link>
            </Fragment>
          );
        })}

      </div>

    </nav>
  );
}
