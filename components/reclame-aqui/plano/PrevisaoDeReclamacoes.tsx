"use client";

import SurfaceCard from "@/components/shared/SurfaceCard";

import { nomeDoMes, ROTULO_DO_METODO, type PrevisaoDeReclamacoes } from "@/lib/models/previsaoDeReclamacoes";

import { num } from "./formato";

const curto = (mes: string) => `${nomeDoMes(mes).slice(0, 3)}/${mes.slice(2, 4)}`;

/**
 * A previsão de reclamações (1.133): os meses que já aconteceram, o mês
 * corrente (o que chegou e o resto previsto) e os próximos, com a faixa
 * do erro medido. Uma série só, então sem legenda de cor: o previsto é a
 * barra clara, e o rótulo diz.
 */
export default function PrevisaoDeReclamacoesCard({ previsao }: { previsao: PrevisaoDeReclamacoes }) {
  const historico = previsao.historico.slice(-12);
  const teste = previsao.testes[0];
  const barras = [
    ...historico.map((h) => ({ mes: h.mes, real: h.recebidas, previsto: 0, min: null as number | null, max: null as number | null, tipo: "real" as const })),
    ...previsao.proximos.map((p, i) => ({
      mes: p.mes,
      real: i === 0 ? previsao.atual.ateHoje : 0,
      previsto: i === 0 ? Math.max(0, p.usado - previsao.atual.ateHoje) : p.usado,
      min: p.manual != null ? null : p.min,
      max: p.manual != null ? null : p.max,
      tipo: (i === 0 ? "atual" : "futuro") as "atual" | "futuro",
    })),
  ];
  const teto = Math.max(1, ...barras.map((b) => Math.max(b.real + b.previsto, b.max ?? 0)));
  const L = 720;
  const A = 200;
  const base = A - 24;
  const largura = L / barras.length;
  const y = (v: number) => base - (v / teto) * (base - 16);

  return (
    <SurfaceCard
      title="Previsão de reclamações"
      description={`Quantas devem chegar por mês. Método: ${ROTULO_DO_METODO[previsao.metodo]} — o que menos errou nos últimos 12 meses, testado contra o que de fato chegou.`}
    >
      <svg viewBox={`0 0 ${L} ${A}`} className="h-52 w-full" role="img" aria-label="Reclamações por mês: as que chegaram e as previstas">
        <line x1={0} x2={L} y1={base} y2={base} className="stroke-zinc-200" strokeWidth={1} />
        {barras.map((b, i) => {
          const x = i * largura + largura * 0.18;
          const w = largura * 0.64;
          const total = b.real + b.previsto;
          const rotulo =
            b.tipo === "real"
              ? `${curto(b.mes)}: ${b.real} reclamações`
              : b.tipo === "atual"
                ? `${curto(b.mes)}: ${b.real} até hoje, ${b.real + b.previsto} previstas no mês${b.min !== null ? ` (entre ${b.min} e ${b.max})` : ""}`
                : `${curto(b.mes)}: ${b.previsto} previstas${b.min !== null ? ` (entre ${b.min} e ${b.max})` : " (número digitado)"}`;
          return (
            <g key={b.mes}>
              <title>{rotulo}</title>
              <rect x={i * largura} y={0} width={largura} height={A} fill="transparent" />
              {b.previsto > 0 && <rect x={x} y={y(total)} width={w} height={Math.max(0, y(b.real) - y(total) - (b.real > 0 ? 2 : 0))} rx={4} className="fill-violet-200" />}
              {b.real > 0 && <rect x={x} y={y(b.real)} width={w} height={base - y(b.real)} rx={4} className="fill-violet-600" />}
              {b.min !== null && b.max !== null && b.tipo !== "real" && (
                <g className="stroke-violet-400" strokeWidth={1.5}>
                  <line x1={x + w / 2} x2={x + w / 2} y1={y(b.max)} y2={y(b.min)} />
                  <line x1={x + w / 2 - 5} x2={x + w / 2 + 5} y1={y(b.max)} y2={y(b.max)} />
                  <line x1={x + w / 2 - 5} x2={x + w / 2 + 5} y1={y(b.min)} y2={y(b.min)} />
                </g>
              )}
              {(b.tipo !== "real" || i === historico.length - 1) && (
                <text x={x + w / 2} y={y(Math.max(total, b.max ?? 0)) - 5} textAnchor="middle" className="fill-zinc-700 text-[11px] font-medium tabular-nums">
                  {total}
                </text>
              )}
              <text x={x + w / 2} y={A - 8} textAnchor="middle" className={`text-[10px] ${b.tipo === "real" ? "fill-zinc-400" : "fill-violet-700"}`}>
                {curto(b.mes)}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="mt-2 text-sm text-zinc-600">
        Barras escuras: chegaram. Claras: previstas, com a faixa onde 8 em cada 10 meses ficaram.
        {teste ? ` Nos últimos 12 meses o método errou em média ${num(teste.erroMedio)} reclamações por mês${teste.vies ? `, ${teste.vies < 0 ? "mais para baixo" : "mais para cima"} (${teste.vies < 0 ? "−" : "+"}${num(Math.abs(teste.vies))})` : ""}.` : ""} Em {nomeDoMes(previsao.atual.mes)}, {previsao.atual.ateHoje} chegaram em {previsao.atual.diasPassados} dia(s) — no ritmo de agora seriam {previsao.atual.ritmo} no mês.
      </p>
      <details className="mt-2 text-sm text-zinc-600">
        <summary className="cursor-pointer">Os métodos testados</summary>
        <table className="mt-2 w-full max-w-lg text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-zinc-400">
              <th className="py-1 pr-3 font-semibold">Método</th>
              <th className="px-3 py-1 text-right font-semibold">Erro médio</th>
              <th className="py-1 pl-3 text-right font-semibold">8 em 10 até</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 tabular-nums">
            {previsao.testes.map((t) => (
              <tr key={t.metodo} className={t.metodo === previsao.metodo ? "font-medium text-zinc-900" : ""}>
                <td className="py-1 pr-3">{ROTULO_DO_METODO[t.metodo]}</td>
                <td className="px-3 py-1 text-right">{num(t.erroMedio)}</td>
                <td className="py-1 pl-3 text-right">{num(t.erroDe80)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </SurfaceCard>
  );
}
