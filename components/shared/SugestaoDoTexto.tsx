"use client";

import { Sparkles } from "lucide-react";

/**
 * A sugestão pelo texto, como um chip: valor, o porquê e um "Usar".
 *
 * Usada onde uma classificação pode ser lida no relato — assunto do
 * Reclame Aqui, tipo e causa raiz do NPS. Nunca marca sozinha: é sempre
 * um clique de quem decide.
 */
export default function SugestaoDoTexto({
  valor,
  motivo,
  acerto,
  onUsar,
  rotulo = "Sugestão pelo relato",
}: {
  valor: string;
  motivo?: string;
  /** A taxa medida, quando já há base suficiente para dizer algo. */
  acerto?: { taxa: number; base: number } | null;
  onUsar: () => void;
  rotulo?: string;
}) {
  return (
    <div className="flex flex-wrap items-start gap-x-2.5 gap-y-1.5 rounded-lg border border-violet-200 bg-violet-50/60 px-3 py-2">
      <Sparkles size={14} className="mt-0.5 shrink-0 text-violet-600" />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-violet-900">
          <span className="text-violet-700">{rotulo}:</span> <strong className="font-semibold">{valor}</strong>
        </p>
        {(motivo || acerto) && (
          <p className="mt-0.5 text-[11px] leading-snug text-violet-700/80">
            {[motivo, acerto ? `acerto medido em ${(acerto.taxa * 100).toFixed(0)}% de ${acerto.base} caso(s) parecidos` : null].filter(Boolean).join(" · ")}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={onUsar}
        className="shrink-0 rounded-md bg-white px-2.5 py-1 text-xs font-medium text-violet-700 ring-1 ring-inset ring-violet-200 transition-colors hover:bg-violet-100"
      >
        Usar
      </button>
    </div>
  );
}
