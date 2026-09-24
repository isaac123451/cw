"use client";

import { useState } from "react";

import SurfaceCard from "@/components/shared/SurfaceCard";

import { FRENTES_DA_OPERACAO } from "@/lib/models/frentes";
import type { Regua } from "@/lib/models/catalogoDeCausas";

type Resultado = { ok: true; registros: number } | { ok: false; erro: string };

const pct = (parte: number, todo: number) => (todo ? `${Math.round((parte / todo) * 100)}%` : "—");

/**
 * A mesma régua nas quatro frentes (Fase 27).
 *
 * Por frente: quanto do que tem texto já está classificado, quanto usa
 * um nome fora do catálogo e quanto a sugestão pelo texto acerta —
 * medida tirando cada registro da base. Embaixo, os nomes fora do
 * catálogo, com o botão que leva os registros para a causa certa.
 */
export default function ReguaDasFrentes({ regua, causas, aoUnificar }: { regua: Regua; causas: string[]; aoUnificar: (de: string, para: string) => Promise<Resultado> }) {

  const [escolha, setEscolha] = useState<Record<string, string>>({});
  const [feitos, setFeitos] = useState<Record<string, string>>({});
  const [gravando, setGravando] = useState<string | null>(null);

  async function unificar(de: string, para?: string) {
    if (!para?.trim()) return;
    setGravando(de);
    const r = await aoUnificar(de, para);
    setGravando(null);
    setFeitos((atual) => ({ ...atual, [de]: r.ok ? `${r.registros} registro(s) agora em "${para}".` : r.erro }));
  }

  return (
    <SurfaceCard
      title="A mesma régua nas quatro frentes"
      description="O mesmo catálogo e a mesma sugestão pelo texto no Reclame Aqui, nas redes, no NPS e no Google."
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500">
              <th className="py-2 pr-3 font-medium">Frente</th>
              <th className="py-2 pr-3 text-right font-medium">Com texto</th>
              <th className="py-2 pr-3 text-right font-medium">Com causa</th>
              <th className="py-2 pr-3 text-right font-medium">Fora do catálogo</th>
              <th className="py-2 text-right font-medium">A sugestão acerta</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {FRENTES_DA_OPERACAO.map((f) => {
              const r = regua.porFrente[f.id];
              return (
                <tr key={f.id} className="border-b border-zinc-100">
                  <td className="py-2 pr-3">
                    <span className="inline-flex items-center gap-1.5 text-zinc-800">
                      <i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: f.cor }} />
                      {f.nome}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-right text-zinc-700">{r.total}</td>
                  <td className="py-2 pr-3 text-right text-zinc-700">
                    {r.comCausa} <span className="text-xs text-zinc-400">({pct(r.comCausa, r.total)})</span>
                  </td>
                  <td className={`py-2 pr-3 text-right ${r.foraDoCatalogo ? "text-amber-700" : "text-zinc-400"}`}>{r.foraDoCatalogo}</td>
                  <td className="py-2 text-right text-zinc-700">
                    {r.sugeridos ? (
                      <>
                        {pct(r.acertos, r.sugeridos)} <span className="text-xs text-zinc-400">({r.acertos} de {r.sugeridos})</span>
                      </>
                    ) : (
                      <span className="text-xs text-zinc-400">sem base ainda</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-zinc-500">
        A sugestão aparece embaixo do campo de causa raiz nas quatro frentes e aprende com cada classificação: o relato do Reclame Aqui ensina a sugestão do Google, o comentário do NPS a das redes.
      </p>

      {regua.foraDoCatalogo.length > 0 && (
        <div className="mt-4 border-t border-zinc-100 pt-3">
          <p className="text-sm font-medium text-zinc-800">Nomes fora do catálogo</p>
          <p className="text-xs text-zinc-500">Gravados antes da lista fechada ou com outra grafia — a mesma causa contada como duas.</p>
          <datalist id="causas-do-catalogo">
            {causas.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <ul className="mt-2 space-y-2">
            {regua.foraDoCatalogo.slice(0, 20).map((x) => (
              <li key={x.causa} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium text-zinc-800">“{x.causa}”</span>
                <span className="tabular-nums text-xs text-zinc-500">{x.registros} registro(s)</span>
                {feitos[x.causa] ? (
                  <span role="status" className="text-xs text-emerald-700">{feitos[x.causa]}</span>
                ) : (
                  <>
                    <label className="sr-only" htmlFor={`unificar-${x.causa}`}>Levar “{x.causa}” para</label>
                    <input
                      id={`unificar-${x.causa}`}
                      list="causas-do-catalogo"
                      value={escolha[x.causa] ?? x.noCatalogo ?? ""}
                      onChange={(e) => setEscolha((a) => ({ ...a, [x.causa]: e.target.value }))}
                      placeholder="levar para a causa…"
                      className="h-8 w-56 rounded-lg border border-zinc-200 bg-white px-2 text-xs"
                    />
                    <button
                      type="button"
                      disabled={gravando !== null || !(escolha[x.causa] ?? x.noCatalogo)}
                      onClick={() => void unificar(x.causa, escolha[x.causa] ?? x.noCatalogo)}
                      className="rounded-lg px-2 py-1 text-xs font-medium text-violet-700 ring-1 ring-inset ring-violet-200 hover:bg-violet-50 disabled:opacity-50"
                    >
                      {gravando === x.causa ? "Levando…" : "Unificar"}
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </SurfaceCard>
  );
}
