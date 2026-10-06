"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Loader2, ShieldCheck, UserMinus, UserRoundX, Users } from "lucide-react";

import MainLayout from "@/components/layout/MainLayout";
import PageHeading from "@/components/shared/PageHeading";
import StatTile from "@/components/shared/StatTile";
import SurfaceCard from "@/components/shared/SurfaceCard";

import { lerRetencao, marcarDesfecho } from "@/lib/actions/retencao";
import type { ReclamacaoComRisco } from "@/lib/services/cancelamento.service";
import { ROTULO_DO_NIVEL } from "@/lib/models/riscoDeCancelamento";
import { useToast } from "@/lib/context/ToastContext";
import { resumoDeRetencao, type ClienteEmCancelamento, type Desfecho, type DesfechoManual, type ResumoDeRetencao } from "@/lib/models/cancelamento";
import { ROTULO_DO_RISCO, type ClienteEmRisco } from "@/lib/models/clienteEmRisco";
import { pluralDe } from "@/lib/plural";

const ROTULO: Record<Desfecho, string> = { retido: "Retido", cancelado: "Cancelado", "em-aberto": "Em aberto" };
const COR: Record<Desfecho, string> = {
  retido: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  cancelado: "bg-rose-50 text-rose-800 ring-rose-200",
  "em-aberto": "bg-amber-50 text-amber-900 ring-amber-200",
};
const FRENTE: Record<string, string> = { "reclame-aqui": "RA", redes: "Redes", nps: "NPS", conversa: "WhatsApp" };
const MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const mes = (aaaamm: string) => `${MES[Number(aaaamm.slice(5, 7)) - 1]}/${aaaamm.slice(2, 4)}`;
const COR_DO_RISCO: Record<ReclamacaoComRisco["risco"]["nivel"], string> = {
  alto: "bg-rose-50 text-rose-800 ring-rose-200",
  medio: "bg-amber-50 text-amber-900 ring-amber-200",
  baixo: "bg-zinc-50 text-zinc-600 ring-zinc-200",
  cancelou: "bg-zinc-800 text-white ring-zinc-800",
};
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
  const [dados, setDados] = useState<{ clientes: ClienteEmCancelamento[]; resumo: ResumoDeRetencao; emRisco: ClienteEmRisco[]; reclamacoes: ReclamacaoComRisco[] } | null>(null);
  /* O período (1.113): as reclamações antigas distorciam a conta — o padrão é o semestre. */
  const [periodo, setPeriodo] = useState<6 | 12 | 0>(6);
  /* O instante de quando a tela abriu: o recorte não muda enquanto ela está aberta. */
  const [abertaEm] = useState(() => Date.now());
  const [erro, setErro] = useState<string | null>(null);
  const [ver, setVer] = useState<Desfecho | "todos">("em-aberto");
  const [gravando, setGravando] = useState<string | null>(null);

  async function carregar() {
    const r = await lerRetencao();
    if (!r.ok) setErro(r.erro);
    else {
      setErro(null);
      setDados({ clientes: r.clientes, resumo: r.resumo, emRisco: r.emRisco, reclamacoes: r.reclamacoes });
    }
  }

  useEffect(() => {
    let vivo = true;
    lerRetencao().then((r) => {
      if (!vivo) return;
      if (!r.ok) setErro(r.erro);
      else setDados({ clientes: r.clientes, resumo: r.resumo, emRisco: r.emRisco, reclamacoes: r.reclamacoes });
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

  const doPeriodo = useMemo(() => {
    if (!dados) return [];
    if (periodo === 0) return dados.clientes;
    const limite = new Date(abertaEm - periodo * 30.5 * 86_400_000).toISOString();
    return dados.clientes.filter((c) => c.desde >= limite);
  }, [dados, periodo, abertaEm]);
  const resumo = useMemo(() => resumoDeRetencao(doPeriodo), [doPeriodo]);
  const visiveis = useMemo(() => (ver === "todos" ? doPeriodo : doPeriodo.filter((c) => c.desfecho === ver)), [doPeriodo, ver]);

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
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex rounded-xl bg-zinc-100 p-1" role="tablist" aria-label="Período">
                {([6, 12, 0] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    role="tab"
                    aria-selected={periodo === p}
                    onClick={() => setPeriodo(p)}
                    className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${periodo === p ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-800"}`}
                  >
                    {p === 0 ? "Tudo" : `Últimos ${p} meses`}
                  </button>
                ))}
              </div>
              <p className="text-xs text-zinc-500">Pelo dia em que a reclamação chegou — não pelo dia em que entrou no CW.</p>
            </div>

            {/* A chance de cancelar, reclamação por reclamação (1.113): o que está aberto e pede ação agora. */}
            {dados.reclamacoes.length > 0 && (
              <SurfaceCard
                title={`Reclamações abertas com chance de cancelar · ${dados.reclamacoes.length}`}
                description="Os motivos saem do relato, da triagem, da repetição pelo CPF/CNPJ e do NPS da conta. Embaixo, o que fazer — retenção enquanto o cliente está, recuperação quando já saiu."
              >
                <ul className="divide-y divide-zinc-100">
                  {dados.reclamacoes.slice(0, 25).map((r) => (
                    <li key={r.id} className="py-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${COR_DO_RISCO[r.risco.nivel]}`}>{ROTULO_DO_NIVEL[r.risco.nivel]}</span>
                        <Link href={r.frente === "reclame-aqui" ? `/reclame-aqui/${r.id}` : `/redes-sociais/${r.id}`} className="min-w-0 truncate text-sm font-medium text-zinc-900 hover:text-violet-700">
                          {r.protocolo} · {r.cliente}
                        </Link>
                        <span className="text-xs text-zinc-400">
                          {r.status}
                          {r.responsavel ? ` · ${r.responsavel}` : " · sem responsável"}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-zinc-600">{r.risco.motivos.map((m) => m.texto).join(" · ")}</p>
                      {r.risco.atitudes.length > 0 && (
                        <ul className="mt-1 space-y-0.5">
                          {r.risco.atitudes.slice(0, 2).map((a) => (
                            <li key={a.id} className="text-xs text-zinc-700">
                              <span className="mr-1 font-semibold text-violet-700">{a.tipo === "recuperacao" ? "Recuperar:" : "Fazer:"}</span>
                              {a.texto}
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              </SurfaceCard>
            )}

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <StatTile label="Pediram para cancelar" value={resumo.clientes} hint="clientes" icon={Users} onClick={() => setVer("todos")} ativo={ver === "todos"} />
              <StatTile label="Retidos" value={resumo.retidos} hint="ficaram" icon={ShieldCheck} tone="success" onClick={() => setVer("retido")} ativo={ver === "retido"} />
              <StatTile
                label="Cancelados"
                value={resumo.cancelados}
                hint={resumo.canceladosNoPrazo ? `${resumo.canceladosNoPrazo} no prazo do contato — não contam` : "saíram"}
                icon={UserRoundX}
                tone="danger"
                onClick={() => setVer("cancelado")}
                ativo={ver === "cancelado"}
              />
              <StatTile label="Em aberto" value={resumo.emAberto} hint="sem desfecho ainda" icon={UserMinus} tone="warning" onClick={() => setVer("em-aberto")} ativo={ver === "em-aberto"} />
              <StatTile
                label="Retenção"
                value={pct(resumo.taxaDeRetencao)}
                hint="retidos sobre quem teve desfecho"
                description="Retidos ÷ (retidos + cancelados que contam). Quem cancelou antes do prazo do 1º contato (1 dia útil) — ou já chegou cancelado — não conta. Os em aberto ficam fora até terem desfecho."
                icon={ShieldCheck}
                tone="success"
              />
            </div>

            {/* Cliente em risco (1.101): dois ou mais sinais, antes do pedido de cancelamento. */}
            {dados.emRisco.length > 0 && (
              <SurfaceCard
                title={`Em risco agora · ${dados.emRisco.length}`}
                description="Dois ou mais sinais juntos no mesmo cliente — reclamação aberta, detrator no NPS, pedido de cancelamento, marca de churn, reincidência. É a hora de agir, antes do pedido."
              >
                <ul className="divide-y divide-zinc-100">
                  {dados.emRisco.slice(0, 20).map((c) => (
                    <li key={c.chave} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                      <span className="w-6 shrink-0 text-center text-sm font-semibold tabular-nums text-rose-700" title="Quantos sinais">{c.sinais.length}</span>
                      <span className="min-w-0 flex-1 basis-48">
                        <span className="block truncate text-sm font-medium text-zinc-800">{c.nome}</span>
                        <span className="block text-xs text-zinc-500">{c.sinais.map((s) => ROTULO_DO_RISCO[s]).join(" · ")}</span>
                      </span>
                      <span className="flex flex-wrap gap-1">
                        {c.protocolos.slice(0, 3).map((p) => (
                          <Link key={p} href={`/reclame-aqui/${encodeURIComponent(p)}`} className="rounded-md bg-zinc-100 px-1.5 py-0.5 font-mono text-[11px] text-zinc-700 hover:bg-violet-100">
                            {p}
                          </Link>
                        ))}
                        {c.nps.slice(0, 2).map((id) => (
                          <Link key={id} href={`/nps/${id}`} className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] text-amber-800 hover:bg-amber-100">
                            NPS
                          </Link>
                        ))}
                      </span>
                    </li>
                  ))}
                </ul>
              </SurfaceCard>
            )}

            <SurfaceCard title="Por mês do pedido" description="O mês do primeiro sinal de cancelamento de cada cliente.">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-left text-sm">
                  <thead className="text-[11px] uppercase tracking-wide text-zinc-400">
                    <tr>
                      <th className="py-1.5 pr-3 font-semibold">Mês</th>
                      <th className="py-1.5 pr-3 font-semibold">Pediram</th>
                      <th className="py-1.5 pr-3 font-semibold">Retidos</th>
                      <th className="py-1.5 pr-3 font-semibold">Cancelados</th>
                      <th className="py-1.5 pr-3 font-semibold" title="Cancelaram antes do prazo do 1º contato — não contam">No prazo</th>
                      <th className="py-1.5 pr-3 font-semibold">Em aberto</th>
                      <th className="py-1.5 font-semibold">Retenção</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 tabular-nums">
                    {resumo.porMes.slice(0, 12).map((m) => (
                      <tr key={m.mes}>
                        <td className="py-1.5 pr-3 font-medium text-zinc-800">{mes(m.mes)}</td>
                        <td className="py-1.5 pr-3">{m.clientes}</td>
                        <td className="py-1.5 pr-3 text-emerald-700">{m.retidos}</td>
                        <td className="py-1.5 pr-3 text-rose-700">{m.cancelados}</td>
                        <td className="py-1.5 pr-3 text-zinc-500">{m.canceladosNoPrazo || "—"}</td>
                        <td className="py-1.5 pr-3 text-amber-800">{m.emAberto}</td>
                        <td className="py-1.5">{pct(m.retidos + m.cancelados - m.canceladosNoPrazo ? m.retidos / (m.retidos + m.cancelados - m.canceladosNoPrazo) : null)}</td>
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
                        {c.canceladoNoPrazo && (
                          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600" title="Cancelou antes do prazo do 1º contato (1 dia útil) — não conta na retenção">
                            no prazo do contato · não conta
                          </span>
                        )}
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
                        {c.sinais.length > 4 && <li className="text-xs text-zinc-400">e mais {c.sinais.length - 4} {pluralDe(c.sinais.length - 4, "ponto", "pontos")}</li>}
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
