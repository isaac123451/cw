"use client";

import { useState } from "react";

import { useLargura } from "@/lib/hooks/useLargura";
import { notaExata, type DiaDaEvolucao } from "@/lib/models/indiceRA";

const A = 180;
const M = { esq: 44, dir: 12, cima: 12, baixo: 24 };

const br = (dia: string) => `${dia.slice(8)}/${dia.slice(5, 7)}`;

/**
 * A nota exata de cada dia do mês: a atual (meses fechados) e a prévia.
 *
 * Desenhado na largura real (1.86): altura fixa, texto do tamanho certo, e
 * passar o mouse mostra o dia — as duas notas e o que aconteceu nele. O
 * eixo se ajusta ao que variou: de 8,69 a 8,85 numa régua de 0 a 10 seria
 * uma linha reta.
 */
export default function EvolucaoDoIndice({ dias }: { dias: DiaDaEvolucao[] }) {
  const [ref, L] = useLargura();
  const [ativo, setAtivo] = useState<number | null>(null);

  if (dias.length === 0) return <p className="text-sm text-zinc-500">O mês ainda não começou.</p>;

  const [ano, mes] = dias[0].dia.split("-").map(Number);
  const diasNoMes = new Date(Date.UTC(ano, mes, 0)).getUTCDate();

  const valores = dias.flatMap((d) => [d.atual, d.previa]).filter((v) => v > 0);
  /* Antes de as reclamações carregarem, não há nota: sem isto o eixo vira NaN. */
  if (valores.length === 0) return <p className="text-sm text-zinc-500">Ainda sem nota no período.</p>;

  const min = Math.floor((Math.min(...valores) - 0.02) * 100) / 100;
  const max = Math.ceil((Math.max(...valores) + 0.02) * 100) / 100;
  const largo = L - M.esq - M.dir;
  const xn = (n: number) => M.esq + ((n - 1) / Math.max(1, diasNoMes - 1)) * largo;
  const x = (dia: string) => xn(Number(dia.slice(8)));
  const y = (v: number) => M.cima + (1 - (v - min) / Math.max(0.0001, max - min)) * (A - M.cima - M.baixo);
  const linha = (chave: "atual" | "previa") => dias.map((d, i) => `${i ? "L" : "M"}${x(d.dia).toFixed(1)},${y(d[chave]).toFixed(1)}`).join(" ");
  const marcas = Array.from({ length: 4 }, (_, i) => min + ((max - min) * i) / 3);
  const rotulosX = L < 480 ? [1, 10, 20, diasNoMes] : [1, 5, 10, 15, 20, 25, diasNoMes];

  const mover = (e: React.MouseEvent<SVGSVGElement>) => {
    const caixa = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - caixa.left;
    const n = Math.round(((px - M.esq) / Math.max(1, largo)) * (diasNoMes - 1)) + 1;
    const i = dias.findIndex((d) => Number(d.dia.slice(8)) === n);
    setAtivo(i >= 0 ? i : n > dias.length ? dias.length - 1 : null);
  };

  const d = ativo === null ? null : dias[ativo];
  const antes = ativo ? dias[ativo - 1] : null;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-600">
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-5 rounded bg-zinc-800" />Atual</span>
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-5 rounded bg-violet-600" />Prévia</span>
        <span className="text-zinc-400">Passe o mouse para ver o dia</span>
      </div>

      <div ref={ref} className="relative mt-2 w-full">
        <svg
          width={L}
          height={A}
          viewBox={`0 0 ${L} ${A}`}
          className="block"
          role="img"
          aria-label="Evolução da nota no mês"
          onMouseMove={mover}
          onMouseLeave={() => setAtivo(null)}
        >
          {marcas.map((v, i) => (
            <g key={i}>
              <line x1={M.esq} x2={L - M.dir} y1={y(v)} y2={y(v)} className="stroke-zinc-200" strokeDasharray="3 4" />
              <text x={M.esq - 6} y={y(v) + 4} textAnchor="end" className="fill-zinc-400 text-[10.5px] tabular-nums">
                {v.toFixed(2).replace(".", ",")}
              </text>
            </g>
          ))}
          {rotulosX.map((n) => (
            <text key={n} x={xn(n)} y={A - 6} textAnchor="middle" className="fill-zinc-400 text-[10.5px] tabular-nums">
              {n}
            </text>
          ))}
          {d && <line x1={x(d.dia)} x2={x(d.dia)} y1={M.cima} y2={A - M.baixo} className="stroke-zinc-300" />}
          <path d={linha("atual")} fill="none" className="stroke-zinc-800" strokeWidth={2} />
          <path d={linha("previa")} fill="none" className="stroke-violet-600" strokeWidth={2} />
          {d && (
            <>
              <circle cx={x(d.dia)} cy={y(d.atual)} r={4} className="fill-zinc-800 stroke-white" strokeWidth={2} />
              <circle cx={x(d.dia)} cy={y(d.previa)} r={4} className="fill-violet-600 stroke-white" strokeWidth={2} />
            </>
          )}
        </svg>

        {d && (
          <div
            className="pointer-events-none absolute top-0 z-10 w-56 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs shadow-lg"
            style={{ left: Math.min(Math.max(x(d.dia) + 12, 0), Math.max(0, L - 232)) }}
          >
            <p className="font-semibold text-zinc-900">{br(d.dia)}</p>
            <p className="mt-1 flex justify-between tabular-nums text-zinc-700">
              <span>Atual</span>
              <span>
                {notaExata(d.atual)}
                {antes && Math.abs(d.atual - antes.atual) > 1e-6 && (
                  <span className={d.atual > antes.atual ? "text-emerald-700" : "text-rose-700"}> {d.atual > antes.atual ? "+" : "−"}{notaExata(Math.abs(d.atual - antes.atual))}</span>
                )}
              </span>
            </p>
            <p className="flex justify-between tabular-nums text-violet-800">
              <span>Prévia</span>
              <span>
                {notaExata(d.previa)}
                {antes && Math.abs(d.previa - antes.previa) > 1e-6 && (
                  <span className={d.previa > antes.previa ? "text-emerald-700" : "text-rose-700"}> {d.previa > antes.previa ? "+" : "−"}{notaExata(Math.abs(d.previa - antes.previa))}</span>
                )}
              </span>
            </p>
            <p className="mt-1 border-t border-zinc-100 pt-1 text-zinc-500">
              {[
                d.recebidasNoDia ? `${d.recebidasNoDia} nova(s)` : null,
                d.respondidasNoDia ? `${d.respondidasNoDia} respondida(s)` : null,
                d.avaliadasNoDia ? `${d.avaliadasNoDia} avaliada(s)` : null,
              ].filter(Boolean).join(" · ") || "Nada novo no dia"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
