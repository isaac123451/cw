"use client";

import Link from "next/link";

import { useEffect, useMemo } from "react";

import { Check, Target } from "lucide-react";

import { useCases } from "@/lib/context/CaseContext";
import { useNps } from "@/lib/context/NpsContext";
import { useToast } from "@/lib/context/ToastContext";
import { useAgora } from "@/lib/hooks/useAgora";
import { metasDoDia } from "@/lib/models/motivacaoDoDia";

/**
 * As mini conquistas do Meu dia (Fase 36, 1.96).
 *
 * Metas do tamanho do dia, com a barra de cada uma — e, quando uma fecha,
 * um aviso discreto, uma vez por dia (o navegador guarda quais já
 * avisaram). Nada de medalha por clique: cada número é um fato do banco.
 */
export default function MetasDoDia({ rotina }: { rotina?: { feitas: number; total: number } }) {
  const { cases, loading: carregandoCasos } = useCases();
  const { responses, loading: carregandoNps } = useNps();
  const agora = useAgora();
  const { notify } = useToast();

  const metas = useMemo(
    () => (agora && !carregandoCasos && !carregandoNps ? metasDoDia({ casos: cases, nps: responses, rotina, agora }) : []),
    [agora, carregandoCasos, carregandoNps, cases, responses, rotina]
  );

  /* Meta batida vira aviso uma vez — o navegador guarda quais já avisaram hoje. */
  useEffect(() => {
    if (!agora || metas.length === 0) return;
    const chave = `cw-metas-batidas:${agora.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" })}`;
    let avisadas: string[] = [];
    try {
      avisadas = JSON.parse(localStorage.getItem(chave) ?? "[]");
    } catch {
      avisadas = [];
    }
    const novas = metas.filter((m) => m.feito >= m.alvo && !avisadas.includes(m.chave));
    if (novas.length === 0) return;
    for (const m of novas) notify({ tone: "success", title: "Meta do dia batida", detail: `${m.titulo}: ${m.feito} de ${m.alvo}.` });
    try {
      localStorage.setItem(chave, JSON.stringify([...avisadas, ...novas.map((m) => m.chave)]));
    } catch {
      /* Sem armazenamento: o aviso pode repetir ao recarregar, e só. */
    }
  }, [metas, agora, notify]);

  if (metas.length === 0) return null;

  const batidas = metas.filter((m) => m.feito >= m.alvo).length;

  return (
    <section aria-label="Metas de hoje" className="rounded-xl border border-zinc-200/80 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[13px] font-semibold text-zinc-900">
          <Target size={14} className="text-violet-600" />
          Metas de hoje
        </p>
        <span className="text-xs tabular-nums text-zinc-500">
          {batidas} de {metas.length} batidas
        </span>
      </div>
      <ul className="mt-2.5 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {metas.map((m) => {
          const pronta = m.feito >= m.alvo;
          return (
            <li key={m.chave}>
              <Link href={m.href} className="group block rounded-lg px-2 py-1.5 transition-colors hover:bg-zinc-50">
                <span className="flex items-center justify-between gap-2 text-xs">
                  <span className={`flex items-center gap-1 truncate ${pronta ? "font-medium text-emerald-700" : "text-zinc-700 group-hover:text-violet-700"}`}>
                    {pronta && <Check size={12} className="shrink-0" />}
                    {m.titulo}
                  </span>
                  <span className="shrink-0 tabular-nums text-zinc-500">
                    {m.feito}/{m.alvo}
                  </span>
                </span>
                <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-zinc-100">
                  <span className={`block h-full rounded-full transition-[width] ${pronta ? "bg-emerald-500" : "bg-violet-500"}`} style={{ width: `${Math.round((100 * m.feito) / m.alvo)}%` }} />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
