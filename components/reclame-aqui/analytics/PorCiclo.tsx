"use client";

import { useMemo } from "react";

import SurfaceCard from "@/components/shared/SurfaceCard";

import type { Case } from "@/lib/models/case";
import { numerosPorCiclo } from "@/lib/models/porCiclo";
import { hojeNaOperacao, ptBR } from "@/lib/services/reputation.service";

/**
 * Por ciclo (1.86): quantas chegaram, quantas foram respondidas e quantas
 * avaliações vieram em cada ciclo de 7 dias — cada uma no dia em que
 * aconteceu. É o número que a planilha do ciclo pede.
 */
export default function PorCiclo({ cases }: { cases: Case[] }) {
  const hoje = hojeNaOperacao();
  const linhas = useMemo(() => numerosPorCiclo(cases, hoje, 8), [cases, hoje]);
  const maxAval = Math.max(1, ...linhas.map((l) => l.avaliadas));

  return (
    <SurfaceCard
      title="Por ciclo"
      description="Cada número no ciclo em que aconteceu: a reclamação no dia em que chegou, a resposta no dia em que foi publicada, a avaliação no dia em que veio."
      hint="Ciclos de 7 dias: 1 a 7, 8 a 14, 15 a 21, 22 a 28 e 29 ao fim do mês. Avaliação da carga antiga, sem data, não entra em ciclo nenhum."
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-zinc-400">
              <th className="py-2 pr-3 font-semibold">Ciclo</th>
              <th className="px-3 py-2 text-right font-semibold">Novas</th>
              <th className="px-3 py-2 text-right font-semibold">Respondidas</th>
              <th className="px-3 py-2 font-semibold">Avaliações</th>
              <th className="px-3 py-2 text-right font-semibold">Nota média</th>
              <th className="px-3 py-2 text-right font-semibold">Resolvidas</th>
              <th className="py-2 pl-3 text-right font-semibold">Voltaria</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 tabular-nums">
            {linhas.map((l, i) => (
              <tr key={l.ciclo.id}>
                <td className="py-2 pr-3 text-zinc-700">
                  {l.ciclo.rotulo}
                  {i === 0 && <span className="ml-1.5 text-[11px] text-violet-700">em curso</span>}
                </td>
                <td className="px-3 py-2 text-right">{l.novas}</td>
                <td className="px-3 py-2 text-right">{l.respondidas}</td>
                <td className="px-3 py-2">
                  <span className="flex items-center gap-2">
                    <span className="h-1.5 w-20 overflow-hidden rounded-full bg-zinc-100">
                      <span className="block h-full rounded-full bg-violet-500" style={{ width: `${(100 * l.avaliadas) / maxAval}%` }} />
                    </span>
                    {l.avaliadas}
                  </span>
                </td>
                <td className="px-3 py-2 text-right">{l.notaMedia === null ? "—" : ptBR(l.notaMedia, 2)}</td>
                <td className="px-3 py-2 text-right">{l.avaliadas ? l.resolvidas : "—"}</td>
                <td className="py-2 pl-3 text-right">{l.avaliadas ? l.voltaria : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SurfaceCard>
  );
}
