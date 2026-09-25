import { Lightbulb } from "lucide-react";

import SurfaceCard from "@/components/shared/SurfaceCard";

import type { IdeiaDoPremio } from "@/lib/models/premio";

/** Ideias e estratégias da campanha, cada uma com o número da base que a sustenta. */
export default function IdeiasDoPremio({ ideias }: { ideias: IdeiaDoPremio[] }) {
  return (
    <SurfaceCard title="Ideias e estratégias" description="O que a operação controla: quem pedir primeiro, quando, quantas vezes e onde deixar o link.">
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {ideias.map((i) => (
          <li key={i.titulo} className="rounded-xl bg-zinc-50 px-4 py-3">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-zinc-900">
              <Lightbulb size={14} className="shrink-0 text-amber-500" />
              {i.titulo}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-zinc-600">{i.texto}</p>
            {i.numero && <p className="mt-1.5 text-xs font-medium tabular-nums text-violet-800">{i.numero}</p>}
          </li>
        ))}
      </ul>
    </SurfaceCard>
  );
}
