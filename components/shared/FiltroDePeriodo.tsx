"use client";

import { CalendarRange, X } from "lucide-react";

import { ATALHOS_DO_PERIODO, descreverIntervalo, type AtalhoDoPeriodo, type Intervalo } from "@/lib/models/periodo";

const data =
  "h-8 rounded-lg border border-zinc-200 bg-white px-2 text-xs text-zinc-700 outline-none transition-colors focus:border-violet-400";

/**
 * O período da tela: atalhos (este mês, 30 dias…) e o "de … até …".
 *
 * Uma linha só, no alto — o recorte vale para tudo o que vem embaixo,
 * então ele fica onde se lê primeiro, e diz em palavras o que está
 * valendo ("de 01/09 a 14/09/2026 · 212 respostas").
 */
export default function FiltroDePeriodo({
  atalho,
  personalizado,
  intervalo,
  total,
  rotuloDoTotal,
  onAtalho,
  onPersonalizado,
}: {
  atalho: AtalhoDoPeriodo;
  personalizado: Intervalo;
  intervalo: Intervalo;
  total: number;
  /** "resposta" / "respostas". */
  rotuloDoTotal: [string, string];
  onAtalho: (a: AtalhoDoPeriodo) => void;
  onPersonalizado: (i: Intervalo) => void;
}) {
  const botao = (ativo: boolean) =>
    `rounded-lg px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition-colors ${
      ativo ? "bg-violet-50 text-violet-700 ring-violet-200" : "text-zinc-600 ring-zinc-200 hover:bg-zinc-50"
    }`;

  return (
    <section aria-label="Período" className="flex flex-wrap items-center gap-2 rounded-2xl border border-zinc-200/80 bg-white px-3.5 py-2.5">
      <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
        <CalendarRange size={14} className="text-violet-600" /> Período
      </span>

      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Atalhos de período">
        {ATALHOS_DO_PERIODO.map((a) => (
          <button key={a.id} type="button" onClick={() => onAtalho(a.id)} aria-pressed={atalho === a.id} className={botao(atalho === a.id)}>
            {a.rotulo}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <label className="sr-only" htmlFor="periodo-de">
          De
        </label>
        <input
          id="periodo-de"
          type="date"
          value={atalho === "personalizado" ? personalizado.de ?? "" : intervalo.de ?? ""}
          onChange={(e) => onPersonalizado({ de: e.target.value || null, ate: atalho === "personalizado" ? personalizado.ate : intervalo.ate })}
          className={data}
        />
        <span className="text-xs text-zinc-400">até</span>
        <label className="sr-only" htmlFor="periodo-ate">
          Até
        </label>
        <input
          id="periodo-ate"
          type="date"
          value={atalho === "personalizado" ? personalizado.ate ?? "" : intervalo.ate ?? ""}
          onChange={(e) => onPersonalizado({ de: atalho === "personalizado" ? personalizado.de : intervalo.de, ate: e.target.value || null })}
          className={data}
        />
        {atalho !== "tudo" && (
          <button type="button" onClick={() => onAtalho("tudo")} aria-label="Limpar o período" title="Limpar o período" className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700">
            <X size={14} />
          </button>
        )}
      </div>

      <span className="ml-auto text-xs text-zinc-500">
        {descreverIntervalo(intervalo)} · <strong className="tabular-nums text-zinc-700">{total}</strong> {total === 1 ? rotuloDoTotal[0] : rotuloDoTotal[1]}
      </span>
    </section>
  );
}
