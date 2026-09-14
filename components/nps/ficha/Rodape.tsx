"use client";

import { Check, Loader2, TriangleAlert } from "lucide-react";

import { GhostButton } from "@/components/shared/Modal";

/** Cancelar e Salvar, com o estado de gravação — o rodapé de todo diálogo da ficha. */
export function RodapeDeSalvar({
  salvando,
  desabilitado,
  rotulo = "Salvar",
  onSalvar,
  onCancelar,
}: {
  salvando: boolean;
  desabilitado?: boolean;
  rotulo?: string;
  onSalvar: () => void;
  onCancelar: () => void;
}) {
  return (
    <>
      <GhostButton onClick={onCancelar}>Cancelar</GhostButton>
      <button
        type="button"
        onClick={onSalvar}
        disabled={salvando || desabilitado}
        className="flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-800 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400"
      >
        {salvando ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
        {salvando ? "Salvando…" : rotulo}
      </button>
    </>
  );
}

/** O erro que o servidor devolveu, dentro do diálogo — o que foi digitado fica. */
export function ErroDoServidor({ erro }: { erro: string | null }) {
  if (!erro) return null;
  return (
    <p className="mt-3 flex items-start gap-2 rounded-xl bg-rose-50 px-3.5 py-3 text-sm text-rose-800 ring-1 ring-inset ring-rose-100">
      <TriangleAlert size={16} className="mt-0.5 shrink-0" />
      {erro}
    </p>
  );
}

/** O rótulo pequeno em caixa-alta dos campos da ficha. */
export function Rotulo({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{children}</p>;
}
