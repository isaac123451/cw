"use client";

import { Fragment, useMemo, useState } from "react";

import Link from "next/link";

import { ChevronDown, ChevronRight, TrendingDown, TrendingUp } from "lucide-react";

import SurfaceCard from "@/components/shared/SurfaceCard";

import { abaixoDaMeta, assuntosDoPeriodo, type LinhaDoAssunto, type Tendencia } from "@/lib/models/assuntosEmAlta";
import type { Case } from "@/lib/models/case";
import { cicloDe } from "@/lib/models/ciclo";
import { getRange } from "@/lib/services/reputation.service";

import { br, efeito, nota, num, pct } from "./formato";
import { pluralDe } from "@/lib/plural";

type Periodo = "30d" | "mes" | "ciclo";

const TENDENCIA: Record<Tendencia, { rotulo: string; classe: string }> = {
  alta: { rotulo: "em alta", classe: "text-rose-700" },
  novo: { rotulo: "novo", classe: "text-rose-700" },
  queda: { rotulo: "em queda", classe: "text-emerald-700" },
  estavel: { rotulo: "como de costume", classe: "text-zinc-500" },
};

const somar = (dia: string, n: number) => new Date(Date.parse(`${dia}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/**
 * O que mais está chegando como reclamação (1.133): cada assunto no período,
 * contra o de costume, com a tendência que não cabe no acaso e o peso de
 * cada um na nota de 6 meses.
 */
export default function AssuntosEmAlta({ casos, hoje }: { casos: Case[]; hoje: string }) {
  const [periodo, setPeriodo] = useState<Periodo>("30d");
  const [aberto, setAberto] = useState<string | null>(null);

  const intervalo = useMemo(() => {
    if (periodo === "30d") return { de: somar(hoje, -29), ate: hoje, rotulo: "nos últimos 30 dias" };
    if (periodo === "mes") return { de: `${hoje.slice(0, 7)}-01`, ate: hoje, rotulo: "neste mês" };
    const c = cicloDe(hoje);
    return { de: c.inicio, ate: hoje, rotulo: `neste ciclo (${c.rotulo})` };
  }, [periodo, hoje]);

  const a = useMemo(() => {
    const r = getRange("6m", "vigente");
    return assuntosDoPeriodo(casos, intervalo.de, intervalo.ate, { inicio: r.start, fim: r.end });
  }, [casos, intervalo]);

  const linhas = a.linhas.filter((l) => l.recente > 0 || l.esperado >= 0.5);

  return (
    <SurfaceCard
      title="O que mais está chegando"
      description={`Os assuntos das reclamações ${intervalo.rotulo} (${br(a.de)} a ${br(a.ate)}), contra o de costume — a média dos três períodos de mesmo tamanho antes (${br(a.base.de)} a ${br(a.base.ate)}). "Em alta" só quando a diferença não cabe no acaso.`}
      action={
        <div className="inline-flex rounded-xl bg-zinc-100 p-1" role="tablist" aria-label="Período">
          {([
            ["30d", "30 dias"],
            ["mes", "Mês"],
            ["ciclo", "Ciclo"],
          ] as const).map(([p, r]) => (
            <button key={p} type="button" role="tab" aria-selected={periodo === p} onClick={() => setPeriodo(p)} className={`rounded-lg px-3 py-1 text-sm font-medium ${periodo === p ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-800"}`}>
              {r}
            </button>
          ))}
        </div>
      }
    >
      <p className="mb-3 text-sm text-zinc-700">
        <b className="tabular-nums">{a.total}</b> {pluralDe(a.total, "reclamação", "reclamações")} {intervalo.rotulo}; de costume, <span className="tabular-nums">{num(a.totalEsperado)}</span>.
      </p>
      {a.emAlta.length > 0 && (
        <div className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800 ring-1 ring-inset ring-rose-200">
          <p className="flex items-center gap-1.5 font-medium">
            <TrendingUp size={15} /> Em alta
          </p>
          <ul className="mt-1 space-y-0.5">
            {a.emAlta.slice(0, 5).map((l) => (
              <li key={l.nome}>
                {l.nome}: {l.recente} {intervalo.rotulo}, de costume {num(l.esperado)}
                {l.tendencia === "alta" ? ` — a chance de ser acaso é de ${Math.max(1, Math.round(l.chance * 100))}%` : " — não chegava nenhuma"}.
              </li>
            ))}
          </ul>
        </div>
      )}
      {linhas.length === 0 ? (
        <p className="text-sm text-zinc-500">Nenhuma reclamação no período nem nos de antes.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-zinc-400">
                <th className="py-2 pr-3 font-semibold">Assunto</th>
                <th className="px-3 py-2 text-right font-semibold">Chegaram</th>
                <th className="px-3 py-2 text-right font-semibold">De costume</th>
                <th className="px-3 py-2 text-right font-semibold">Parte</th>
                <th className="px-3 py-2 font-semibold">Tendência</th>
                <th className="px-3 py-2 text-right font-semibold">Sem resposta</th>
                <th className="px-3 py-2 text-right font-semibold">Nota · solução (6m)</th>
                <th className="py-2 pl-3 text-right font-semibold">Peso na nota</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 tabular-nums">
              {linhas.map((l) => (
                <Fragment key={l.nome}>
                  <Linha l={l} aberto={aberto === l.nome} alternar={() => setAberto(aberto === l.nome ? null : l.nome)} />
                  {aberto === l.nome &&
                    l.subcategorias.map((s) => <Linha key={`${l.nome}-${s.nome}`} l={s} sub categoria={l.nome} />)}
                </Fragment>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-zinc-500">
            Peso na nota: quanto o assunto tira (−) ou soma (+) da nota de 6 meses — a nota sem as reclamações dele, comparada com a de hoje. Em âmbar, assunto com avaliações abaixo de alguma meta do selo. Clique num assunto para ver as subcategorias.
          </p>
        </div>
      )}
    </SurfaceCard>
  );
}

function Linha({ l, aberto, alternar, sub = false, categoria }: { l: LinhaDoAssunto; aberto?: boolean; alternar?: () => void; sub?: boolean; categoria?: string }) {
  const t = TENDENCIA[l.tendencia];
  const ruim = abaixoDaMeta(l);
  const href = sub ? `/reclame-aqui?categoria=${encodeURIComponent(categoria ?? "")}` : `/reclame-aqui?categoria=${encodeURIComponent(l.nome)}`;
  return (
    <tr className={sub ? "bg-zinc-50/60 text-zinc-600" : ""}>
      <td className={`py-2 pr-3 ${sub ? "pl-7" : ""}`}>
        {sub ? (
          <span>{l.nome}</span>
        ) : (
          <button type="button" onClick={alternar} className="inline-flex items-center gap-1 font-medium text-zinc-900 hover:text-violet-700" aria-expanded={aberto}>
            {aberto ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            {l.nome}
          </button>
        )}
      </td>
      <td className="px-3 py-2 text-right">
        <Link href={href} className="hover:underline">
          {l.recente}
        </Link>
      </td>
      <td className="px-3 py-2 text-right text-zinc-500">{num(l.esperado)}</td>
      <td className="px-3 py-2 text-right text-zinc-500">{sub ? "" : pct(l.parte)}</td>
      <td className={`px-3 py-2 text-xs font-medium ${t.classe}`}>
        <span className="inline-flex items-center gap-1">
          {l.tendencia === "alta" || l.tendencia === "novo" ? <TrendingUp size={12} /> : l.tendencia === "queda" ? <TrendingDown size={12} /> : null}
          {t.rotulo}
        </span>
      </td>
      <td className="px-3 py-2 text-right">{l.semResposta || "—"}</td>
      <td className={`px-3 py-2 text-right ${ruim ? "text-amber-700" : ""}`}>{l.nota !== null ? `${nota(l.nota)} · ${pct(l.solucao ?? 0)}` : "—"}</td>
      <td className="py-2 pl-3 text-right text-zinc-600">{l.pesoNaNota !== null && Math.abs(l.pesoNaNota) >= 0.005 ? efeito(-l.pesoNaNota, 2) : "—"}</td>
    </tr>
  );
}
