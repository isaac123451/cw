"use client";

import Link from "next/link";

import { useMemo, useState } from "react";

import { ArrowUp, FolderPlus, Loader2 } from "lucide-react";

import SurfaceCard from "@/components/shared/SurfaceCard";

import { abrirProjetoDeReincidencia } from "@/lib/actions/causaRaiz";
import { useAvaliacoesGoogle } from "@/lib/context/useAvaliacoesGoogle";
import { useCases } from "@/lib/context/CaseContext";
import { useNps } from "@/lib/context/NpsContext";
import { useProjects } from "@/lib/context/ProjectsContext";
import { useAgora } from "@/lib/hooks/useAgora";
import { acharCausa, rotuloDoPrazo } from "@/lib/models/catalogoDeCausas";
import {
  origemDaReincidencia,
  REINCIDENCIA_DIAS,
  REINCIDENCIA_MINIMA,
  reincidenciasCruzadas,
  semanaDasCausas,
  type RegistroDeCausa,
} from "@/lib/models/causaRaiz";
import { FRENTES_DA_OPERACAO } from "@/lib/models/frentes";
import { nomeDoCliente, type RootCauseOption } from "@/lib/models/nps";
import { isSocial } from "@/lib/services/case.service";

type Aberto = { ok: true; projeto: { id: string; title: string }; jaExistia: boolean; registros: number } | { ok: false; erro: string };

/**
 * A tendência que vira ação (Fase 27), com os dados das telas.
 */
export default function SemanaDasCausas() {
  const { cases } = useCases();
  const { responses, rootCauses } = useNps();
  const { avaliacoes } = useAvaliacoesGoogle();
  const { projects, recarregar } = useProjects();
  const agora = useAgora();

  const registros = useMemo(() => {
    const lista: RegistroDeCausa[] = [];
    for (const c of cases) {
      if (!c.causaRaiz?.trim()) continue;
      lista.push({ frente: isSocial(c) ? "redes" : "reclame-aqui", causa: c.causaRaiz, em: c.recebidaEm ?? `${c.createdAt}T12:00:00Z`, rotulo: `${c.id} — ${c.title}` });
    }
    for (const r of responses) if (r.rootCause?.trim()) lista.push({ frente: "nps", causa: r.rootCause, em: r.respondedAt, rotulo: `NPS — ${nomeDoCliente(r)}, nota ${r.score}` });
    for (const g of avaliacoes) if (g.causaRaiz?.trim() && g.status !== "denunciada") lista.push({ frente: "google", causa: g.causaRaiz, em: g.publicadaEm, rotulo: `Google — ${g.autor}, ${g.estrelas}★` });
    return lista;
  }, [cases, responses, avaliacoes]);

  if (!agora) return null;

  return (
    <VistaDaSemana
      registros={registros}
      agora={agora}
      catalogo={rootCauses}
      origensAbertas={projects.flatMap((p) => (p.origem ? [p.origem] : []))}
      aoAbrir={async (causa) => {
        const r = await abrirProjetoDeReincidencia({ causa });
        if (r.ok && !r.jaExistia) await recarregar();
        return r;
      }}
    />
  );
}

/**
 * A semana das causas: o top de cada frente, o que subiu e o que passou
 * do limite — com o item em Projetos que a rotina diária abre sozinha
 * para a causa que tem dono.
 */
