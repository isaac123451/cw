"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useEffect, useRef } from "react";

import { SECOES_DO_RA, secaoAberta, telaAberta } from "@/core/navigation/moduloReclameAqui";

/**
 * Subnavegação do módulo Reclame Aqui.
 *
 * Seis entradas em vez de treze telas (08/10/2026): "tem muita opção". Em
 * cima, os assuntos — Quadro, Avaliações, Respostas, Nota e metas, Análise,
 * Configurar. Embaixo, só quando a entrada aberta tem mais de uma tela, as
 * abas dela (em "Nota e metas": Índice, Plano de ação, Calculadora,
 * Prêmio). A lista vem de `SECOES_DO_RA`, a mesma do menu lateral.
 */
export default function ModuleNav() {

  const pathname = usePathname();
  const fileira = useRef<HTMLDivElement>(null);
  const aberta = secaoAberta(pathname);

  /* A entrada ativa entra na vista — só de lado, nunca rolando a página. */
  useEffect(() => {
    const caixa = fileira.current;
    const ativa = caixa?.querySelector<HTMLElement>("[aria-current=page]");
    if (!caixa || !ativa) return;
    const fora = ativa.offsetLeft + ativa.offsetWidth - (caixa.scrollLeft + caixa.clientWidth);
    if (fora > 0) caixa.scrollLeft += fora + 16;
    else if (ativa.offsetLeft < caixa.scrollLeft) caixa.scrollLeft = ativa.offsetLeft - 16;
  }, [pathname]);

  return (
    <nav aria-label="Telas do Reclame Aqui" className="space-y-2">

      <div ref={fileira} className="relative flex items-center gap-0.5 overflow-x-auto rounded-2xl border border-zinc-200/80 bg-white p-1 shadow-[0_1px_2px_rgba(16,24,40,0.04)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {SECOES_DO_RA.map((secao) => {
          const Icon = secao.icon;
          const ativa = aberta === secao;
          return (
            <Link
              key={secao.href}
              href={secao.href}
              data-tour={`modulo-${secao.href.split("/").pop()}`}
              title={secao.hint}
              aria-current={ativa ? "page" : undefined}
              className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-1.5 text-[13px] font-medium transition-colors ${
                ativa ? "bg-violet-700 text-white shadow-sm shadow-violet-700/25" : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
              }`}
            >
              <Icon size={15} />
              {secao.label}
            </Link>
          );
        })}
      </div>

      {aberta && aberta.telas.length > 1 && (
        <div role="tablist" aria-label={aberta.label} className="flex flex-wrap items-center gap-1">
          {aberta.telas.map((t) => {
            const ativa = telaAberta(t.href, pathname);
            return (
              <Link
                key={t.href}
                href={t.href}
                role="tab"
                aria-selected={ativa}
                title={t.hint}
                className={`rounded-lg px-2.5 py-1 text-[12.5px] transition-colors ${
                  ativa ? "bg-violet-50 font-medium text-violet-800 ring-1 ring-inset ring-violet-200" : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </div>
      )}

    </nav>
  );
}
