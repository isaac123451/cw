"use client";

import { useMemo, useState } from "react";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { useLargura } from "@/lib/hooks/useLargura";
import type { Case } from "@/lib/models/case";
import {
  ancoraVizinha,
  evolucaoDoIndice,
  notaExata,
  type EscalaDaEvolucao,
  type PeriodoDoIndice,
  type PontoDaEvolucao,
} from "@/lib/models/indiceRA";
import { ptBR } from "@/lib/services/reputation.service";

const A = 200;
const M = { esq: 48, dir: 12, cima: 12, baixo: 26 };
/* As barras das respostas, no pé do gráfico. */
const BARRA_MAX = 30;

const ESCALAS: { valor: EscalaDaEvolucao; rotulo: string }[] = [
  { valor: "dia", rotulo: "Dia" },
  { valor: "ciclo", rotulo: "Ciclo" },
  { valor: "mes", rotulo: "Mês" },
];

const NOME_DO_PERIODO: Record<EscalaDaEvolucao, string> = { dia: "Dia", ciclo: "Ciclo", mes: "Mês" };

/** "+0,0123", "−0,0040" — ou nada, quando não andou. */
function Variacao({ valor, className = "" }: { valor: number; className?: string }) {
  if (Math.abs(valor) < 0.00005) return <span className={`text-zinc-400 ${className}`}>—</span>;
  return (
    <span className={`${valor > 0 ? "text-emerald-700" : "text-rose-700"} ${className}`}>
      {valor > 0 ? "+" : "−"}
      {notaExata(Math.abs(valor))}
    </span>
  );
}

/**
 * A evolução do índice por dia, ciclo ou mês (1.118).
 *
 * Pedido de 01/10/2026: "como foi cada dia e o quanto aumentou quando eu
 * respondia reclamação ... por dia, ciclo, mês". Cada ponto é o fim de um
 * período: a nota atual e a prévia como estavam naquele dia, quanto
 * andaram, e — separado — o que as respostas e as avaliações do período
 * somaram à prévia. As barras no pé são as respostas publicadas.
 *
 * A avaliação conta no dia em que foi feita; a janela segue a regra do
 * portal (ver `lib/models/indiceRA.ts`).
 */
