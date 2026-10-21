"use client";

import { useMemo } from "react";

import SurfaceCard from "@/components/shared/SurfaceCard";
import { abrirJanelaDeCasos } from "@/components/shared/JanelaDeCasos";

import { segmentOf, type NpsResponseView } from "@/lib/models/nps";
import { npsPorCiclo } from "@/lib/models/npsPorCiclo";
import { diaNaOperacao, hojeNaOperacao } from "@/lib/services/reputation.service";
import type { Ciclo } from "@/lib/models/ciclo";

const PLURAL: Record<string, string> = { Promotor: "Promotores", Passivo: "Passivos", Detrator: "Detratores" };

/**
 * O NPS por ciclo (1.90): respostas, a nota e o que a operação fez em cada
 * ciclo de 7 dias. Clicar num ciclo recorta a tela inteira nele.
 */
export default function NpsPorCiclo({
  respostas,
  ativo,
  aoEscolher,
}: {
  respostas: NpsResponseView[];
  ativo: string | null;
  aoEscolher: (inicio: string, fim: string) => void;
}) {
  const hoje = hojeNaOperacao();
  const linhas = useMemo(() => npsPorCiclo(respostas, hoje, 8), [respostas, hoje]);

  /* O número abre as respostas na mini janela (21/10/2026); a linha continua recortando a tela. */
  const abrir = (e: React.MouseEvent, ciclo: Ciclo, segmento?: string) => {
    e.stopPropagation();
    const lista = respostas
      .filter((r) => {
        const d = diaNaOperacao(r.respondedAt);
        return d >= ciclo.inicio && d <= ciclo.fim && (!segmento || segmentOf(r.score).label === segmento);
      })
      .sort((a, b) => b.respondedAt.localeCompare(a.respondedAt));
    abrirJanelaDeCasos({
      titulo: `${segmento ? PLURAL[segmento] : "Respostas"} · ${ciclo.rotulo}`,
      descricao: "Respostas do NPS que chegaram no ciclo — clique para abrir a ficha.",
      linhas: lista.map((r) => ({
        titulo: `Nota ${r.score} · ${r.customerName || r.customer}`,
        detalhe: [diaNaOperacao(r.respondedAt).split("-").reverse().join("/"), r.rootCause, r.status, r.comment.trim()].filter(Boolean).join(" · "),
        href: `/nps/${r.id}`,
      })),
    });
  };
  const Numero = ({ n, onClick }: { n: number; onClick: (e: React.MouseEvent) => void }) =>
    n > 0 ? (
      <button type="button" onClick={onClick} className="rounded px-0.5 hover:bg-violet-50 hover:text-violet-700" title="Ver as respostas">
        {n}
      </button>
    ) : (
      <span>{n}</span>
    );

  return (
    <SurfaceCard
      title="Por ciclo"
      description="Cada resposta no ciclo em que chegou; o 1º contato e o encerramento, no ciclo em que foram feitos. Clique num ciclo para ver a tela inteira dele."
      hint="Ciclos de 7 dias: 1 a 7, 8 a 14, 15 a 21, 22 a 28 e 29 ao fim do mês — os mesmos do relatório do ciclo. O encerramento em lote &quot;sem tratativa&quot; não conta como encerrado."
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-zinc-400">
              <th className="py-2 pr-3 font-semibold">Ciclo</th>
              <th className="px-3 py-2 text-right font-semibold">Respostas</th>
              <th className="px-3 py-2 text-right font-semibold">NPS</th>
              <th className="px-3 py-2 font-semibold">Promotores · passivos · detratores</th>
              <th className="px-3 py-2 text-right font-semibold">1º contato no prazo</th>
              <th className="py-2 pl-3 text-right font-semibold">Encerrados</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 tabular-nums">
            {linhas.map((l, i) => {
              const escolhido = ativo === l.ciclo.inicio;
              return (
                <tr
                  key={l.ciclo.id}
                  onClick={() => aoEscolher(l.ciclo.inicio, l.ciclo.fim)}
                  className={`cursor-pointer transition-colors hover:bg-zinc-50 ${escolhido ? "bg-violet-50/60" : ""}`}
                >
                  <td className="py-2 pr-3 text-zinc-700">
                    {l.ciclo.rotulo}
                    {i === 0 && <span className="ml-1.5 text-[11px] text-violet-700">em curso</span>}
                  </td>
                  <td className="px-3 py-2 text-right"><Numero n={l.respostas} onClick={(e) => abrir(e, l.ciclo)} /></td>
                  <td className={`px-3 py-2 text-right font-semibold ${l.nps === null ? "text-zinc-300" : l.nps >= 50 ? "text-emerald-700" : l.nps >= 0 ? "text-amber-700" : "text-rose-700"}`}>
                    {l.nps ?? "—"}
                  </td>
                  <td className="px-3 py-2">
                    {l.respostas ? (
                      <span className="flex items-center gap-2">
                        <span className="flex h-1.5 w-28 overflow-hidden rounded-full bg-zinc-100">
                          <span className="bg-emerald-500" style={{ width: `${(100 * l.promotores) / l.respostas}%` }} />
                          <span className="bg-amber-400" style={{ width: `${(100 * l.passivos) / l.respostas}%` }} />
                          <span className="bg-rose-500" style={{ width: `${(100 * l.detratores) / l.respostas}%` }} />
                        </span>
                        <span className="text-xs text-zinc-500">
                          <Numero n={l.promotores} onClick={(e) => abrir(e, l.ciclo, "Promotor")} /> · <Numero n={l.passivos} onClick={(e) => abrir(e, l.ciclo, "Passivo")} /> · <Numero n={l.detratores} onClick={(e) => abrir(e, l.ciclo, "Detrator")} />
                        </span>
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">{l.primeirosContatos ? `${l.noPrazo} de ${l.primeirosContatos}` : "—"}</td>
                  <td className="py-2 pl-3 text-right">{l.encerrados || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </SurfaceCard>
  );
}
