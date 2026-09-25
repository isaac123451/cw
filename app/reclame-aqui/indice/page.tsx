"use client";

import { useMemo, useState } from "react";

import { Award, CheckCircle2, CircleAlert } from "lucide-react";

import MainLayout from "@/components/layout/MainLayout";
import PageHeading from "@/components/shared/PageHeading";
import SurfaceCard from "@/components/shared/SurfaceCard";
import ModuleNav from "@/components/reclame-aqui/ModuleNav";
import EvolucaoDoIndice from "@/components/reclame-aqui/indice/EvolucaoDoIndice";
import ReguaDoIndice from "@/components/reclame-aqui/indice/ReguaDoIndice";

import { useScopedCases } from "@/lib/context/useScopedCases";
import { evolucaoDoMes, notaExata, retratoDoIndice, type PeriodoDoIndice, type RetratoDoIndice } from "@/lib/models/indiceRA";
import { displayBand, hojeNaOperacao, ptBR, RA1000_MINIMO_DE_AVALIACOES, RA1000_TARGETS } from "@/lib/services/reputation.service";

const br = (iso: string) => iso.split("-").reverse().join("/");

/**
 * O índice do Reclame Aqui, como no HugMe (Fase 32, 1.75).
 *
 * O Isaac olhava o índice no HugMe porque aqui faltavam quatro coisas: a
 * nota que vem na virada do mês (a prévia), a nota sem arredondar, a
 * distância de cada indicador até o RA1000 e o dia a dia do mês. As
 * contas estão em `lib/models/indiceRA.ts`; esta tela só as mostra.
 */
