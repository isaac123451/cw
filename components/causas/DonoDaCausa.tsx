"use client";

import { Send } from "lucide-react";

import { acharCausa, rotuloDoPrazo } from "@/lib/models/catalogoDeCausas";
import { useNps } from "@/lib/context/NpsContext";

/**
 * A área dona da causa escolhida, logo abaixo do campo (Fase 27).
 *
 * "Cada causa com dono": classificar já diz quem resolve e em quanto
 * tempo. Onde o registro é um caso (Reclame Aqui e redes), o botão abre
 * o acionamento da área já com ela escolhida; no NPS e no Google, que
 * não têm relógio de área, a linha só informa.
 */
export default function DonoDaCausa({ causa, onAcionar }: { causa?: string; onAcionar?: (area: string) => void }) {
  const { rootCauses } = useNps();
  return <LinhaDoDono achada={acharCausa(causa, rootCauses)} onAcionar={onAcionar} />;
}

/** A linha em si, sem o contexto — para a tela de teste e para quem já tem a causa em mãos. */
export function LinhaDoDono({ achada, onAcionar }: { achada?: { area?: string; prazoHoras?: number }; onAcionar?: (area: string) => void }) {
  if (!achada?.area) return null;
  const proprio = achada.area === "Atendimento";
  return (
    <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500" data-dono-da-causa>
      <span>
        Dono: <strong className="font-medium text-zinc-700">{achada.area}</strong> · {rotuloDoPrazo(achada.prazoHoras)}
        {proprio && " — é do próprio atendimento"}
      </span>
      {onAcionar && !proprio && (
        <button
          type="button"
          onClick={() => onAcionar(achada.area!)}
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium text-violet-700 hover:bg-violet-50"
        >
          <Send size={11} /> Acionar {achada.area}
        </button>
      )}
    </p>
  );
}
