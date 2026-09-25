"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Loader2, ShieldCheck, UserMinus, UserRoundX, Users } from "lucide-react";

import MainLayout from "@/components/layout/MainLayout";
import PageHeading from "@/components/shared/PageHeading";
import StatTile from "@/components/shared/StatTile";
import SurfaceCard from "@/components/shared/SurfaceCard";

import { lerRetencao, marcarDesfecho } from "@/lib/actions/retencao";
import { useToast } from "@/lib/context/ToastContext";
import type { ClienteEmCancelamento, Desfecho, DesfechoManual, ResumoDeRetencao } from "@/lib/models/cancelamento";

const ROTULO: Record<Desfecho, string> = { retido: "Retido", cancelado: "Cancelado", "em-aberto": "Em aberto" };
const COR: Record<Desfecho, string> = {
  retido: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  cancelado: "bg-rose-50 text-rose-800 ring-rose-200",
  "em-aberto": "bg-amber-50 text-amber-900 ring-amber-200",
};
const FRENTE: Record<string, string> = { "reclame-aqui": "RA", redes: "Redes", nps: "NPS", conversa: "WhatsApp" };
const MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const mes = (aaaamm: string) => `${MES[Number(aaaamm.slice(5, 7)) - 1]}/${aaaamm.slice(2, 4)}`;
const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)}%`);

/**
 * Cancelamento e retenção (1.85).
 *
 * "Identifique automaticamente, juntando pontos até da conversa de
 * WhatsApp, os casos de cancelamento e retenção, para termos um número."
 * A conta é montada agora, a cada abertura, a partir dos casos, do NPS e
 * das conversas guardadas (`lib/models/cancelamento.ts`); cada cliente
 * mostra os pontos que o colocaram ali e por que o desfecho é o que é. Se
 * a leitura errar, um clique corrige — e a correção fica gravada.
 */
export default function RetencaoPage() {
  const { notify } = useToast();
  const [dados, setDados] = useState<{ clientes: ClienteEmCancelamento[]; resumo: ResumoDeRetencao } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ver, setVer] = useState<Desfecho | "todos">("em-aberto");
  const [gravando, setGravando] = useState<string | null>(null);

  async function carregar() {
    const r = await lerRetencao();
    if (!r.ok) setErro(r.erro);
    else {
      setErro(null);
      setDados({ clientes: r.clientes, resumo: r.resumo });
    }
  }

  useEffect(() => {
    let vivo = true;
    lerRetencao().then((r) => {
      if (!vivo) return;
      if (!r.ok) setErro(r.erro);
      else setDados({ clientes: r.clientes, resumo: r.resumo });
    });
    return () => {
      vivo = false;
    };
  }, []);

  async function marcar(c: ClienteEmCancelamento, desfecho: DesfechoManual | null) {
    setGravando(c.chave);
    const r = await marcarDesfecho(c.chave, desfecho);
    setGravando(null);
    if (!r.ok) {
      notify({ tone: "error", title: "Não foi gravado.", detail: r.erro });
      return;
    }
    notify({
      tone: "success",
      title: desfecho === null ? `${c.nome}: de volta à leitura automática.` : desfecho === "nao-e-cancelamento" ? `${c.nome} saiu da conta.` : `${c.nome}: ${desfecho}.`,
    });
    await carregar();
  }

  const visiveis = useMemo(() => (dados ? (ver === "todos" ? dados.clientes : dados.clientes.filter((c) => c.desfecho === ver)) : []), [dados, ver]);

  return (
    <MainLayout>
      <div className="space-y-5">
        <PageHeading
          eyebrow="Inteligência"
          title="Cancelamento e retenção"
          description="Quem pediu para cancelar, quem ficou e quem saiu — juntando o Reclame Aqui, as Redes, o NPS e as conversas guardadas do WhatsApp."
        />

        {erro && <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-inset ring-amber-100">{erro}</p>}

        {!dados && !erro && (
          <p className="flex items-center gap-2 py-10 text-sm text-zinc-500">
            <Loader2 size={15} className="animate-spin" /> Juntando os pontos…
          </p>
        )}

        {dados && (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <StatTile label="Pediram para cancelar" value={dados.resumo.clientes} hint="clientes" icon={Users} onClick={() => setVer("todos")} ativo={ver === "todos"} />
              <StatTile label="Retidos" value={dados.resumo.retidos} hint="ficaram" icon={ShieldCheck} tone="success" onClick={() => setVer("retido")} ativo={ver === "retido"} />
              <StatTile label="Cancelados" value={dados.resumo.cancelados} hint="saíram" icon={UserRoundX} tone="danger" onClick={() => setVer("cancelado")} ativo={ver === "cancelado"} />
              <StatTile label="Em aberto" value={dados.resumo.emAberto} hint="sem desfecho ainda" icon={UserMinus} tone="warning" onClick={() => setVer("em-aberto")} ativo={ver === "em-aberto"} />
              <StatTile
                label="Retenção"
                value={pct(dados.resumo.taxaDeRetencao)}
                hint="retidos sobre quem teve desfecho"
                description="Retidos ÷ (retidos + cancelados). Os em aberto ficam fora até terem desfecho."
                icon={ShieldCheck}
                tone="success"
              />
            </div>

            <SurfaceCard title="Por mês do pedido" description="O mês do primeiro sinal de cancelamento de cada cliente.">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-left text-sm">
                  <thead className="text-[11px] uppercase tracking-wide text-zinc-400">
                    <tr>
                      <th className="py-1.5 pr-3 font-semibold">Mês</th>
                      <th className="py-1.5 pr-3 font-semibold">Pediram</th>
                      <th className="py-1.5 pr-3 font-semibold">Retidos</th>
                      <th className="py-1.5 pr-3 font-semibold">Cancelados</th>
                      <th className="py-1.5 pr-3 font-semibold">Em aberto</th>
                      <th className="py-1.5 font-semibold">Retenção</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 tabular-nums">
                    {dados.resumo.porMes.slice(0, 12).map((m) => (
                      <tr key={m.mes}>
                        <td className="py-1.5 pr-3 font-medium text-zinc-800">{mes(m.mes)}</td>
                        <td className="py-1.5 pr-3">{m.clientes}</td>
                        <td className="py-1.5 pr-3 text-emerald-700">{m.retidos}</td>
                        <td className="py-1.5 pr-3 text-rose-700">{m.cancelados}</td>
                        <td className="py-1.5 pr-3 text-amber-800">{m.emAberto}</td>
                        <td className="py-1.5">{pct(m.retidos + m.cancelados ? m.retidos / (m.retidos + m.cancelados) : null)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SurfaceCard>

            <SurfaceCard
              title={ver === "todos" ? "Todos os clientes" : ROTULO[ver]}
              description="Os pontos que colocaram cada cliente aqui e o que decidiu o desfecho. Se estiver errado, corrija — a correção fica gravada."
            >
              {visiveis.length === 0 ? (
                <p className="text-sm text-zinc-500">Nenhum cliente nesta situação.</p>
              ) : (
                <ul className="divide-y divide-zinc-100">
                  {visiveis.map((c) => (
                    <li key={c.chave} className="py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-zinc-900">{c.nome}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${COR[c.desfecho]}`}>{ROTULO[c.desfecho]}</span>
                        <span className="text-xs text-zinc-400">desde {mes(c.desde.slice(0, 7))}</span>
                        {c.protocolos.slice(0, 3).map((p) => (
                          <Link key={p} href={`/reclame-aqui/${encodeURIComponent(p)}`} className="font-mono text-xs text-violet-700 hover:underline">
                            {p}
                          </Link>
                        ))}
                        <span className="ml-auto flex flex-wrap gap-1">
                          {(["retido", "cancelado"] as const)
                            .filter((d) => d !== c.desfecho || !c.manual)
                            .map((d) => (
                              <button
                                key={d}
                                type="button"
                                disabled={gravando === c.chave}
                                onClick={() => void marcar(c, d)}
                                className="rounded-md px-2 py-0.5 text-xs font-medium text-zinc-600 ring-1 ring-inset ring-zinc-200 hover:bg-zinc-50 disabled:opacity-40"
                              >
                                {d === "retido" ? "Retido" : "Cancelado"}
                              </button>
                            ))}
                          <button
                            type="button"
                            disabled={gravando === c.chave}
                            onClick={() => void marcar(c, "nao-e-cancelamento")}
                            className="rounded-md px-2 py-0.5 text-xs font-medium text-zinc-500 hover:bg-zinc-50 disabled:opacity-40"
                          >
                            Não é cancelamento
                          </button>
                          {c.manual && (
                            <button type="button" disabled={gravando === c.chave} onClick={() => void marcar(c, null)} className="rounded-md px-2 py-0.5 text-xs text-violet-700 hover:underline disabled:opacity-40">
                              voltar ao automático
                            </button>
                          )}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-zinc-600">
                        <span className="font-semibold text-zinc-700">Por quê: </span>
                        {c.porque}
                      </p>
                      <ul className="mt-1 space-y-0.5">
                        {c.sinais.slice(0, 4).map((s, i) => (
                          <li key={i} className="text-xs text-zinc-500">
                            <span className="font-medium text-zinc-600">{FRENTE[s.frente]} · {s.tipo}</span> — {s.trecho}
                          </li>
                        ))}
                        {c.sinais.length > 4 && <li className="text-xs text-zinc-400">e mais {c.sinais.length - 4} ponto(s)</li>}
                      </ul>
                    </li>
                  ))}
                </ul>
              )}
            </SurfaceCard>
          </>
        )}
      </div>
    </MainLayout>
  );
}
