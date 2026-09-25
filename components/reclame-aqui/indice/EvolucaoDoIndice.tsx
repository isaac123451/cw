import { notaExata, type DiaDaEvolucao } from "@/lib/models/indiceRA";

const L = 720;
const A = 220;
const M = { esq: 52, dir: 16, cima: 14, baixo: 28 };

/**
 * A nota exata de cada dia do mês: a atual (meses fechados) e a prévia.
 *
 * O eixo da nota se ajusta ao que variou — de 8,69 a 8,85 numa régua de
 * 0 a 10 seria uma linha reta. Embaixo, só os dias que mexeram na nota e
 * o porquê: reclamação nova, resposta publicada, avaliação chegada.
 */
export default function EvolucaoDoIndice({ dias }: { dias: DiaDaEvolucao[] }) {
  if (dias.length === 0) return <p className="text-sm text-zinc-500">O mês ainda não começou.</p>;

  const [ano, mes] = dias[0].dia.split("-").map(Number);
  const diasNoMes = new Date(Date.UTC(ano, mes, 0)).getUTCDate();

  const valores = dias.flatMap((d) => [d.atual, d.previa]).filter((v) => v > 0);
  /* Antes de as reclamações carregarem, não há nota: sem isto o eixo vira NaN. */
  if (valores.length === 0) return <p className="text-sm text-zinc-500">Ainda sem nota no período.</p>;

  const min = Math.floor((Math.min(...valores) - 0.02) * 100) / 100;
  const max = Math.ceil((Math.max(...valores) + 0.02) * 100) / 100;
  const x = (dia: string) => M.esq + ((Number(dia.slice(8)) - 1) / Math.max(1, diasNoMes - 1)) * (L - M.esq - M.dir);
  const y = (v: number) => M.cima + (1 - (v - min) / Math.max(0.0001, max - min)) * (A - M.cima - M.baixo);
  const linha = (chave: "atual" | "previa") => dias.map((d, i) => `${i ? "L" : "M"}${x(d.dia).toFixed(1)},${y(d[chave]).toFixed(1)}`).join(" ");
  const marcas = Array.from({ length: 4 }, (_, i) => min + ((max - min) * i) / 3);

  const mudancas = dias
    .map((d, i) => ({ d, antes: dias[i - 1] }))
    .filter(({ d, antes }) => antes && (Math.abs(d.atual - antes.atual) > 1e-6 || Math.abs(d.previa - antes.previa) > 1e-6));

  return (
    <div>
      <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-600">
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-5 rounded bg-zinc-800" />Atual</span>
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-5 rounded bg-violet-600" />Prévia</span>
      </div>

      <svg viewBox={`0 0 ${L} ${A}`} className="mt-2 h-auto w-full" role="img" aria-label="Evolução da nota no mês">
        {marcas.map((v, i) => (
          <g key={i}>
            <line x1={M.esq} x2={L - M.dir} y1={y(v)} y2={y(v)} className="stroke-zinc-200" strokeDasharray="3 4" />
            <text x={M.esq - 8} y={y(v) + 4} textAnchor="end" className="fill-zinc-400 text-[11px] tabular-nums">
              {v.toFixed(2).replace(".", ",")}
            </text>
          </g>
        ))}
        {[1, 5, 10, 15, 20, 25, diasNoMes].map((n) => (
          <text key={n} x={x(`${dias[0].dia.slice(0, 8)}${String(n).padStart(2, "0")}`)} y={A - 8} textAnchor="middle" className="fill-zinc-400 text-[11px] tabular-nums">
            {n}
          </text>
        ))}
        <path d={linha("atual")} fill="none" className="stroke-zinc-800" strokeWidth={2} />
        <path d={linha("previa")} fill="none" className="stroke-violet-600" strokeWidth={2} />
        {dias.map((d) => (
          <g key={d.dia}>
            <circle cx={x(d.dia)} cy={y(d.atual)} r={2.5} className="fill-zinc-800">
              <title>{`${d.dia.split("-").reverse().join("/")} · atual ${notaExata(d.atual)}`}</title>
            </circle>
            <circle cx={x(d.dia)} cy={y(d.previa)} r={2.5} className="fill-violet-600">
              <title>{`${d.dia.split("-").reverse().join("/")} · prévia ${notaExata(d.previa)} · ${d.recebidasNoDia} nova(s), ${d.respondidasNoDia} respondida(s), ${d.avaliadasNoDia} avaliada(s)`}</title>
            </circle>
          </g>
        ))}
      </svg>

      {mudancas.length > 0 && (
        <div className="mt-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Dias que mexeram na nota</p>
          <ul className="mt-1.5 divide-y divide-zinc-100 text-xs">
            {mudancas
              .slice()
              .reverse()
              .map(({ d, antes }) => {
                const da = d.atual - antes!.atual;
                const dp = d.previa - antes!.previa;
                const porque = [
                  d.recebidasNoDia ? `${d.recebidasNoDia} nova(s)` : null,
                  d.respondidasNoDia ? `${d.respondidasNoDia} respondida(s)` : null,
                  d.avaliadasNoDia ? `${d.avaliadasNoDia} avaliada(s)` : null,
                ].filter(Boolean);
                return (
                  <li key={d.dia} className="flex flex-wrap items-center gap-x-4 gap-y-0.5 py-1.5 tabular-nums">
                    <span className="w-12 font-medium text-zinc-700">{d.dia.slice(8)}/{d.dia.slice(5, 7)}</span>
                    <Delta rotulo="atual" v={da} />
                    <Delta rotulo="prévia" v={dp} />
                    <span className="text-zinc-500">{porque.length ? porque.join(" · ") : "avaliação ou resposta de reclamação antiga"}</span>
                  </li>
                );
              })}
          </ul>
        </div>
      )}
    </div>
  );
}

function Delta({ rotulo, v }: { rotulo: string; v: number }) {
  if (Math.abs(v) < 1e-6) return <span className="w-32 text-zinc-300">{rotulo} =</span>;
  return (
    <span className={`w-32 ${v > 0 ? "text-emerald-700" : "text-rose-700"}`}>
      {rotulo} {v > 0 ? "+" : "−"}
      {notaExata(Math.abs(v))}
    </span>
  );
}
