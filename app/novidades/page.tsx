"use client";

import Link from "next/link";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { ArrowUpRight, PlayCircle } from "lucide-react";

import MainLayout from "@/components/layout/MainLayout";
import PageHeading from "@/components/shared/PageHeading";

import { gravarLocal, lerLocal } from "@/lib/hooks/usePreferenciaLocal";
import {
  CHAVE_DA_VERSAO_VISTA,
  ERAS,
  FRENTES_DAS_NOVIDADES,
  NOVIDADES,
  eraDaVersao,
  filtrarNovidades,
  novasDesde,
  type FrenteDaNovidade,
} from "@/lib/models/novidades";
import { cn } from "@/lib/utils";

/**
 * Novidades de todas as versões (roadmap 2.0, Fase 13).
 *
 * Linha do tempo da mais nova para a mais antiga, com o filtro por frente,
 * o "novo" do que mudou desde a última visita de cada pessoa, o lugar de
 * cada coisa e, quando cabe, o tour que aponta a novidade na própria tela.
 *
 * O detalhe técnico — o que foi medido, os defeitos do caminho e as
 * provas — continua no ROADMAP.md do repositório.
 */

const VERSAO = process.env.NEXT_PUBLIC_VERSAO ?? "";

/*
  A versão vista **quando a página abriu**: gravar a atual logo em seguida
  apagaria o "novo" da própria visita. Fica guardada até a página sair.
*/
let vistaAoAbrir: string | null | undefined;
let esquecer: number | undefined;
const lerVistaAoAbrir = () => {
  if (vistaAoAbrir === undefined) vistaAoAbrir = lerLocal(CHAVE_DA_VERSAO_VISTA);
  return vistaAoAbrir;
};
const semOuvinte = () => () => {};

const dataCurta = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

export default function NovidadesPage() {

  const [frente, setFrente] = useState<FrenteDaNovidade | null>(null);

  const vista = useSyncExternalStore(semOuvinte, lerVistaAoAbrir, () => undefined);

  useEffect(() => {
    /*
      A saída esquece a versão guardada — mas só depois de um instante: em
      desenvolvimento o React desmonta e remonta na hora, e esquecer ali
      gravaria a versão atual como "vista" antes de a página mostrá-la.
    */
    window.clearTimeout(esquecer);
    lerVistaAoAbrir();
    if (VERSAO) gravarLocal(CHAVE_DA_VERSAO_VISTA, VERSAO);
    return () => {
      esquecer = window.setTimeout(() => {
        vistaAoAbrir = undefined;
      }, 0);
    };
  }, []);

  /* No servidor (vista indefinida) nada é marcado: o "novo" chega com a leitura do navegador. */
  const novas = useMemo(() => (vista === undefined ? new Set<string>() : novasDesde(NOVIDADES, vista)), [vista]);

  const contagem = useMemo(() => {
    const c = new Map<FrenteDaNovidade, number>();
    for (const n of NOVIDADES) for (const f of n.frentes) c.set(f, (c.get(f) ?? 0) + 1);
    return c;
  }, []);

  const lista = filtrarNovidades(NOVIDADES, frente);
  const nome = (id: FrenteDaNovidade) => FRENTES_DAS_NOVIDADES.find((f) => f.id === id)?.nome ?? id;

  return (
    <MainLayout>
      <div className="mx-auto max-w-4xl space-y-6">

        <PageHeading
          eyebrow="Conhecimento"
          title="Novidades"
          description="O que mudou em cada versão, onde fica e, quando cabe, um tour na própria tela."
        />

        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <div role="group" aria-label="Filtrar por frente" className="flex flex-wrap gap-1.5">
            <Chip ativo={frente === null} onClick={() => setFrente(null)} rotulo="Todas" numero={NOVIDADES.length} />
            {FRENTES_DAS_NOVIDADES.map((f) => (
              <Chip key={f.id} ativo={frente === f.id} onClick={() => setFrente(frente === f.id ? null : f.id)} rotulo={f.nome} numero={contagem.get(f.id) ?? 0} />
            ))}
          </div>
          {novas.size > 0 && (
            <p className="text-xs text-zinc-500 sm:ml-auto">
              <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-violet-500 align-middle" />
              {vista ? `${novas.size} desde a sua última visita (${vista})` : `${novas.size} desde a 1.0`}
            </p>
          )}
        </div>

        {ERAS.map((era) => {
          const itens = lista.filter((n) => eraDaVersao(n.versao) === era.id);
          if (itens.length === 0) return null;
          return (
            <section key={era.id} aria-labelledby={`era-${era.id}`}>
              <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                <h2 id={`era-${era.id}`} className="text-sm font-semibold text-zinc-900">{era.nome}</h2>
                <p className="text-xs text-zinc-500">{era.texto}</p>
              </div>

              <ol className="divide-y divide-zinc-100 rounded-xl border border-zinc-200/80 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
                {itens.map((n) => {
                  const nova = novas.has(n.versao);
                  return (
                    <li key={n.versao} className="grid gap-x-5 gap-y-1 px-5 py-4 sm:grid-cols-[84px_minmax(0,1fr)]">
                      <div className="flex items-baseline gap-2 sm:block">
                        <p className="font-mono text-xs font-medium text-zinc-700">{n.versao}</p>
                        <p className="text-[11px] tabular-nums text-zinc-400 sm:mt-0.5">{dataCurta(n.data)}</p>
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <h3 className="text-sm font-semibold text-zinc-900">{n.titulo}</h3>
                          {nova && <span className="rounded bg-violet-50 px-1.5 py-px text-[10.5px] font-semibold text-violet-700 ring-1 ring-inset ring-violet-100">novo</span>}
                        </div>
                        <p className="mt-1 text-sm leading-relaxed text-zinc-600">{n.texto}</p>

                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
                          <span className="text-zinc-400">{n.frentes.map(nome).join(" · ")}</span>
                          {n.tour && (
                            <Link href={`${n.tour.rota}?tour=${n.tour.id}`} className="flex items-center gap-1 font-medium text-zinc-700 hover:text-violet-700">
                              <PlayCircle size={13} /> Mostrar na tela
                            </Link>
                          )}
                          {n.href && (!n.tour || n.tour.rota !== n.href) && (
                            <Link href={n.href} className="flex items-center gap-0.5 font-medium text-zinc-700 hover:text-violet-700">
                              Onde fica <ArrowUpRight size={12} />
                            </Link>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          );
        })}

        <p className="text-xs text-zinc-500">
          As correções que não mudam a tela, e o detalhe de cada entrega — o que foi medido e as provas —, estão no ROADMAP.md do repositório.
        </p>
      </div>
    </MainLayout>
  );
}

function Chip({ ativo, onClick, rotulo, numero }: { ativo: boolean; onClick: () => void; rotulo: string; numero: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={cn(
        "flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors",
        ativo ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:text-zinc-900"
      )}
    >
      {rotulo}
      <span className={cn("tabular-nums", ativo ? "text-white/60" : "text-zinc-400")}>{numero}</span>
    </button>
  );
}