export default function IndicePage() {

  const { cases } = useScopedCases("reclame-aqui");
  const [periodo, setPeriodo] = useState<PeriodoDoIndice>("6m");

  const hoje = hojeNaOperacao();
  const atual = useMemo(() => retratoDoIndice(cases, periodo, "vigente"), [cases, periodo]);
  const previa = useMemo(() => retratoDoIndice(cases, periodo, "proximo"), [cases, periodo]);
  const evolucao = useMemo(() => evolucaoDoMes(cases, periodo, hoje), [cases, periodo, hoje]);

  return (
    <MainLayout>
      <div className="space-y-5">

        <PageHeading
          eyebrow="Reclame Aqui"
          title="Índice"
          description="A nota pública de hoje, a que vem na virada do mês, a distância até o RA1000 e o dia a dia do mês — com a nota exata, sem arredondar."
        />

        <ModuleNav />

        <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Período">
          {(["6m", "12m"] as const).map((p) => (
            <button
              key={p}
              type="button"
              role="tab"
              aria-selected={periodo === p}
              onClick={() => setPeriodo(p)}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                periodo === p ? "bg-violet-700 text-white" : "text-zinc-600 ring-1 ring-inset ring-zinc-200 hover:bg-zinc-50"
              }`}
            >
              {p === "6m" ? "6 meses" : "12 meses"}
            </button>
          ))}
          <span className="text-xs text-zinc-500">6 meses é o período do selo; 12 meses aparece ao lado, no portal.</span>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <CartaoDaNota titulo="Atual" subtitulo={`Meses fechados · ${br(atual.inicio)} a ${br(atual.fim)}`} retrato={atual} />
          <CartaoDaNota
            titulo="Prévia"
            subtitulo={`Entra o mês corrente · ${br(previa.inicio)} a ${br(previa.fim)}`}
            retrato={previa}
            comparar={atual.resumo.raScoreExato}
          />
        </div>

        <SurfaceCard
          title="Régua até o RA1000"
          description="Onde a nota está entre as faixas do portal e o que falta, indicador por indicador, para a prévia ter o selo."
          hint="O selo pede nota 8 ou mais, as quatro metas (resposta 90%, nota do consumidor 7, solução 90%, voltaria 70%) e 50 avaliações no período."
        >
          <ReguaDoIndice atual={atual.resumo.raScoreExato} previa={previa.resumo.raScoreExato} />
          <OQueFalta retrato={previa} />
        </SurfaceCard>

        <SurfaceCard
          title="Evolução do mês"
          description="A nota exata no fim de cada dia do mês, com o que se sabia naquele dia — a resposta e a avaliação contam do dia em que aconteceram."
        >
          <EvolucaoDoIndice dias={evolucao} />
        </SurfaceCard>

      </div>
    </MainLayout>
  );
}

function CartaoDaNota({
  titulo,
  subtitulo,
  retrato,
  comparar,
}: {
  titulo: string;
  subtitulo: string;
  retrato: RetratoDoIndice;
  comparar?: number;
}) {
  const s = retrato.resumo;
  const faixa = displayBand(s);
  const delta = comparar === undefined ? null : s.raScoreExato - comparar;

  const indicadores = [
    { rotulo: "Resposta", valor: `${ptBR(s.responseIndex)}%`, ok: s.responseIndex >= RA1000_TARGETS.resposta, meta: `${RA1000_TARGETS.resposta}%` },
    { rotulo: "Nota do consumidor", valor: ptBR(s.consumerScore, 2), ok: s.consumerScore >= RA1000_TARGETS.consumidor, meta: String(RA1000_TARGETS.consumidor) },
    { rotulo: "Solução", valor: `${ptBR(s.solutionIndex)}%`, ok: s.solutionIndex >= RA1000_TARGETS.solucao, meta: `${RA1000_TARGETS.solucao}%` },
    { rotulo: "Voltaria", valor: `${ptBR(s.wouldReturnIndex)}%`, ok: s.wouldReturnIndex >= RA1000_TARGETS["novos-negocios"], meta: `${RA1000_TARGETS["novos-negocios"]}%` },
  ];

  return (
    <section className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{titulo}</p>
          <p className="mt-0.5 text-xs text-zinc-500">{subtitulo}</p>
        </div>
        <span
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset"
          style={{ color: faixa.color, borderColor: faixa.color, boxShadow: `inset 0 0 0 1px ${faixa.color}40` }}
        >
          {retrato.selo && <Award size={13} />}
          {faixa.label}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-x-3 gap-y-1">
        <span className="text-4xl font-semibold tabular-nums text-zinc-900">{ptBR(s.raScore)}</span>
        <span className="pb-1 font-mono text-sm tabular-nums text-zinc-500" title="A nota exata, sem arredondar">
          {notaExata(s.raScoreExato)}
        </span>
        {delta !== null && Math.abs(delta) >= 0.000005 && (
          <span className={`pb-1 text-xs font-medium tabular-nums ${delta > 0 ? "text-emerald-700" : "text-rose-700"}`}>
            {delta > 0 ? "+" : "−"}
            {notaExata(Math.abs(delta))} sobre a atual
          </span>
        )}
      </div>

      <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {indicadores.map((i) => (
          <li key={i.rotulo} className="rounded-xl bg-zinc-50 px-3 py-2">
            <p className="truncate text-[11px] text-zinc-500">{i.rotulo}</p>
            <p className="mt-0.5 flex items-center gap-1 text-sm font-semibold tabular-nums text-zinc-900">
              {i.valor}
              {i.ok ? <CheckCircle2 size={13} className="text-emerald-600" /> : <CircleAlert size={13} className="text-amber-600" />}
            </p>
            <p className="text-[10.5px] text-zinc-400">meta {i.meta}</p>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-xs text-zinc-500">
        {s.received} reclamações · {s.answered} respondidas · {s.evaluated} avaliadas
        {s.evaluated < RA1000_MINIMO_DE_AVALIACOES ? ` (o selo pede ${RA1000_MINIMO_DE_AVALIACOES})` : ""}
      </p>
    </section>
  );
}

function OQueFalta({ retrato }: { retrato: RetratoDoIndice }) {
  const { falta, resumo: s } = retrato;
  const itens: { texto: string; ok: boolean }[] = [
    {
      ok: falta.respostas === 0,
      texto: falta.respostas === 0 ? `Resposta em ${ptBR(s.responseIndex)}%: meta cumprida.` : `Responder mais ${falta.respostas} reclamação(ões) no portal: ${ptBR(s.responseIndex)}% → 90%.`,
    },
    {
      ok: falta.avaliacoesMinimas === 0,
      texto: falta.avaliacoesMinimas === 0 ? `${s.evaluated} avaliações: acima do mínimo de ${RA1000_MINIMO_DE_AVALIACOES}.` : `Mais ${falta.avaliacoesMinimas} avaliação(ões) para o mínimo de ${RA1000_MINIMO_DE_AVALIACOES}.`,
    },
    {
      ok: falta.avaliacoesIdeais.needed === 0 && falta.avaliacoesIdeais.reachable,
      texto:
        falta.avaliacoesIdeais.needed === 0 && falta.avaliacoesIdeais.reachable
          ? "Nota do consumidor, solução e voltaria: metas cumpridas."
          : falta.avaliacoesIdeais.reachable
            ? `Mais ${falta.avaliacoesIdeais.needed} avaliação(ões) nota 10, resolvidas e "voltaria" levam a nota do consumidor, a solução e o voltaria às metas.`
            : falta.avaliacoesIdeais.reason === "sem-avaliacoes"
              ? "As reclamações sem avaliação do período não bastam para as metas de avaliação — só o tempo traz mais."
              : "Mesmo com todas nota 10, as metas de avaliação não fecham neste período.",
    },
  ];

  return (
    <ul className="mt-4 space-y-1.5">
      {itens.map((i) => (
        <li key={i.texto} className="flex items-start gap-2 text-sm text-zinc-700">
          {i.ok ? <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-600" /> : <CircleAlert size={15} className="mt-0.5 shrink-0 text-amber-600" />}
          {i.texto}
        </li>
      ))}
    </ul>
  );
}
