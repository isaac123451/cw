"use client";

import { useMemo } from "react";

import type { ClienteEmCancelamento, ResumoDeRetencao } from "@/lib/models/cancelamento";
import { MOTIVOS_DE_CANCELAMENTO } from "@/lib/models/motivoDoCancelamento";

const MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const mes = (aaaamm: string) => `${MES[Number(aaaamm.slice(5, 7)) - 1]}/${aaaamm.slice(2, 4)}`;
const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)}%`);
const FRENTE: Record<string, string> = { "reclame-aqui": "Reclame Aqui", redes: "Redes", nps: "NPS", conversa: "WhatsApp" };

/* As duas séries da tela inteira: quem ficou e quem saiu. Texto nunca na cor da série. */
const COR_RETIDO = "bg-emerald-500";
const COR_CANCELADO = "bg-rose-500";

function Legenda() {
  return (
    <span className="flex items-center gap-3 text-xs text-zinc-500">
      <span className="flex items-center gap-1.5">
        <span className={`h-2.5 w-2.5 rounded-sm ${COR_RETIDO}`} /> Ficaram
      </span>
      <span className="flex items-center gap-1.5">
        <span className={`h-2.5 w-2.5 rounded-sm ${COR_CANCELADO}`} /> Cancelaram
      </span>
    </span>
  );
}

function mediana(v: number[]) {
  if (!v.length) return null;
  const o = [...v].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
}

/**
 * A análise dos cancelamentos (20/10/2026): "e a parte de analisar os
 * cancelamentos? tu simplesmente só tacou o mês a mês pro lado".
 *
 * Responde, do período escolhido: por que pedem para cancelar e em qual
 * motivo mais se perde; como a retenção anda mês a mês; por onde pedem;
 * quem cancelou; e quanto tempo leva do pedido ao cancelamento.
 */
export default function AnaliseDosCancelamentos({ clientes, resumo }: { clientes: ClienteEmCancelamento[]; resumo: ResumoDeRetencao }) {
  const motivos = useMemo(() => {
    const linhas = MOTIVOS_DE_CANCELAMENTO.map((m) => {
      const deles = clientes.filter((c) => c.motivos.includes(m.id));
      const retidos = deles.filter((c) => c.desfecho === "retido").length;
      return { id: m.id, nome: m.nome, total: deles.length, retidos, cancelados: deles.length - retidos };
    }).filter((l) => l.total > 0);
    return linhas.sort((a, b) => b.total - a.total);
  }, [clientes]);
  const semMotivo = clientes.filter((c) => !c.motivos.length).length;
  const maior = Math.max(1, ...motivos.map((m) => m.total));

  const canais = useMemo(() => {
    const t: Record<string, number> = {};
    for (const c of clientes) if (c.pedido) t[c.pedido.frente] = (t[c.pedido.frente] ?? 0) + 1;
    return Object.entries(t).sort((a, b) => b[1] - a[1]);
  }, [clientes]);

  const setores = useMemo(() => {
    const t: Record<string, number> = {};
    for (const c of clientes) if (c.canceladoPor === "outro-setor") t[c.setor ?? "Chegou cancelado"] = (t[c.setor ?? "Chegou cancelado"] ?? 0) + 1;
    return Object.entries(t).sort((a, b) => b[1] - a[1]);
  }, [clientes]);

  /* Do pedido ao primeiro sinal de cancelamento, em dias corridos. */
  const diasAteCancelar = useMemo(
    () =>
      mediana(
        clientes
          .filter((c) => c.desfecho === "cancelado" && c.pedido)
          .map((c) => {
            const saiu = c.sinais.find((s) => s.tipo === "cancelado" && s.quando >= c.pedido!.quando);
            return saiu ? (Date.parse(saiu.quando) - Date.parse(c.pedido!.quando)) / 86_400_000 : null;
          })
          .filter((d): d is number => d !== null)
      ),
    [clientes]
  );

  const meses = [...resumo.porMes].slice(0, 12).reverse();
  const maiorMes = Math.max(1, ...meses.map((m) => m.clientes));

  if (!clientes.length) return null;

  return (
    <section className="rounded-xl border border-zinc-200/80 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]" aria-label="Análise dos cancelamentos">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 px-5 py-3.5">
        <h2 className="text-[15px] font-semibold tracking-tight text-zinc-900">Análise dos cancelamentos</h2>
        <Legenda />
      </header>

      <div className="grid gap-x-8 gap-y-6 px-5 py-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        {/* Por que pedem para cancelar — e em qual motivo mais se perde. */}
        <div>
          <h3 className="text-sm font-medium text-zinc-800">Por que pedem para cancelar</h3>
          <p className="mt-0.5 text-xs text-zinc-500">Lido do que o cliente escreveu. Um cliente pode ter mais de um motivo.</p>
          <ul className="mt-3 space-y-2.5">
            {motivos.map((m) => (
              <li key={m.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
                <span className="truncate text-sm text-zinc-700" title={m.nome}>
                  {m.nome}
                </span>
                <span className="text-right text-xs tabular-nums text-zinc-500">
                  <span className="font-medium text-zinc-800">{m.total}</span> · ficaram {Math.round((m.retidos / m.total) * 100)}%
                </span>
                {/* A barra cresce com o total; dentro, quem ficou e quem saiu, com 2 px de folga entre os dois. */}
                <span className="col-span-2 flex h-2.5 gap-0.5" style={{ width: `${(m.total / maior) * 100}%` }}>
                  {m.retidos > 0 && (
                    <span className={`h-full rounded-l ${m.cancelados ? "" : "rounded-r"} ${COR_RETIDO}`} style={{ flex: m.retidos }} title={`${m.nome}: ${m.retidos} ficaram`} />
                  )}
                  {m.cancelados > 0 && (
                    <span className={`h-full rounded-r ${m.retidos ? "" : "rounded-l"} ${COR_CANCELADO}`} style={{ flex: m.cancelados }} title={`${m.nome}: ${m.cancelados} cancelaram`} />
                  )}
                </span>
              </li>
            ))}
          </ul>
          {semMotivo > 0 && (
            <p className="mt-3 text-xs text-zinc-400">
              {semMotivo} {semMotivo === 1 ? "cliente não disse o motivo" : "clientes não disseram o motivo"}.
            </p>
          )}
        </div>

        <div className="space-y-6">
          {/* Mês a mês: quantos pediram, divididos entre quem ficou e quem saiu, com a taxa embaixo. */}
          {meses.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-zinc-800">Mês a mês</h3>
              <p className="mt-0.5 text-xs text-zinc-500">Pelo mês do pedido. Embaixo, a taxa de retenção do mês.</p>
              <div className="mt-3 flex h-32 items-end gap-1.5" role="img" aria-label="Retidos e cancelamentos por mês">
                {meses.map((m) => (
                  <div key={m.mes} className="flex min-w-0 flex-1 flex-col items-center gap-1" title={`${mes(m.mes)}: ${m.retidos} ficaram, ${m.cancelados} cancelaram (${m.canceladosOutroSetor} por outro setor) · retenção ${pct(m.taxaDeRetencao)}`}>
                    <div className="flex w-full max-w-7 flex-col justify-end gap-0.5" style={{ height: `${(m.clientes / maiorMes) * 100}%` }}>
                      {m.cancelados > 0 && <span className={`w-full rounded-t ${COR_CANCELADO}`} style={{ flex: m.cancelados }} />}
                      {m.retidos > 0 && <span className={`w-full ${m.cancelados ? "" : "rounded-t"} ${COR_RETIDO}`} style={{ flex: m.retidos }} />}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-1.5 flex gap-1.5">
                {meses.map((m) => (
                  <div key={m.mes} className="min-w-0 flex-1 text-center">
                    <span className="block truncate text-[10px] text-zinc-400">{mes(m.mes)}</span>
                    <span className="block text-[11px] font-medium tabular-nums text-zinc-700">{pct(m.taxaDeRetencao)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Os fatos do período, em três números curtos. */}
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            <div>
              <dt className="text-xs text-zinc-500">Por onde pediram</dt>
              <dd className="mt-1 space-y-0.5 text-sm text-zinc-800">
                {canais.map(([frente, n]) => (
                  <span key={frente} className="flex justify-between gap-2 tabular-nums">
                    <span>{FRENTE[frente] ?? frente}</span>
                    <span className="text-zinc-500">{n}</span>
                  </span>
                ))}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Quem cancelou</dt>
              <dd className="mt-1 space-y-0.5 text-sm text-zinc-800">
                <span className="flex justify-between gap-2 tabular-nums">
                  <span>Nós</span>
                  <span className="text-zinc-500">{resumo.canceladosQueContam}</span>
                </span>
                {setores.map(([setor, n]) => (
                  <span key={setor} className="flex justify-between gap-2 tabular-nums">
                    <span className="truncate">{setor}</span>
                    <span className="text-zinc-500">{n}</span>
                  </span>
                ))}
                {resumo.canceladosNoPrazo > 0 && (
                  <span className="flex justify-between gap-2 tabular-nums">
                    <span>No prazo do contato</span>
                    <span className="text-zinc-500">{resumo.canceladosNoPrazo}</span>
                  </span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Do pedido ao cancelamento</dt>
              <dd className="mt-1 text-sm text-zinc-800">
                {diasAteCancelar === null ? (
                  "—"
                ) : (
                  <>
                    <span className="text-xl font-semibold tabular-nums text-zinc-900">{diasAteCancelar < 1 ? "<1" : Math.round(diasAteCancelar)}</span>{" "}
                    <span className="text-zinc-500">{diasAteCancelar < 2 ? "dia" : "dias"}, na mediana</span>
                  </>
                )}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}
