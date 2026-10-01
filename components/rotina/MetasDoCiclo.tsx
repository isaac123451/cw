"use client";

import Link from "next/link";

import { useMemo, useState } from "react";

import { CalendarRange, Check, SlidersHorizontal } from "lucide-react";

import EditorDeMetas from "@/components/rotina/EditorDeMetas";
import { useCases } from "@/lib/context/CaseContext";
import { useNps } from "@/lib/context/NpsContext";
import { useAgora } from "@/lib/hooks/useAgora";
import { useAjustesDeMeta } from "@/lib/hooks/useAjustesDeMeta";
import { metasDoCiclo } from "@/lib/models/metasDoCiclo";

/**
 * As metas do ciclo (1.114) — "precisa-se também de algo para o ciclo".
 * A mesma faixa das metas de hoje, para o ciclo da planilha (1–7, 8–14…),
 * com quanto falta e quantos dias restam. Ajustáveis só neste ciclo ou em
 * todos. A conta está em `lib/models/metasDoCiclo.ts`.
 */
export default function MetasDoCiclo() {
  const { cases, loading: carregandoCasos } = useCases();
  const { responses, loading: carregandoNps } = useNps();
  const agora = useAgora();
  const { ciclo: ajustes, recarregar } = useAjustesDeMeta();
  const [ajustando, setAjustando] = useState(false);

  const dados = useMemo(
    () => (agora && !carregandoCasos && !carregandoNps ? metasDoCiclo({ casos: cases, nps: responses, agora, ajustes }) : null),
    [agora, carregandoCasos, carregandoNps, cases, responses, ajustes]
  );

  if (!dados || dados.metas.length === 0) return null;

  const batidas = dados.metas.filter((m) => m.feito >= m.alvo).length;

  return (
    <section aria-label="Metas do ciclo" className="rounded-xl border border-zinc-200/80 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[13px] font-semibold text-zinc-900">
          <CalendarRange size={14} className="text-violet-600" />
          Metas do ciclo · {dados.ciclo.rotulo}
          <span className="font-normal text-zinc-500">· {dados.faltamDias === 1 ? "último dia" : `faltam ${dados.faltamDias} dias`}</span>
        </p>
        <span className="flex items-center gap-3 text-xs tabular-nums text-zinc-500">
          {batidas} de {dados.metas.length} batidas
          {!ajustando && (
            <button type="button" onClick={() => setAjustando(true)} className="flex items-center gap-1 font-medium text-zinc-500 hover:text-violet-700" title="Trocar o número das metas do ciclo">
              <SlidersHorizontal size={12} /> Ajustar
            </button>
          )}
        </span>
      </div>
      {ajustando && <EditorDeMetas escopo="ciclo" metas={dados.metas} onFechar={() => setAjustando(false)} onSalvo={recarregar} />}
      <ul className="mt-2.5 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {dados.metas.map((m) => {
          const pronta = m.feito >= m.alvo;
          return (
            <li key={m.chave}>
              <Link href={m.href} className="group block rounded-lg px-2 py-1.5 transition-colors hover:bg-zinc-50" title={m.origem === "automatico" ? m.porque : m.origem === "periodo" ? "Ajustado só para este ciclo" : "O seu número padrão para todo ciclo"}>
                <span className="flex items-center justify-between gap-2 text-xs">
                  <span className={`flex items-center gap-1 truncate ${pronta ? "font-medium text-emerald-700" : "text-zinc-700 group-hover:text-violet-700"}`}>
                    {pronta && <Check size={12} className="shrink-0" />}
                    {m.titulo}
                  </span>
                  <span className="shrink-0 tabular-nums text-zinc-500">
                    {m.feito}/{m.alvo}
                    {m.origem !== "automatico" && <span className="ml-0.5 text-violet-600">•</span>}
                  </span>
                </span>
                <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-zinc-100">
                  <span className={`block h-full rounded-full transition-[width] ${pronta ? "bg-emerald-500" : "bg-violet-500"}`} style={{ width: `${Math.min(100, Math.round((100 * m.feito) / m.alvo))}%` }} />
                </span>
                <span className="mt-0.5 block truncate text-[11px] text-zinc-400">{m.porque}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
