"use client";

import { useMemo, useState } from "react";

import { ChevronDown } from "lucide-react";

import type { NpsResponseView } from "@/lib/models/nps";
import { diaADiaDoNps } from "@/lib/models/diaADiaDoNps";
import { hojeNaOperacao } from "@/lib/services/reputation.service";
import { cn } from "@/lib/utils";

const ddmm = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;

/**
 * O dia a dia do NPS (09/11/2026), no molde do das Redes — ver
 * `lib/models/diaADiaDoNps.ts`. Recolhido, uma linha com o dia de hoje;
 * aberto, os últimos 14 dias.
 */
export default function DiaADiaDoNps({ respostas }: { respostas: NpsResponseView[] }) {
  const [aberto, setAberto] = useState(false);
  const [hoje] = useState(hojeNaOperacao);
  const linhas = useMemo(() => diaADiaDoNps(respostas, hoje, 14), [respostas, hoje]);
  const h = linhas[0];

  return (
    <section className="rounded-xl border border-zinc-200/80 bg-white">
      <button type="button" onClick={() => setAberto((v) => !v)} aria-expanded={aberto} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Dia a dia</span>
        <span className="min-w-0 flex-1 truncate text-sm text-zinc-700">
          Hoje: {h?.chegaram ?? 0} {h?.chegaram === 1 ? "pesquisa" : "pesquisas"} · {h?.contatados ?? 0} {h?.contatados === 1 ? "contatado" : "contatados"} · {h?.responderam ?? 0} {h?.responderam === 1 ? "respondeu" : "responderam"} · {h?.encerrados ?? 0} {h?.encerrados === 1 ? "encerrado" : "encerrados"}
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
                  <th className="px-2 py-2 text-right font-semibold" title="Pesquisas respondidas no Wootric no dia">Pesquisas</th>
                  <th className="px-2 py-2 text-right font-semibold" title="Das pesquisas do dia, as com nota de 0 a 6">Detratores</th>
                  <th className="px-2 py-2 text-right font-semibold" title="Ciclos com o primeiro contato feito no dia">Contatados</th>
                  <th className="px-2 py-2 text-right font-semibold" title="Ciclos em que o cliente respondeu ao contato no dia">Responderam</th>
                  <th className="py-2 pl-2 pr-3 text-right font-semibold" title="Ciclos encerrados no dia">Encerrados</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 tabular-nums">
                {linhas.map((l) => {
                  const parado = !l.chegaram && !l.contatados && !l.responderam && !l.encerrados;
                  return (
                    <tr key={l.dia} className={parado ? "text-zinc-400" : ""}>
                      <td className="py-1.5 pl-3 pr-2 whitespace-nowrap">
                        {ddmm(l.dia)}
                        {l.emCurso && <span className="ml-1.5 text-[11px] text-violet-700">em curso</span>}
                      </td>
                      <td className="px-2 py-1.5 text-right">{l.chegaram || "—"}</td>
                      <td className={cn("px-2 py-1.5 text-right", l.detratores > 0 && "text-rose-700")}>{l.detratores || "—"}</td>
                      <td className="px-2 py-1.5 text-right">{l.contatados || "—"}</td>
                      <td className="px-2 py-1.5 text-right">{l.responderam || "—"}</td>
                      <td className="py-1.5 pl-2 pr-3 text-right">{l.encerrados || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-zinc-500">
            Cada coluna conta pelo dia em que aconteceu: o contato e a resposta pelo dia do contato, não pelo da pesquisa.
          </p>
        </div>
      )}
    </section>
  );
}
