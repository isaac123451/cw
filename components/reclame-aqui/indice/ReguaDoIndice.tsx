import { notaExata } from "@/lib/models/indiceRA";
import { scoreBands } from "@/lib/services/reputation.service";

/**
 * A régua de 0 a 10 com as faixas do portal, o mínimo do selo (8) e as
 * duas notas — a atual em cima, a prévia embaixo.
 *
 * Com as duas quase no mesmo ponto (8,78 e 8,81), a régua inteira não
 * mostra a diferença; por isso a distância até o 8 vai escrita embaixo.
 */
export default function ReguaDoIndice({ atual, previa }: { atual: number; previa: number }) {
  const pos = (v: number) => `${Math.min(Math.max((v / 10) * 100, 1), 99)}%`;
  const acima = (v: number) => (v >= 8 ? `${notaExata(v - 8)} acima do mínimo do selo` : `${notaExata(8 - v)} abaixo do mínimo do selo`);

  return (
    <div>
      <div className="relative h-14">
        <Marcador rotulo="Atual" valor={atual} posicao={pos(atual)} lado="cima" />
      </div>

      <div className="relative flex h-3 overflow-hidden rounded-full">
        {scoreBands.map((b, i) => {
          const fim = scoreBands[i + 1]?.min ?? 10;
          return <span key={b.label} title={`${b.label} (${b.range})`} style={{ width: `${(fim - b.min) * 10}%`, background: b.color, opacity: 0.75 }} />;
        })}
      </div>

      <div className="relative">
        {/* O mínimo do selo. */}
        <span className="absolute -top-4 h-5 w-0.5 -translate-x-1/2 bg-zinc-900" style={{ left: "80%" }} aria-hidden />
        <span className="absolute top-1.5 -translate-x-1/2 text-[10.5px] font-semibold text-zinc-700" style={{ left: "80%" }}>
          RA1000 · 8
        </span>
        <div className="relative h-14">
          <Marcador rotulo="Prévia" valor={previa} posicao={pos(previa)} lado="baixo" />
        </div>
      </div>

      <div className="mt-1 flex flex-wrap justify-between gap-2 text-[10.5px] text-zinc-400">
        {scoreBands.map((b) => (
          <span key={b.label}>
            {b.label} {b.range}
          </span>
        ))}
      </div>

      <p className="mt-3 text-xs text-zinc-600">
        Atual: {acima(atual)}. Prévia: {acima(previa)}.
      </p>
    </div>
  );
}

function Marcador({ rotulo, valor, posicao, lado }: { rotulo: string; valor: number; posicao: string; lado: "cima" | "baixo" }) {
  return (
    <span
      className={`absolute flex -translate-x-1/2 flex-col items-center ${lado === "cima" ? "bottom-1" : "top-6"}`}
      style={{ left: posicao }}
    >
      {lado === "baixo" && <span className="mb-1 h-3 w-0.5 bg-violet-400" aria-hidden />}
      <span
        className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ring-1 ring-inset ${
          lado === "cima" ? "bg-zinc-900 text-white ring-zinc-900" : "bg-violet-50 text-violet-800 ring-violet-200"
        }`}
      >
        {rotulo} {notaExata(valor)}
      </span>
      {lado === "cima" && <span className="mt-1 h-3 w-0.5 bg-zinc-900" aria-hidden />}
    </span>
  );
}
