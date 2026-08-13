"use client";

import { Loader2 } from "lucide-react";

/**
 * Espera da carga inicial.
 *
 * Sem isto, o intervalo entre montar a tela e o banco responder mostrava
 * "nenhuma reclamação encontrada" — parece erro, e não espera.
 */
export default function LoadingPanel({
  label = "Carregando reclamações...",
}: {
  label?: string;
}) {
  return (
    <div className="flex h-full min-h-64 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-zinc-200 bg-white/60">

      <Loader2
        size={22}
        className="animate-spin text-violet-500"
      />

      <p className="text-sm text-zinc-500">{label}</p>

    </div>
  );
}