export default function EvolucaoDoIndice({ casos, periodo, hoje }: { casos: Case[]; periodo: PeriodoDoIndice; hoje: string }) {
  const [escala, setEscala] = useState<EscalaDaEvolucao>("dia");
  const [ancora, setAncora] = useState(hoje);
  const [ref, L] = useLargura();
  const [ativo, setAtivo] = useState<number | null>(null);

  const pontos = useMemo(() => evolucaoDoIndice(casos, periodo, escala, ancora, hoje), [casos, periodo, escala, ancora, hoje]);

  const trocarEscala = (e: EscalaDaEvolucao) => {
    setEscala(e);
    setAncora(hoje);
    setAtivo(null);
  };
  const andar = (passo: -1 | 1) => {
    const proxima = ancoraVizinha(escala, ancora, passo);
    setAncora(proxima > hoje ? hoje : proxima);
    setAtivo(null);
  };
  const noFim = pontos.length > 0 && pontos[pontos.length - 1].emCurso;

  const valores = pontos.flatMap((p) => [p.atual, p.previa]).filter((v) => v > 0);
  const faixa = pontos.length ? `${pontos[0].rotulo} — ${pontos[pontos.length - 1].rotulo}` : "";

  const cabecalho = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="inline-flex rounded-xl bg-zinc-100 p-1" role="tablist" aria-label="Ver a evolução por">
        {ESCALAS.map((e) => (
          <button
            key={e.valor}
            type="button"
            role="tab"
            aria-selected={escala === e.valor}
            onClick={() => trocarEscala(e.valor)}
            className={`rounded-lg px-3.5 py-1 text-sm font-medium transition-colors ${
              escala === e.valor ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-800"
            }`}
          >
            {e.rotulo}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => andar(-1)}
          aria-label="Período anterior"
          className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="min-w-[9rem] text-center text-xs tabular-nums text-zinc-600">{faixa}</span>
        <button
          type="button"
          onClick={() => andar(1)}
          disabled={noFim}
          aria-label="Período seguinte"
          className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800 disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );

  /* Antes de as reclamações carregarem, não há nota: sem isto o eixo vira NaN. */
  if (valores.length === 0) {
    return (
      <div className="space-y-3">
        {cabecalho}
        <p className="text-sm text-zinc-500">Ainda sem nota neste período.</p>
      </div>
    );
  }

  const n = pontos.length;
  const min = Math.floor((Math.min(...valores) - 0.02) * 100) / 100;
  const max = Math.ceil((Math.max(...valores) + 0.02) * 100) / 100;
  const largo = L - M.esq - M.dir;
  const x = (i: number) => (n === 1 ? M.esq + largo / 2 : M.esq + (i / (n - 1)) * largo);
  const base = A - M.baixo;
  const y = (v: number) => M.cima + (1 - (v - min) / Math.max(0.0001, max - min)) * (base - M.cima);
  const linha = (chave: "atual" | "previa") => pontos.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p[chave]).toFixed(1)}`).join(" ");
  const marcas = Array.from({ length: 4 }, (_, i) => min + ((max - min) * i) / 3);
  const maisRespostas = Math.max(1, ...pontos.map((p) => p.respondidas));
  const larguraDaBarra = Math.max(3, Math.min(14, (largo / Math.max(1, n)) * 0.5));
  const passoDoRotulo = Math.max(1, Math.ceil(n / (L < 480 ? 4 : 8)));
  const rotulosX = pontos.map((_, i) => i).filter((i) => i % passoDoRotulo === 0 || i === n - 1);

  const mover = (e: React.MouseEvent<SVGSVGElement>) => {
    const caixa = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - caixa.left;
    const i = n === 1 ? 0 : Math.round(((px - M.esq) / Math.max(1, largo)) * (n - 1));
    setAtivo(Math.min(n - 1, Math.max(0, i)));
  };

  const p = ativo === null ? null : pontos[ativo];

  return (
    <div className="space-y-3">
      {cabecalho}

      <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-600">
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-5 rounded bg-zinc-800" />Atual</span>
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-5 rounded bg-violet-600" />Prévia</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2 rounded-sm bg-violet-200" />Respostas publicadas</span>
        <span className="text-zinc-400">Passe o mouse para ver o {NOME_DO_PERIODO[escala].toLowerCase()}</span>
      </div>

      <div ref={ref} className="relative w-full">
        <svg
          width={L}
          height={A}
          viewBox={`0 0 ${L} ${A}`}
          className="block"
          role="img"
          aria-label={`Evolução da nota por ${NOME_DO_PERIODO[escala].toLowerCase()}`}
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
          {pontos.map((ponto, i) =>
            ponto.respondidas > 0 ? (
              <rect
                key={ponto.chave}
                x={x(i) - larguraDaBarra / 2}
                y={base - (ponto.respondidas / maisRespostas) * BARRA_MAX}
                width={larguraDaBarra}
                height={(ponto.respondidas / maisRespostas) * BARRA_MAX}
                rx={2}
                className="fill-violet-200"
              />
            ) : null
          )}
          {rotulosX.map((i) => (
            <text key={i} x={x(i)} y={A - 8} textAnchor="middle" className="fill-zinc-400 text-[10.5px] tabular-nums">
              {escala === "ciclo" ? pontos[i].rotulo.replace(" a ", "–") : pontos[i].rotulo}
            </text>
          ))}
          {p && <line x1={x(ativo!)} x2={x(ativo!)} y1={M.cima} y2={base} className="stroke-zinc-300" />}
          <path d={linha("atual")} fill="none" className="stroke-zinc-800" strokeWidth={2} />
          <path d={linha("previa")} fill="none" className="stroke-violet-600" strokeWidth={2} />
          {n <= 12 &&
            pontos.map((ponto, i) => (
              <g key={ponto.chave}>
                <circle cx={x(i)} cy={y(ponto.atual)} r={2.5} className="fill-zinc-800" />
                <circle cx={x(i)} cy={y(ponto.previa)} r={2.5} className="fill-violet-600" />
              </g>
            ))}
          {p && (
            <>
              <circle cx={x(ativo!)} cy={y(p.atual)} r={4} className="fill-zinc-800 stroke-white" strokeWidth={2} />
              <circle cx={x(ativo!)} cy={y(p.previa)} r={4} className="fill-violet-600 stroke-white" strokeWidth={2} />
            </>
          )}
        </svg>

        {p && (
          <div
            className="pointer-events-none absolute top-0 z-10 w-64 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs shadow-lg"
            style={{ left: Math.min(Math.max(x(ativo!) + 12, 0), Math.max(0, L - 268)) }}
          >
            <p className="font-semibold text-zinc-900">
              {p.rotulo}
              {p.emCurso && <span className="ml-1.5 font-normal text-violet-700">em curso</span>}
            </p>
            {p.virada && escala !== "mes" && (
              <p className="text-zinc-500">Virada do mês: a janela trocou de meses.</p>
            )}
            <p className="mt-1 flex justify-between tabular-nums text-zinc-700">
              <span>Atual</span>
              <span>
                {notaExata(p.atual)} <Variacao valor={p.variacaoAtual} />
              </span>
            </p>
            <p className="flex justify-between tabular-nums text-violet-800">
              <span>Prévia</span>
              <span>
                {notaExata(p.previa)} <Variacao valor={p.variacaoPrevia} />
              </span>
            </p>
            <div className="mt-1 space-y-0.5 border-t border-zinc-100 pt-1 text-zinc-600">
              <p className="flex justify-between tabular-nums">
                <span>{p.respondidas} resposta(s)</span>
                {p.respondidas > 0 && <Variacao valor={p.efeitoDasRespostas} />}
              </p>
              <p className="flex justify-between tabular-nums">
                <span>
                  {p.avaliadas} avaliação(ões)
                  {p.notaDasAvaliacoes !== null && <span className="text-zinc-400"> · média {ptBR(p.notaDasAvaliacoes, 1)}</span>}
                </span>
                {p.avaliadas > 0 && <Variacao valor={p.efeitoDasAvaliacoes} />}
              </p>
              <p>{p.recebidas} reclamação(ões) nova(s)</p>
            </div>
          </div>
        )}
      </div>

      <TabelaDaEvolucao pontos={pontos} escala={escala} />

      {escala !== "mes" && pontos.some((ponto) => ponto.virada) && (
        <p className="text-xs text-zinc-500">
          Na virada do mês a janela troca de meses — sai o mais antigo, entra o novo —, e a nota anda mesmo sem resposta nem avaliação no dia.
        </p>
      )}
    </div>
  );
}

/** Do mais novo para o mais velho: o que aconteceu em cada período e o que somou. */
function TabelaDaEvolucao({ pontos, escala }: { pontos: PontoDaEvolucao[]; escala: EscalaDaEvolucao }) {
  const linhas = [...pontos].reverse();
  const doMes = escala === "mes";
  return (
    <div className="max-h-[380px] overflow-auto rounded-xl ring-1 ring-inset ring-zinc-200">
      <table className={`w-full text-sm ${doMes ? "min-w-[880px]" : "min-w-[720px]"}`}>
        <thead className="sticky top-0 z-[1] bg-zinc-50">
          <tr className="text-left text-[11px] uppercase tracking-wide text-zinc-400">
            <th className="py-2 pl-3 pr-2 font-semibold">{NOME_DO_PERIODO[escala]}</th>
            <th className="px-2 py-2 text-right font-semibold" title="A janela que termina no fim do período — a nota que vem na virada do mês">Prévia</th>
            <th className="px-2 py-2 text-right font-semibold" title="Os meses fechados, como estavam no fim do período — a nota do portal">Atual</th>
            <th className="px-2 py-2 text-right font-semibold" title="Respostas publicadas no período e quanto somaram à prévia">Respostas</th>
            <th className="px-2 py-2 text-right font-semibold" title="Avaliações feitas no período (pela data da avaliação), a média das notas e quanto somaram à prévia">Avaliações</th>
            <th className="px-2 py-2 text-right font-semibold">Novas</th>
            {doMes && (
              <>
                <th className="px-2 py-2 text-right font-semibold" title="A mesma conta dos Gráficos e do Analytics: resposta das reclamações que chegaram no mês; nota do consumidor, solução e voltaria das avaliações feitas no mês">Nota do mês</th>
                <th className="py-2 pl-2 pr-3 text-right font-semibold" title="Das reclamações abertas no mês, as que ainda estão sem resposta">Sem resposta</th>
              </>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 tabular-nums">
          {linhas.map((p) => {
            const parado = p.respondidas === 0 && p.avaliadas === 0 && p.recebidas === 0;
            return (
              <tr key={p.chave} className={parado ? "text-zinc-400" : ""}>
                <td className="py-1.5 pl-3 pr-2 whitespace-nowrap">
                  {p.rotulo}
                  {p.emCurso && <span className="ml-1.5 text-[11px] text-violet-700">em curso</span>}
                  {p.virada && !doMes && <span className="ml-1.5 text-[11px] text-zinc-500">virada do mês</span>}
                </td>
                <td className="px-2 py-1.5 text-right whitespace-nowrap">
                  <b className={`font-semibold ${parado ? "text-zinc-500" : "text-zinc-900"}`}>{notaExata(p.previa)}</b>{" "}
                  <Variacao valor={p.variacaoPrevia} className="text-xs" />
                </td>
                <td className="px-2 py-1.5 text-right whitespace-nowrap">
                  {notaExata(p.atual)} <Variacao valor={p.variacaoAtual} className="text-xs" />
                </td>
                <td className="px-2 py-1.5 text-right whitespace-nowrap">
                  {p.respondidas || "—"}
                  {p.respondidas > 0 && (
                    <>
                      {" "}
                      <Variacao valor={p.efeitoDasRespostas} className="text-xs" />
                    </>
                  )}
                </td>
                <td className="px-2 py-1.5 text-right whitespace-nowrap">
                  {p.avaliadas || "—"}
                  {p.notaDasAvaliacoes !== null && <span className="text-xs text-zinc-400"> · {ptBR(p.notaDasAvaliacoes, 1)}</span>}
                  {p.avaliadas > 0 && (
                    <>
                      {" "}
                      <Variacao valor={p.efeitoDasAvaliacoes} className="text-xs" />
                    </>
                  )}
                </td>
                <td className="px-2 py-1.5 text-right">{p.recebidas || "—"}</td>
                {doMes && (
                  <>
                    <td className="px-2 py-1.5 text-right">{p.doMes?.nota == null ? "—" : notaExata(p.doMes.nota)}</td>
                    <td className={`py-1.5 pl-2 pr-3 text-right ${p.doMes && p.doMes.semResposta > 0 ? "font-semibold text-amber-700" : ""}`}>
                      {p.doMes?.semResposta || "—"}
                    </td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
