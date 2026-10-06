"use client";

import { useEffect, useMemo, useState } from "react";

import { Loader2 } from "lucide-react";

import MainLayout from "@/components/layout/MainLayout";
import PageHeading from "@/components/shared/PageHeading";
import SurfaceCard from "@/components/shared/SurfaceCard";
import ModuleNav from "@/components/reclame-aqui/ModuleNav";
import AssuntosEmAlta from "@/components/reclame-aqui/plano/AssuntosEmAlta";
import MesDoPlano, { ResultadoDoMesFechado, STATUS } from "@/components/reclame-aqui/plano/MesDoPlano";
import MetasDoPlano from "@/components/reclame-aqui/plano/MetasDoPlano";
import PrevisaoDeReclamacoesCard from "@/components/reclame-aqui/plano/PrevisaoDeReclamacoes";
import { nota, num, pct } from "@/components/reclame-aqui/plano/formato";

import type { MetasGravadas } from "@/lib/actions/metasDoReclameAqui";
import { useScopedCases } from "@/lib/context/useScopedCases";
import { leitura } from "@/lib/lote";
import { calcularPremissas, ciclosDoMes, planoDoMes, planoNoInicioDoMes, resultadoDoMes, temMeta, testarProjecao } from "@/lib/models/planoDeAcao";
import { nomeDoMes, preverReclamacoes, somarMeses } from "@/lib/models/previsaoDeReclamacoes";
import { hojeNaOperacao } from "@/lib/services/reputation.service";

const lerMetas = leitura("metasDoReclameAqui");

/**
 * O plano de ação do Reclame Aqui (1.133).
 *
 * As metas por mês (gravadas), a previsão de reclamações, o que cada meta
 * exige no mês e nos próximos — com as margens e as metas de cada ciclo —,
 * os meses fechados contra a meta, e o que mais está chegando. A conta é
 * toda de `lib/models/planoDeAcao.ts`, provada no `check:plano`.
 */
