"use client";

import Link from "next/link";

import { useMemo, useState } from "react";

import MainLayout from "@/components/layout/MainLayout";
import PageHeading from "@/components/shared/PageHeading";
import SurfaceCard from "@/components/shared/SurfaceCard";
import ModuleNav from "@/components/reclame-aqui/ModuleNav";
import EsperaAsReclamacoes from "@/components/reclame-aqui/EsperaAsReclamacoes";
import ChipPrioridade from "@/components/reclame-aqui/tratativa/ChipPrioridade";
import RelogioDoCaso from "@/components/reclame-aqui/tratativa/RelogioDoCaso";
import ProximoPasso from "@/components/reclame-aqui/tratativa/ProximoPasso";
import { useTratativa } from "@/components/reclame-aqui/tratativa/TratativaProvider";
import { idadeCurta } from "@/components/reclame-aqui/kanban/KanbanCard";

import { useScopedCases } from "@/lib/context/useScopedCases";
import { caseHref, isOpen } from "@/lib/services/case.service";
import type { Case } from "@/lib/models/case";

const ORDEM: Record<string, number> = { Urgente: 0, Alta: 1, Normal: 2 };

type Filtro = "todos" | "a-triar" | "sem-classificacao";

/**
 * Triagem e todos os casos em aberto (Fase 35, 1.95).
 *
 * "Investigação e triagem: juntar e simplificar; uma visão de todos os
 * casos em aberto." Uma linha por reclamação aberta — a triar primeiro,
 * depois pela criticidade e pela idade. Triar abre o diálogo que agora
 * decide criticidade e classificação (categoria, área, causa raiz) no
 * mesmo Salvar.
 */
export default function TriagemPage() {
  const { cases } = useScopedCases("reclame-aqui");
  const { abrirTriagem } = useTratativa();
  const [filtro, setFiltro] = useState<Filtro>("todos");

  const abertos = useMemo(
    () =>
      cases
        .filter(isOpen)
        .sort(
          (a, b) =>
            Number(Boolean(a.triadaEm)) - Number(Boolean(b.triadaEm)) ||
            (ORDEM[a.priority] ?? 3) - (ORDEM[b.priority] ?? 3) ||
            String(a.createdAt).localeCompare(String(b.createdAt))
        ),
    [cases]
  );

  const semClassificacao = (c: Case) => !c.category || !c.causaRaiz;
  const aTriar = abertos.filter((c) => !c.triadaEm).length;
  const semClasse = abertos.filter(semClassificacao).length;

  const lista = abertos.filter((c) => (filtro === "a-triar" ? !c.triadaEm : filtro === "sem-classificacao" ? semClassificacao(c) : true));

  return (
    <MainLayout>
      <div className="space-y-5">
        <PageHeading
          eyebrow="Reclame Aqui"
          title="Triagem"
          description="Todas as reclamações em aberto: a triar primeiro, depois pela criticidade e pela idade. Triar decide a criticidade e a classificação juntas."
        />

        <ModuleNav />

        <EsperaAsReclamacoes>

        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filtro">
          {(
            [
              ["todos", `Em aberto · ${abertos.length}`],
              ["a-triar", `A triar · ${aTriar}`],
              ["sem-classificacao", `Sem categoria ou causa · ${semClasse}`],
            ] as [Filtro, string][]
          ).map(([id, rotulo]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={filtro === id}
              onClick={() => setFiltro(id)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium ring-1 ring-inset transition-colors ${
                filtro === id ? "bg-violet-700 text-white ring-violet-700" : "text-zinc-600 ring-zinc-200 hover:bg-zinc-50"
              }`}
            >
              {rotulo}
            </button>
          ))}
        </div>

        <SurfaceCard>
          {lista.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-500">Nada aqui.</p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {lista.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2.5">
                  <ChipPrioridade item={c} />
                  <Link href={caseHref(c)} className="min-w-0 flex-1 basis-64 hover:text-violet-700">
                    <span className="block truncate text-sm font-medium text-zinc-800">{c.title}</span>
                    <span className="block truncate text-xs text-zinc-500">
                      {c.protocol} · {c.customer} · {idadeCurta(c.createdAt)}
                      {c.category ? ` · ${c.category}` : " · sem categoria"}
                      {c.causaRaiz ? ` · ${c.causaRaiz}` : ""}
                    </span>
                  </Link>
                  <span className="flex flex-wrap items-center gap-1">
                    <RelogioDoCaso item={c} esconderSemRegra />
                    <ProximoPasso item={c} className="max-w-[220px]" />
                  </span>
                  <button
                    type="button"
                    onClick={() => abrirTriagem(c)}
                    className={`shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium ring-1 ring-inset transition-colors ${
                      c.triadaEm ? "text-zinc-600 ring-zinc-200 hover:bg-zinc-50" : "bg-violet-700 text-white ring-violet-700 hover:bg-violet-800"
                    }`}
                  >
                    {c.triadaEm ? (semClassificacao(c) ? "Classificar" : "Refazer") : "Triar"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </SurfaceCard>
        </EsperaAsReclamacoes>

      </div>
    </MainLayout>
  );
}