export function VistaDaSemana({
  registros,
  agora,
  catalogo,
  origensAbertas,
  aoAbrir,
}: {
  registros: RegistroDeCausa[];
  agora: Date;
  catalogo: RootCauseOption[];
  origensAbertas: string[];
  aoAbrir: (causa: string) => Promise<Aberto>;
}) {
  const [abrindo, setAbrindo] = useState<string | null>(null);
  const [saida, setSaida] = useState<Record<string, string>>({});

  const { linhas, topPorFrente } = useMemo(() => semanaDasCausas(registros, agora), [registros, agora]);
  const subiram = linhas.filter((l) => l.subiu);
  const passaram = useMemo(() => reincidenciasCruzadas(registros, agora), [registros, agora]);

  async function abrir(causa: string) {
    setAbrindo(causa);
    const r = await aoAbrir(causa);
    setAbrindo(null);
    setSaida((s) => ({ ...s, [causa]: r.ok ? (r.jaExistia ? "O item deste mês já existe." : `Aberto: ${r.projeto.title}.`) : r.erro }));
  }

  return (
    <SurfaceCard
      title="A semana: o que subiu e o que vira ação"
      description="Os últimos 7 dias contra os 7 anteriores, por frente. A causa que passa do limite vira item em Projetos, com a área dona como responsável."
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {FRENTES_DA_OPERACAO.map((f) => (
          <div key={f.id} className="rounded-xl border border-zinc-200 px-3 py-2.5">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700">
              <i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: f.cor }} />
              {f.nome}
            </p>
            {topPorFrente[f.id].length ? (
              <ol className="mt-1.5 space-y-1 text-sm">
                {topPorFrente[f.id].map((t) => (
                  <li key={t.causa} className="flex items-baseline justify-between gap-2">
                    <span className="min-w-0 truncate text-zinc-800">{t.causa}</span>
                    <span className="shrink-0 tabular-nums text-xs text-zinc-500">{t.n}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-1.5 text-xs text-zinc-400">Nada classificado nesta semana.</p>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4">
        <p className="text-sm font-medium text-zinc-800">O que subiu</p>
        {subiram.length ? (
          <ul className="mt-1.5 space-y-1">
            {subiram.map((l) => (
              <li key={l.causa} className="flex flex-wrap items-baseline gap-x-2 text-sm">
                <ArrowUp size={13} className="self-center text-rose-600" />
                <span className="font-medium text-zinc-800">{l.causa}</span>
                <span className="tabular-nums text-zinc-600">
                  {l.estaSemana} nesta semana, {l.anterior} na anterior
                </span>
                <span className="text-xs text-zinc-400">
                  {FRENTES_DA_OPERACAO.filter((f) => l.porFrente[f.id]).map((f) => `${f.curto} ${l.porFrente[f.id]}`).join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-xs text-zinc-500">Nenhuma causa subiu 2 ou mais registros em relação à semana anterior.</p>
        )}
      </div>

      <div className="mt-4 border-t border-zinc-100 pt-3">
        <p className="text-sm font-medium text-zinc-800">
          Passou do limite — {REINCIDENCIA_MINIMA} ou mais em {REINCIDENCIA_DIAS} dias, somando as frentes
        </p>
        {passaram.length ? (
          <ul className="mt-2 space-y-2">
            {passaram.map((r) => {
              const causa = acharCausa(r.causa, catalogo);
              const aberto = origensAbertas.includes(origemDaReincidencia(r.causa, agora));
              return (
                <li key={r.causa} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-rose-50/60 px-3.5 py-2 ring-1 ring-inset ring-rose-100">
                  <span className="text-sm text-rose-950">
                    <strong className="font-semibold">{r.causa}</strong>: {r.registros.length} registros ·{" "}
                    {causa?.area ? (
                      <>
                        dono <strong className="font-medium">{causa.area}</strong> ({rotuloDoPrazo(causa.prazoHoras)})
                      </>
                    ) : (
                      <span className="text-amber-800">sem dono — defina a área da causa</span>
                    )}
                  </span>
                  <span className="flex items-center gap-2 text-xs">
                    {saida[r.causa] ? (
                      <span role="status" className="text-zinc-700">{saida[r.causa]}</span>
                    ) : aberto ? (
                      <Link href="/projetos" className="font-medium text-violet-700 hover:underline">
                        Item aberto em Projetos
                      </Link>
                    ) : (
                      <>
                        {causa?.area && <span className="text-rose-900/70">a rotina de amanhã cedo abre o item</span>}
                        <button
                          type="button"
                          disabled={abrindo !== null}
                          onClick={() => abrir(r.causa)}
                          className="flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 font-medium text-violet-700 ring-1 ring-inset ring-violet-200 hover:bg-violet-50 disabled:opacity-50"
                        >
                          {abrindo === r.causa ? <Loader2 size={12} className="animate-spin" /> : <FolderPlus size={12} />}
                          Abrir agora
                        </button>
                      </>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-1 text-xs text-zinc-500">Nenhuma causa passou do limite nos últimos {REINCIDENCIA_DIAS} dias.</p>
        )}
      </div>
    </SurfaceCard>
  );
}