export default function PlanoPage() {

  const { cases, loading } = useScopedCases("reclame-aqui");
  const hoje = hojeNaOperacao();
  const mesAtual = hoje.slice(0, 7);

  const [gravadas, setGravadas] = useState<MetasGravadas | null>(null);
  const [selecionado, setSelecionado] = useState(mesAtual);

  useEffect(() => {
    let vivo = true;
    lerMetas().then((g) => {
      if (vivo) setGravadas(g);
    });
    return () => {
      vivo = false;
    };
  }, []);

  const meses = useMemo(() => [0, 1, 2, 3, 4, 5].map((i) => somarMeses(mesAtual, i)), [mesAtual]);
  const fechados = useMemo(() => [-2, -1].map((i) => somarMeses(mesAtual, i)), [mesAtual]);
  const metas = useMemo(() => new Map((gravadas?.metas ?? []).map((m) => [m.mes, m])), [gravadas]);
  const manuais = useMemo(() => Object.fromEntries((gravadas?.metas ?? []).map((m) => [m.mes, m.recebidasPrevistas])), [gravadas]);

  const previsao = useMemo(() => preverReclamacoes(cases, hoje, 6, manuais), [cases, hoje, manuais]);
  const premissas = useMemo(() => calcularPremissas(cases, hoje), [cases, hoje]);
  const planos = useMemo(
    () => meses.map((m) => planoDoMes(cases, hoje, m, metas.get(m), previsao, premissas, m === mesAtual ? planoNoInicioDoMes(cases, m, metas.get(m)) : undefined)),
    [cases, hoje, meses, metas, previsao, premissas, mesAtual]
  );
  const resultados = useMemo(
    () => fechados.map((m) => ({ r: resultadoDoMes(cases, m, metas.get(m)), ciclos: ciclosDoMes(cases, hoje, m, planoNoInicioDoMes(cases, m, metas.get(m))) })),
    [cases, hoje, fechados, metas]
  );
  const teste = useMemo(() => (cases.length ? testarProjecao(cases, hoje) : null), [cases, hoje]);

  const planoAberto = planos.find((p) => p.mes === selecionado);
  const fechadoAberto = resultados.find((r) => r.r.mes === selecionado);

  return (
    <MainLayout>
      <div className="space-y-5">
        <PageHeading
          eyebrow="Reclame Aqui"
          title="Plano de ação"
          description="As metas de cada mês, quantas reclamações devem chegar, o que fazer — mês a mês e por ciclo — e o que mais está chegando. Tudo calculado com as reclamações da base."
        />

        <ModuleNav />

        {loading && cases.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-zinc-500">
            <Loader2 size={15} className="animate-spin" /> Carregando as reclamações…
          </p>
        ) : (
          <>
            {/* Os meses. */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8" role="tablist" aria-label="Mês do plano">
              {resultados.map(({ r }) => {
                const cumpridas = r.cumpridas.filter((c) => c.ok).length;
                return (
                  <button
                    key={r.mes}
                    type="button"
                    role="tab"
                    aria-selected={selecionado === r.mes}
                    onClick={() => setSelecionado(r.mes)}
                    className={`rounded-xl px-3 py-2 text-left ring-1 ring-inset transition-colors ${selecionado === r.mes ? "bg-violet-50 ring-violet-300" : "bg-white ring-zinc-200 hover:bg-zinc-50"}`}
                  >
                    <p className="text-xs font-medium capitalize text-zinc-500">{nomeDoMes(r.mes)} · fechado</p>
                    <p className="text-lg font-semibold tabular-nums text-zinc-900">{nota(r.resumo.raScoreExato)}</p>
                    <p className="text-[11px] text-zinc-500">{r.cumpridas.length ? `${cumpridas} de ${r.cumpridas.length} metas` : "sem meta"}</p>
                  </button>
                );
              })}
              {planos.map((p) => {
                const s = STATUS[p.status];
                return (
                  <button
                    key={p.mes}
                    type="button"
                    role="tab"
                    aria-selected={selecionado === p.mes}
                    onClick={() => setSelecionado(p.mes)}
                    className={`rounded-xl px-3 py-2 text-left ring-1 ring-inset transition-colors ${selecionado === p.mes ? "bg-violet-50 ring-violet-300" : "bg-white ring-zinc-200 hover:bg-zinc-50"}`}
                  >
                    <p className="text-xs font-medium capitalize text-zinc-500">
                      {nomeDoMes(p.mes)}
                      {p.mes === mesAtual ? " · agora" : ""}
                    </p>
                    <p className="text-lg font-semibold tabular-nums text-zinc-900">
                      {nota(p.projecao.resumo.raScoreExato)}
                      {p.meta?.nota != null && <span className="ml-1 text-xs font-normal text-zinc-400">/ {nota(p.meta.nota)}</span>}
                    </p>
                    <p className={`inline-flex items-center gap-1 rounded-full px-1.5 text-[11px] ring-1 ring-inset ${s.classe}`}>
                      <s.Icone size={11} /> {temMeta(p.meta) ? s.rotulo : `${p.projecao.doMes.esperadas} previstas no mês`}
                    </p>
                  </button>
                );
              })}
            </div>

            {planoAberto && <MesDoPlano plano={planoAberto} erroDaProjecao={teste?.erroMedio ?? null} hoje={hoje} />}
            {fechadoAberto && <ResultadoDoMesFechado r={fechadoAberto.r} ciclos={fechadoAberto.ciclos} />}

            <MetasDoPlano meses={meses} gravadas={gravadas} previsoes={previsao.proximos} aoGravar={setGravadas} />

            <PrevisaoDeReclamacoesCard previsao={previsao} />

            <div id="assuntos" className="scroll-mt-20">
              <AssuntosEmAlta casos={cases} hoje={hoje} />
            </div>

            <SurfaceCard title="Como o plano é calculado" description="As premissas vêm das reclamações da base e mudam quando elas mudam.">
              <div className="space-y-2 text-sm text-zinc-600">
                <p>
                  <b className="text-zinc-800">A meta de um mês</b> vale para a janela de 6 meses que fecha nele — a nota que o portal mostra no mês seguinte, a mesma “prévia” da tela Índice.
                </p>
                <p>
                  <b className="text-zinc-800">Se continuar como está:</b> as reclamações previstas chegam espalhadas pelos dias; cada reclamação em aberto tem a chance de ser respondida e avaliada até o fim do mês que a idade dela dá. Hoje: {pct(premissas.respondidaAte[6] * 100)} são respondidas em até 6 dias e {pct(premissas.respondidaAte[30] * 100)} em até 30; {pct(premissas.avaliadaAte[30] * 100)} são avaliadas em até 30 dias da abertura e {pct(premissas.avaliadaAte[180] * 100)} em até 6 meses. As novas avaliações vêm com a nota, a solução e o voltaria dos últimos 6 meses: {num(premissas.notaDasNovas, 2)}, {pct(premissas.solucaoDasNovas * 100)} e {pct(premissas.voltariaDasNovas * 100)} ({premissas.avaliacoesNaAmostra} avaliações).
                </p>
                <p>
                  <b className="text-zinc-800">O que a meta exige:</b> cada métrica vira número — respostas a fazer, avaliações a conseguir, quantas das novas podem vir não resolvidas ou sem “voltaria”, a nota mínima das novas — com o arredondamento do portal (89,96% conta como 90,0%). A nota de reputação é o que falta depois das métricas: primeiro as respostas que ainda cabem, depois avaliações nota 10, resolvidas e com “voltaria”.
                </p>
                <p>
                  <b className="text-zinc-800">Os ciclos:</b> o plano do mês repartido pelos dias de cada ciclo. No mês corrente e nos fechados, a meta do ciclo é a do plano como estava no 1º dia do mês — meta que muda todo dia não se verifica.
                </p>
                {teste && (
                  <p>
                    <b className="text-zinc-800">A projeção contra o que aconteceu:</b> o plano como estaria na véspera de cada mês, contra a nota do último dia dele —{" "}
                    {teste.meses.map((m) => `${nomeDoMes(m.mes).slice(0, 3)} ${nota(m.projetada)} × ${nota(m.real)}`).join(" · ")}. Erro médio: {teste.erroMedio !== null ? nota(teste.erroMedio) : "—"}.
                  </p>
                )}
              </div>
            </SurfaceCard>
          </>
        )}
      </div>
    </MainLayout>
  );
}
