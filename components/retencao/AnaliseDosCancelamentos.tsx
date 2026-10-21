"use client";

import { useMemo } from "react";

import type { ClienteEmCancelamento, ResumoDeRetencao } from "@/lib/models/cancelamento";
import { MOTIVOS_DE_CANCELAMENTO } from "@/lib/models/motivoDoCancelamento";

const MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const mes = (aaaamm: string) => `${MES[Number(aaaamm.slice(5, 7)) - 1]}/${aaaamm.slice(2, 4)}`;
const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)}%`);
const FRENTE: Record<string, string> = { "reclame-aqui": "Reclame Aqui", redes: "Redes", nps: "NPS", conversa: "WhatsApp" };

/* As três séries da tela inteira: quem ficou, quem saiu e quem ainda não teve desfecho. Texto nunca na cor da série. */
const COR_RETIDO = "bg-emerald-500";
const COR_CANCELADO = "bg-rose-500";
const COR_ABERTO = "bg-zinc-300";

interface Contagem {
  retidos: number;
  cancelados: number;
  abertos: number;
}

function contar(lista: ClienteEmCancelamento[]): Contagem & { total: number } {
  const retidos = lista.filter((c) => c.desfecho === "retido").length;
  const cancelados = lista.filter((c) => c.desfecho === "cancelado").length;
  return { total: lista.length, retidos, cancelados, abertos: lista.length - retidos - cancelados };
}

function Legenda() {
  return (
    <span className="flex flex-wrap items-center gap-3 text-xs text-zinc-500">
      {(
        [
          [COR_RETIDO, "Ficaram"],
          [COR_CANCELADO, "Cancelaram"],
          [COR_ABERTO, "Em aberto"],
        ] as const
      ).map(([cor, nome]) => (
        <span key={nome} className="flex items-center gap-1.5">
          <span className={`h-2.5 w-2.5 rounded-sm ${cor}`} /> {nome}
        </span>
      ))}
    </span>
  );
}

/**
 * Uma barra horizontal dividida entre quem ficou, quem saiu e quem está em
 * aberto: o comprimento é o total (proporcional ao maior da lista), os
 * pedaços têm 2 px de folga entre si e só as pontas são arredondadas.
 */
function BarraDividida({ c, total, maior, nome }: { c: Contagem; total: number; maior: number; nome: string }) {
  const pedacos = (
    [
      [c.retidos, COR_RETIDO, "ficaram"],
      [c.cancelados, COR_CANCELADO, "cancelaram"],
      [c.abertos, COR_ABERTO, "em aberto"],
    ] as const
  ).filter(([n]) => n > 0);
  return (
    <span className="flex h-2.5 gap-0.5" style={{ width: `${Math.max(4, (total / maior) * 100)}%` }}>
      {pedacos.map(([n, cor, rotulo], i) => (
        <span
          key={rotulo}
          className={`h-full min-w-[3px] ${i === 0 ? "rounded-l" : ""} ${i === pedacos.length - 1 ? "rounded-r" : ""} ${cor}`}
          style={{ flex: n }}
          title={`${nome}: ${n} ${rotulo}`}
        />
      ))}
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
 * A análise dos cancelamentos (20/10/2026).
 *
 * Responde, do período escolhido: por que pedem para cancelar e em qual
 * motivo mais se perde; quais assuntos de reclamação mais terminam em
 * cancelamento ("preciso ver quais foram os casos que mais cancelaram");
 * como a retenção anda mês a mês; por onde pedem; quem cancelou; e quanto
 * tempo leva do pedido ao cancelamento.
 *
 * O mês a mês desenhava colunas de altura zero: a altura em % era medida
 * contra uma caixa sem altura. Agora cada coluna ocupa a altura toda e a
 * barra cresce de baixo.
 */
export default function AnaliseDosCancelamentos({ clientes, resumo }: { clientes: ClienteEmCancelamento[]; resumo: ResumoDeRetencao }) {
  const motivos = useMemo(
    () =>
      MOTIVOS_DE_CANCELAMENTO.map((m) => ({ id: m.id, nome: m.nome, ...contar(clientes.filter((c) => c.motivos.includes(m.id))) }))
        .filter((l) => l.total > 0)
        .sort((a, b) => b.total - a.total),
    [clientes]
  );
  const semMotivo = clientes.filter((c) => !c.motivos.length).length;
  const maiorMotivo = Math.max(1, ...motivos.map((m) => m.total));

  /* Os assuntos do portal que mais terminam em cancelamento — ordenados por quantos saíram. */
  const assuntos = useMemo(() => {
    const nomes = [...new Set(clientes.flatMap((c) => c.assuntos))];
    return nomes
      .map((nome) => ({ nome, ...contar(clientes.filter((c) => c.assuntos.includes(nome))) }))
      .filter((a) => a.cancelados > 0)
      .sort((a, b) => b.cancelados - a.cancelados || b.total - a.total)
      .slice(0, 8);
  }, [clientes]);
  const maiorAssunto = Math.max(1, ...assuntos.map((a) => a.total));

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

      <div className="grid gap-x-10 gap-y-8 px-5 py-5 lg:grid-cols-2">
        {/* Por que pedem para cancelar — e em qual motivo mais se perde. */}
        <div>
          <h3 className="text-sm font-medium text-zinc-800">Por que pedem para cancelar</h3>
          <p className="mt-0.5 text-xs text-zinc-500">Lido do que o cliente escreveu; um cliente pode ter mais de um motivo. “Ficaram” conta só quem já teve desfecho.</p>
          <ul className="mt-3 space-y-3">
            {motivos.map((m) => (
              <li key={m.id}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-sm text-zinc-700" title={m.nome}>
                    {m.nome}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-zinc-500">
                    <span className="font-medium text-zinc-800">{m.total}</span>
                    {m.retidos + m.cancelados > 0 && ` · ficaram ${Math.round((m.retidos / (m.retidos + m.cancelados)) * 100)}%`}
                  </span>
                </div>
                <div className="mt-1">
                  <BarraDividida c={m} total={m.total} maior={maiorMotivo} nome={m.nome} />
                </div>
              </li>
            ))}
          </ul>
          {semMotivo > 0 && (
            <p className="mt-3 text-xs text-zinc-400">
              {semMotivo} {semMotivo === 1 ? "cliente não disse o motivo" : "clientes não disseram o motivo"}.
            </p>
          )}
        </div>

        {/* Os assuntos de reclamação que mais terminaram em cancelamento. */}
        <div>
          <h3 className="text-sm font-medium text-zinc-800">Reclamações que mais terminaram em cancelamento</h3>
          <p className="mt-0.5 text-xs text-zinc-500">Pelo assunto da reclamação no portal, de quem mais saiu para quem menos.</p>
          {assuntos.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">Nenhum cancelamento no período.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {assuntos.map((a) => (
                <li key={a.nome}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-sm text-zinc-700" title={a.nome}>
                      {a.nome}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-zinc-500">
                      <span className="font-medium text-zinc-800">{a.cancelados}</span> de {a.total} cancelaram
                    </span>
                  </div>
                  <div className="mt-1">
                    <BarraDividida c={a} total={a.total} maior={maiorAssunto} nome={a.nome} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Mês a mês: quantos pediram, divididos entre quem ficou, quem está em aberto e quem saiu, com a taxa embaixo. */}
        {meses.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-zinc-800">Mês a mês</h3>
            <p className="mt-0.5 text-xs text-zinc-500">Pelo mês do pedido. Embaixo, a taxa de retenção do mês.</p>
            <div className="mt-3 flex h-36 items-stretch gap-1.5 border-b border-zinc-200" role="img" aria-label="Retidos, em aberto e cancelamentos por mês">
              {meses.map((m) => (
                <div
                  key={m.mes}
                  className="flex min-w-0 flex-1 flex-col items-center justify-end"
                  title={`${mes(m.mes)}: ${m.retidos} ficaram, ${m.emAberto} em aberto, ${m.cancelados} cancelaram (${m.canceladosOutroSetor} por outro setor) · retenção ${pct(m.taxaDeRetencao)}`}
                >
                  <span className="mb-0.5 text-[10px] tabular-nums text-zinc-400">{m.clientes}</span>
                  <div className="flex w-full max-w-8 flex-col gap-0.5" style={{ height: `${(m.clientes / maiorMes) * 82}%` }}>
                    {(
                      [
                        [m.cancelados, COR_CANCELADO],
                        [m.emAberto, COR_ABERTO],
                        [m.retidos, COR_RETIDO],
                      ] as const
                    )
                      .filter(([n]) => n > 0)
                      .map(([n, cor], i) => (
                        <span key={cor} className={`w-full min-h-[3px] ${i === 0 ? "rounded-t" : ""} ${cor}`} style={{ flex: n }} />
                      ))}
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

        {/* Os fatos do período, em três blocos curtos. */}
        <dl className="grid grid-cols-1 content-start gap-5 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-zinc-500">Por onde pediram</dt>
            <dd className="mt-1.5 space-y-1 text-sm text-zinc-800">
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
            <dd className="mt-1.5 space-y-1 text-sm text-zinc-800">
              <span className="flex justify-between gap-2 tabular-nums">
                <span>Nosso atendimento</span>
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
            <dd className="mt-1.5 text-sm text-zinc-800">
              {diasAteCancelar === null ? (
                "—"
              ) : (
                <>
                  <span className="text-2xl font-semibold tabular-nums text-zinc-900">{diasAteCancelar < 1 ? "<1" : Math.round(diasAteCancelar)}</span>{" "}
                  <span className="text-zinc-500">{diasAteCancelar < 2 ? "dia" : "dias"}, na mediana</span>
                </>
              )}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
