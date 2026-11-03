"use client";

import SurfaceCard from "@/components/shared/SurfaceCard";

import { DIMENSOES_DAS_REDES, type DimensaoDasRedes, type Faceta } from "@/lib/models/segmentosDasRedes";
import { cn } from "@/lib/utils";
import { pluralDe } from "@/lib/plural";

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
  /*
    Linha com um valor só não filtra nada (03/11/2026): "Alcance: Sem o dado
    146" e "Estabelecimento: Sem vínculo 146" ocupavam a tela inteira dizendo
    a mesma coisa. Viram uma frase no rodapé — a não ser que estejam ligadas.
  */
  const unico = (id: DimensaoDasRedes) => {
    const v = facetas[id] ?? [];
    return v.length === 1 && !v[0].ativo;
  };
  const iguais = DIMENSOES_DAS_REDES.filter(({ id }) => unico(id)).map(({ id, nome }) => `${nome}: ${facetas[id][0].valor.toLowerCase()}`);
  return (
    <SurfaceCard
      tour="segmentos"
      title="Segmentos"
      description={ativos ? `${filtrados} de ${total} ${pluralDe(total, "atendimento", "atendimentos")} com os filtros escolhidos.` : `${total} ${pluralDe(total, "atendimento", "atendimentos")}. Clique num segmento para filtrar o quadro e a lista.`}
      action={
        ativos > 0 ? (
          <button type="button" onClick={onLimpar} className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900">
            Limpar {ativos} {pluralDe(ativos, "filtro", "filtros")}
          </button>
        ) : undefined
      }
    >
      <dl className="grid gap-x-10 gap-y-1 lg:grid-cols-2">
        {DIMENSOES_DAS_REDES.map(({ id, nome }) => {
          const valores = facetas[id] ?? [];
          if (valores.length === 0 || unico(id)) return null;
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
      {iguais.length > 0 && (
        <p className="mt-2 border-t border-zinc-100 pt-2 text-xs text-zinc-400">
          Iguais em todos: {iguais.join(" · ")}.
        </p>
      )}
    </SurfaceCard>
  );
}
