"use client";

import { Fragment, useMemo } from "react";

import SurfaceCard from "@/components/shared/SurfaceCard";
import { abrirJanelaDeCasos } from "@/components/shared/JanelaDeCasos";

import type { Case } from "@/lib/models/case";
import { casosDoNumero, porCicloNoMes, type NumeroDoCiclo, type NumerosDoPeriodo } from "@/lib/models/porCiclo";
import { hojeNaOperacao, ptBR } from "@/lib/services/reputation.service";

const MES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const nomeDoMes = (aaaamm: string) => `${MES[Number(aaaamm.slice(5, 7)) - 1]} de ${aaaamm.slice(0, 4)}`;

const O_QUE_E: Record<NumeroDoCiclo, string> = {
  novas: "Reclamações que chegaram",
  respondidas: "Das que chegaram, as já respondidas",
  semResposta: "Das que chegaram, as ainda sem resposta",
  avaliadas: "Das que chegaram, as já avaliadas — mesmo avaliadas depois",
  resolvidas: "Das avaliadas, as que o consumidor marcou como resolvidas",
  voltaria: "Das avaliadas, as que voltariam a fazer negócio",
  respostas: "Respostas publicadas nestes dias, de qualquer reclamação — só informativo",
  avaliacoes: "Avaliações feitas nestes dias, de qualquer reclamação — só informativo",
};

/**
 * Por ciclo (1.86; reorganizado em 21/10/2026).
 *
 * Os ciclos agrupados no mês, com o total do mês em cima. À esquerda, o
 * que entra na conta: as reclamações que chegaram no ciclo, com a resposta
 * e a avaliação de cada uma (mesmo vindas depois). À direita, separado e
 * mais apagado, o movimento dos dias — respostas e avaliações feitas no
 * ciclo, de qualquer reclamação —, que é só para saber. Cada número abre
 * os casos na mini janela.
 */
