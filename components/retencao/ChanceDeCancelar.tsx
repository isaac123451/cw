"use client";

import { useEffect, useState } from "react";

import { ShieldAlert } from "lucide-react";

import { lerRiscoDoCaso } from "@/lib/actions/retencao";
import { ROTULO_DO_NIVEL } from "@/lib/models/riscoDeCancelamento";
import type { ReclamacaoComRisco } from "@/lib/services/cancelamento.service";

const COR = {
  alto: "border-rose-200 bg-rose-50/70 text-rose-900",
  medio: "border-amber-200 bg-amber-50/70 text-amber-950",
  cancelou: "border-zinc-300 bg-zinc-50 text-zinc-900",
  baixo: "border-zinc-200 bg-white text-zinc-800",
} as const;

/**
 * A chance de cancelar na ficha do caso (1.113) — a mesma régua da aba de
 * retenção e do cartão da extensão (`lib/models/riscoDeCancelamento.ts`).
 * Só aparece de média para cima, ou quando o cliente já cancelou: o risco
 * baixo não ocupa a lateral.
 */
export default function ChanceDeCancelar({ caseId }: { caseId: string }) {
  const [dado, setDado] = useState<ReclamacaoComRisco | null>(null);

  useEffect(() => {
    let vivo = true;
    lerRiscoDoCaso(caseId).then((r) => vivo && setDado(r));
    return () => {
      vivo = false;
    };
  }, [caseId]);

  if (!dado || dado.risco.nivel === "baixo") return null;
  const { risco } = dado;

  return (
    <section className={`rounded-2xl border p-4 ${COR[risco.nivel]}`} aria-label="Chance de cancelar">
      <p className="flex items-center gap-1.5 text-sm font-semibold">
        <ShieldAlert size={15} />
        {ROTULO_DO_NIVEL[risco.nivel]}
      </p>
      <ul className="mt-1.5 space-y-0.5 text-xs">
        {risco.motivos.slice(0, 4).map((m) => (
          <li key={m.id}>
            {m.texto}
            {m.trecho && <span className="block truncate text-[11px] opacity-70">“{m.trecho}”</span>}
          </li>
        ))}
      </ul>
      {risco.atitudes.length > 0 && (
        <>
          <p className="mt-2.5 text-[11px] font-semibold uppercase tracking-wide opacity-70">{risco.nivel === "cancelou" ? "Recuperar" : "Reter"}</p>
          <ol className="mt-1 list-decimal space-y-1 pl-4 text-xs leading-relaxed">
            {risco.atitudes.slice(0, 4).map((a) => (
              <li key={a.id}>{a.texto}</li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}
