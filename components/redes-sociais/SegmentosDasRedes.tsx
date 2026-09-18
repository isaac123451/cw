"use client";

import SurfaceCard from "@/components/shared/SurfaceCard";

import { DIMENSOES_DAS_REDES, type DimensaoDasRedes, type Faceta } from "@/lib/models/segmentosDasRedes";
import { cn } from "@/lib/utils";

interface Props {
  facetas: Record<DimensaoDasRedes, Faceta[]>;
  total: number;
  filtrados: number;
  ativos: number;
  onAlternar: (dimensao: DimensaoDasRedes, valor: string) => void;
  onLimpar: () => void;
}

/**
 * Os segmentos das Redes como filtros, com a contagem ao lado de cada um.
 *
 * Substitui os dois gráficos de barra da tela: o de assuntos virou a
 * linha Assunto, e o de status já é o quadro. O número ao lado de cada
 * valor é quantos casos ficariam com ele escolhido — ver `segmentar`.
 */
export default function SegmentosDasRedes({ facetas, total, filtrados, ativos, onAlternar, onLimpar }: Props) {
  return (
    <SurfaceCard
      title="Segmentos"
      description={ativos ? `${filtrados} de ${total} atendimento(s) com os filtros escolhidos.` : `${total} atendimento(s). Clique num segmento para filtrar o quadro e a lista.`}
      action={
        ativos > 0 ? (
          <button type="button" onClick={onLimpar} className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900">
            Limpar {ativos} filtro(s)
          </button>
        ) : undefined
      }
    >
      <dl className="grid gap-x-10 gap-y-1 lg:grid-cols-2">
        {DIMENSOES_DAS_REDES.map(({ id, nome }) => {
          const valores = facetas[id] ?? [];
          if (valores.length === 0) return null;
          return (
            <div key={id} className="flex min-w-0 flex-col gap-1.5 py-1.5 sm:flex-row sm:items-start sm:gap-4">
              <dt className="w-24 shrink-0 pt-1.5 text-xs text-zinc-500">{nome}</dt>
              <dd className="flex min-w-0 flex-wrap gap-1.5">
                {valores.map((f) => (
                  <button
                    key={f.valor}
                    type="button"
                    onClick={() => onAlternar(id, f.valor)}
                    aria-pressed={f.ativo}
                    disabled={!f.ativo && f.total === 0}
                    className={cn(
                      "flex h-7 max-w-full items-center gap-1.5 rounded-md border px-2 text-xs transition-colors disabled:cursor-default disabled:opacity-40",
                      f.ativo ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300"
                    )}
                  >
                    <span className="truncate">{f.valor}</span>
                    <span className={cn("tabular-nums", f.ativo ? "text-white/60" : "text-zinc-400")}>{f.total}</span>
                  </button>
                ))}
              </dd>
            </div>
          );
        })}
      </dl>
    </SurfaceCard>
  );
}
