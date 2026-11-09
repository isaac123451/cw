"use client";

import { useMemo, useState } from "react";

import { ChevronDown } from "lucide-react";

import type { Case } from "@/lib/models/case";
import { diaADiaDasRedes } from "@/lib/models/diaADiaDasRedes";
import { hojeNaOperacao } from "@/lib/services/reputation.service";
import { cn } from "@/lib/utils";

const ddmm = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;

/**
 * O dia a dia das Redes (09/11/2026), no molde da tabela da Nota do Índice
 * do Reclame Aqui — ver `lib/models/diaADiaDasRedes.ts`. Recolhido, uma
 * linha com o dia de hoje; aberto, os últimos 14 dias.
 */
export default function DiaADiaDasRedes({ casos }: { casos: Case[] }) {
  const [aberto, setAberto] = useState(false);
  const [hoje] = useState(hojeNaOperacao);
  const linhas = useMemo(() => diaADiaDasRedes(casos, hoje, 14), [casos, hoje]);
  const deHoje = linhas[0];
  const fechadosHoje = deHoje ? deHoje.resolvidos + deHoje.outrosFechamentos : 0;

  return (
    <section className="rounded-xl border border-zinc-200/80 bg-white">
      <button type="button" onClick={() => setAberto((v) => !v)} aria-expanded={aberto} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Dia a dia</span>
        <span className="min-w-0 flex-1 truncate text-sm text-zinc-700">
          Hoje: {deHoje?.novos ?? 0} {deHoje?.novos === 1 ? "novo" : "novos"} · {deHoje?.primeiroContato ?? 0} com 1º contato · {fechadosHoje} {fechadosHoje === 1 ? "fechado" : "fechados"}
        </span>
        <ChevronDown size={15} className={cn("shrink-0 text-zinc-400 transition-transform", aberto && "rotate-180")} aria-hidden />
      </button>

      {aberto && (
        <div className="border-t border-zinc-100 px-4 pb-4 pt-3">
          <div className="max-h-[380px] overflow-auto rounded-xl ring-1 ring-inset ring-zinc-200">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="sticky top-0 z-[1] bg-zinc-50">
                <tr className="text-left text-[11px] uppercase tracking-wide text-zinc-400">
                  <th className="py-2 pl-3 pr-2 font-semibold">Dia</th>
                  <th className="px-2 py-2 text-right font-semibold" title="Atendimentos que chegaram no dia">Novos</th>
                  <th className="px-2 py-2 text-right font-semibold" title="Atendimentos que tiveram o primeiro contato no dia">1º contato</th>
                  <th className="px-2 py-2 text-right font-semibold" title="Fechados como Resolvido no dia">Resolvidos</th>
                  <th className="px-2 py-2 text-right font-semibold" title="Fechados sem contar como resolvidos: encaminhado, sem contato, sem identificação">Outros fechamentos</th>
                  <th className="py-2 pl-2 pr-3 text-right font-semibold" title="Novos menos fechados: positivo, a fila cresceu no dia">Saldo da fila</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 tabular-nums">
                {linhas.map((l) => {
                  const parado = l.novos === 0 && l.primeiroContato === 0 && l.resolvidos === 0 && l.outrosFechamentos === 0;
                  return (
                    <tr key={l.dia} className={parado ? "text-zinc-400" : ""}>
                      <td className="py-1.5 pl-3 pr-2 whitespace-nowrap">
                        {ddmm(l.dia)}
                        {l.emCurso && <span className="ml-1.5 text-[11px] text-violet-700">em curso</span>}
                      </td>
                      <td className="px-2 py-1.5 text-right">{l.novos || "—"}</td>
                      <td className="px-2 py-1.5 text-right">{l.primeiroContato || "—"}</td>
                      <td className="px-2 py-1.5 text-right">{l.resolvidos || "—"}</td>
                      <td className="px-2 py-1.5 text-right">{l.outrosFechamentos || "—"}</td>
                      <td className={cn("py-1.5 pl-2 pr-3 text-right", l.saldo > 0 ? "text-rose-700" : l.saldo < 0 ? "text-emerald-700" : "")}>
                        {l.saldo === 0 ? "—" : l.saldo > 0 ? `+${l.saldo}` : l.saldo}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-zinc-500">
            O dia do fechamento é gravado sempre desde 09/11. Antes disso, arrastar para uma coluna final no quadro não guardava o dia, e só aparecem os fechados pelo Encerrar.
          </p>
        </div>
      )}
    </section>
  );
}