export default function PorCiclo({ cases }: { cases: Case[] }) {
  const hoje = hojeNaOperacao();
  const meses = useMemo(() => porCicloNoMes(cases, hoje, 3), [cases, hoje]);

  const Numero = ({ n, qual, inicio, fim, rotulo, forte }: { n: number; qual: NumeroDoCiclo; inicio: string; fim: string; rotulo: string; forte?: boolean }) =>
    n > 0 ? (
      <button
        type="button"
        onClick={() => abrirJanelaDeCasos({ titulo: `${O_QUE_E[qual].split(" —")[0]} · ${rotulo}`, descricao: O_QUE_E[qual], casos: casosDoNumero(cases, inicio, fim, qual) })}
        className={`rounded px-1 tabular-nums hover:bg-violet-50 hover:text-violet-700 ${forte ? "font-semibold" : ""}`}
        title={`${O_QUE_E[qual]} — clique para ver os casos`}
      >
        {n}
      </button>
    ) : (
      <span className="px-1 text-zinc-300">0</span>
    );

  const Celulas = ({ d, inicio, fim, rotulo, forte }: { d: NumerosDoPeriodo; inicio: string; fim: string; rotulo: string; forte?: boolean }) => {
    const r = d.reclamacoes;
    const p = { inicio, fim, rotulo, forte };
    return (
      <>
        <td className="px-2 py-2 text-right"><Numero n={r.novas} qual="novas" {...p} /></td>
        <td className="px-2 py-2 text-right"><Numero n={r.respondidas} qual="respondidas" {...p} /></td>
        <td className="px-2 py-2 text-right"><Numero n={r.semResposta} qual="semResposta" {...p} /></td>
        <td className="px-2 py-2 text-right"><Numero n={r.avaliadas} qual="avaliadas" {...p} /></td>
        <td className={`px-2 py-2 text-right tabular-nums ${forte ? "font-semibold" : ""}`}>{r.notaMedia === null ? <span className="text-zinc-300">—</span> : ptBR(r.notaMedia, 2)}</td>
        <td className="px-2 py-2 text-right"><Numero n={r.resolvidas} qual="resolvidas" {...p} /></td>
        <td className="px-2 py-2 text-right"><Numero n={r.voltaria} qual="voltaria" {...p} /></td>
        <td className="border-l border-zinc-200 bg-zinc-50/70 px-2 py-2 text-right text-zinc-500"><Numero n={d.movimento.respostas} qual="respostas" {...p} /></td>
        <td className="bg-zinc-50/70 px-2 py-2 text-right text-zinc-500"><Numero n={d.movimento.avaliacoes} qual="avaliacoes" {...p} /></td>
        <td className="bg-zinc-50/70 py-2 pl-2 pr-3 text-right tabular-nums text-zinc-500">{d.movimento.notaMedia === null ? <span className="text-zinc-300">—</span> : ptBR(d.movimento.notaMedia, 2)}</td>
      </>
    );
  };

  return (
    <SurfaceCard
      title="Por ciclo"
      description="À esquerda, o que entra na nota: as reclamações que chegaram no ciclo, com a resposta e a avaliação de cada uma, mesmo vindas depois. À direita, só para saber: as respostas e avaliações feitas naqueles dias, de qualquer reclamação. Clique num número para ver os casos."
      hint="Ciclos de 7 dias: 1 a 7, 8 a 14, 15 a 21, 22 a 28 e 29 ao fim do mês. A linha do mês soma os ciclos dele (o mês corrente, até hoje)."
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wide">
              <th className="py-1.5 pr-3" />
              <th colSpan={7} className="px-2 py-1.5 text-left font-semibold text-zinc-600">
                Das reclamações do ciclo <span className="font-normal normal-case tracking-normal text-zinc-400">· entram na nota</span>
              </th>
              <th colSpan={3} className="border-l border-zinc-200 bg-zinc-50/70 px-2 py-1.5 text-left font-semibold text-zinc-400">
                Movimento no ciclo <span className="font-normal normal-case tracking-normal">· só informativo</span>
              </th>
            </tr>
            <tr className="border-b border-zinc-200 text-right text-[11px] text-zinc-400">
              <th className="py-1.5 pr-3 text-left font-medium">Ciclo</th>
              <th className="px-2 py-1.5 font-medium">Novas</th>
              <th className="px-2 py-1.5 font-medium">Respondidas</th>
              <th className="px-2 py-1.5 font-medium">Sem resposta</th>
              <th className="px-2 py-1.5 font-medium">Avaliadas</th>
              <th className="px-2 py-1.5 font-medium">Nota média</th>
              <th className="px-2 py-1.5 font-medium">Resolvidas</th>
              <th className="px-2 py-1.5 font-medium">Voltaria</th>
              <th className="border-l border-zinc-200 bg-zinc-50/70 px-2 py-1.5 font-medium">Respostas</th>
              <th className="bg-zinc-50/70 px-2 py-1.5 font-medium">Avaliações</th>
              <th className="bg-zinc-50/70 py-1.5 pl-2 pr-3 font-medium">Nota delas</th>
            </tr>
          </thead>
          <tbody>
            {meses.map((m, im) => {
              const fimDoMes = m.ciclos[0]?.ciclo.fim ?? `${m.mes}-31`;
              return (
                <Fragment key={m.mes}>
                  <tr className={`border-t border-zinc-200 bg-violet-50/40 text-zinc-900 ${im === 0 ? "border-t-0" : ""}`}>
                    <td className="py-2 pr-3 font-semibold capitalize">
                      {nomeDoMes(m.mes)}
                      {im === 0 && <span className="ml-1.5 text-[11px] font-normal normal-case text-violet-700">até hoje</span>}
                    </td>
                    <Celulas d={m} inicio={`${m.mes}-01`} fim={fimDoMes < hoje ? fimDoMes : hoje} rotulo={nomeDoMes(m.mes)} forte />
                  </tr>
                  {m.ciclos.map((l, i) => (
                    <tr key={l.ciclo.id} className="border-t border-zinc-100 text-zinc-700">
                      <td className="py-1.5 pl-4 pr-3 text-[13px] text-zinc-500">
                        {l.ciclo.rotulo}
                        {im === 0 && i === 0 && <span className="ml-1.5 text-[11px] text-violet-700">em curso</span>}
                      </td>
                      <Celulas d={l} inicio={l.ciclo.inicio} fim={l.ciclo.fim} rotulo={l.ciclo.rotulo} />
                    </tr>
                  ))}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </SurfaceCard>
  );
}
