"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Building2, ChevronRight, Hourglass, Loader2, Search, ShieldCheck, UserRoundX } from "lucide-react";

import MainLayout from "@/components/layout/MainLayout";
import PageHeading from "@/components/shared/PageHeading";
import StatTile from "@/components/shared/StatTile";
import SurfaceCard from "@/components/shared/SurfaceCard";
import AnaliseDosCancelamentos from "@/components/retencao/AnaliseDosCancelamentos";
import DesfechoDoCliente from "@/components/retencao/DesfechoDoCliente";
import MarcaDeCancelamento from "@/components/retencao/MarcaDeCancelamento";

import { lerRetencao } from "@/lib/actions/retencao";
import OutrasReclamacoes from "@/components/retencao/OutrasReclamacoes";
import type { ReclamacaoComRisco, ReclamacaoForaDaConta } from "@/lib/services/cancelamento.service";
import { resumoDeRetencao, type ClienteEmCancelamento, type ResumoDeRetencao, type SinalDeCancelamento } from "@/lib/models/cancelamento";
import { ROTULO_DO_RISCO, type ClienteEmRisco } from "@/lib/models/clienteEmRisco";

const FRENTE: Record<SinalDeCancelamento["frente"], string> = { "reclame-aqui": "Reclame Aqui", redes: "Redes", nps: "NPS", conversa: "WhatsApp" };
const dia = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(2, 4)}`;
const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)}%`);
/* O trecho que é dado do sistema (categoria, marcação) não vai entre aspas: não é fala do cliente. */
const fala = (t: string) => (/^(categoria|causa raiz|reclamação adicionada|chegou cancelado|avaliou|solução|a nossa resposta|nossa resposta|comentário do caso)/.test(t) ? t : `“${t.replace(/^…|…$/g, "")}”`);
const linkDoCaso = (protocolo: string) => `/reclame-aqui/${encodeURIComponent(protocolo)}`;

type Filtro = "todos" | "retido" | "em-aberto" | "cancelado" | "outro-setor";
const POR_PAGINA = 30;

/**
 * Cancelamento e retenção (1.85; refeita em 20/10/2026).
 *
 * "Gente que coisa feia, tá muito bagunçado e cheio de informação sem
 * sentido." A tela agora responde três perguntas, nesta ordem: quanto
 * retemos (os quatro números), quem queria cancelar e como terminou (a
 * lista, uma linha por cliente, o desfecho num botão só) e o que pede
 * atenção agora (a coluna da direita). Os sinais e o porquê ficam ao abrir
 * a linha; as atitudes sugeridas continuam na ficha do caso.
 */
export default function RetencaoPage() {
  const [dados, setDados] = useState<{ clientes: ClienteEmCancelamento[]; emRisco: ClienteEmRisco[]; reclamacoes: ReclamacaoComRisco[]; foraDaConta: ReclamacaoForaDaConta[] } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  /* O período (1.113): as reclamações antigas distorciam a conta — o padrão é o semestre. */
  const [periodo, setPeriodo] = useState<6 | 12 | 0>(6);
  const [abertaEm] = useState(() => Date.now());
  const [ver, setVer] = useState<Filtro>("todos");
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState<string | null>(null);
  const [limite, setLimite] = useState(POR_PAGINA);
  const [nova, setNova] = useState("");

  async function carregar() {
    const r = await lerRetencao();
    if (!r.ok) setErro(r.erro);
    else {
      setErro(null);
      setDados({ clientes: r.clientes, emRisco: r.emRisco, reclamacoes: r.reclamacoes, foraDaConta: r.foraDaConta });
    }
  }

  useEffect(() => {
    let vivo = true;
    lerRetencao().then((r) => {
      if (!vivo) return;
      if (!r.ok) setErro(r.erro);
      else setDados({ clientes: r.clientes, emRisco: r.emRisco, reclamacoes: r.reclamacoes, foraDaConta: r.foraDaConta });
    });
    return () => {
      vivo = false;
    };
  }, []);

  const doPeriodo = useMemo(() => {
    if (!dados) return [];
    if (periodo === 0) return dados.clientes;
    const de = new Date(abertaEm - periodo * 30.5 * 86_400_000).toISOString();
    return dados.clientes.filter((c) => c.desde >= de);
  }, [dados, periodo, abertaEm]);
  const resumo: ResumoDeRetencao = useMemo(() => resumoDeRetencao(doPeriodo), [doPeriodo]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return doPeriodo.filter((c) => {
      if (ver === "retido" && c.desfecho !== "retido") return false;
      if (ver === "em-aberto" && c.desfecho !== "em-aberto") return false;
      if (ver === "cancelado" && c.desfecho !== "cancelado") return false;
      if (ver === "outro-setor" && c.canceladoPor !== "outro-setor") return false;
      return !termo || c.nome.toLowerCase().includes(termo) || c.protocolos.some((p) => p.toLowerCase().includes(termo));
    });
  }, [doPeriodo, ver, busca]);

  const filtrar = (f: Filtro) => {
    setVer((atual) => (atual === f ? "todos" : f));
    setLimite(POR_PAGINA);
  };

  const FILTROS: { id: Filtro; nome: string; n: number }[] = [
    { id: "todos", nome: "Todos", n: resumo.clientes },
    { id: "retido", nome: "Retidos", n: resumo.retidos },
    { id: "em-aberto", nome: "Em aberto", n: resumo.emAberto },
    { id: "cancelado", nome: "Cancelaram", n: resumo.cancelados },
    { id: "outro-setor", nome: "Outro setor", n: resumo.canceladosOutroSetor },
  ];

  return (
    <MainLayout>
      <div className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <PageHeading eyebrow="Inteligência" title="Cancelamento e retenção" description="Quem pediu para cancelar, quem ficou e quem saiu." />
          <div className="inline-flex rounded-xl bg-zinc-100 p-1" role="tablist" aria-label="Período">
            {([6, 12, 0] as const).map((p) => (
              <button
                key={p}
                type="button"
                role="tab"
                aria-selected={periodo === p}
                onClick={() => {
                  setPeriodo(p);
                  setLimite(POR_PAGINA);
                }}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${periodo === p ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-800"}`}
              >
                {p === 0 ? "Tudo" : `${p} meses`}
              </button>
            ))}
          </div>
        </div>

        {erro && <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-inset ring-amber-100">{erro}</p>}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <StatTile
            label="Retenção"
            value={pct(resumo.taxaDeRetencao)}
            hint={dados ? `${resumo.retidos} de ${resumo.retidos + resumo.canceladosQueContam} ficaram` : undefined}
            description="Retidos ÷ (retidos + cancelados por nós). Ficam fora da taxa: quem ainda está em aberto, o cancelado por outro setor dentro da SLA de 24h úteis e quem já chegou cancelado."
            icon={ShieldCheck}
            tone="success"
            carregando={!dados}
          />
          <StatTile
            label="Retidos"
            value={resumo.retidos}
            hint="pediram e ficaram"
            icon={ShieldCheck}
            tone="success"
            onClick={() => filtrar("retido")}
            ativo={ver === "retido"}
            carregando={!dados}
          />
          <StatTile
            label="Em aberto"
            value={resumo.emAberto}
            hint="ainda sem desfecho"
            description="Pediram para cancelar e ainda estão em tratativa — reclamação aberta, pedido recente ou marcado à mão. Ficam fora da taxa até ficarem ou saírem."
            icon={Hourglass}
            tone="warning"
            onClick={() => filtrar("em-aberto")}
            ativo={ver === "em-aberto"}
            carregando={!dados}
          />
          <StatTile
            label="Cancelamentos"
            value={resumo.cancelados}
            hint={`${resumo.canceladosQueContam} pelo atendimento`}
            description={`Todos os que saíram: ${resumo.canceladosQueContam} pelo nosso atendimento, ${resumo.canceladosOutroSetor} por outro setor${resumo.canceladosNoPrazo ? ` e ${resumo.canceladosNoPrazo} antes do prazo do 1º contato` : ""}.`}
            icon={UserRoundX}
            tone="danger"
            onClick={() => filtrar("cancelado")}
            ativo={ver === "cancelado"}
            carregando={!dados}
          />
          <StatTile
            label="Por outro setor"
            value={resumo.canceladosOutroSetor}
            hint="no total, fora da taxa"
            description="Cancelados por outro setor (Financeiro, Comercial, Suporte…) dentro da SLA de 24h úteis, ou que já chegaram cancelados. Entram no total de cancelamentos, fora da taxa."
            icon={Building2}
            tone="info"
            onClick={() => filtrar("outro-setor")}
            ativo={ver === "outro-setor"}
            carregando={!dados}
          />
        </div>

        {/* Por que pedem, mês a mês, por onde, quem cancelou e em quanto tempo. */}
        {dados && <AnaliseDosCancelamentos clientes={doPeriodo} resumo={resumo} />}

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          {/* Quem queria cancelar — uma linha por cliente, o desfecho num botão só. */}
          <SurfaceCard bodyClassName="p-0">
            <div className="flex flex-wrap items-center gap-2 border-b border-zinc-100 px-5 py-3">
              <div className="flex flex-wrap gap-1" role="tablist" aria-label="Filtro">
                {FILTROS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    role="tab"
                    aria-selected={ver === f.id}
                    onClick={() => (f.id === "todos" ? setVer("todos") : filtrar(f.id))}
                    className={`rounded-lg px-2.5 py-1 text-sm transition-colors ${ver === f.id ? "bg-zinc-900 font-medium text-white" : "text-zinc-600 hover:bg-zinc-100"}`}
                  >
                    {f.nome} <span className="tabular-nums opacity-60">{dados ? f.n : ""}</span>
                  </button>
                ))}
              </div>
              <label className="ml-auto flex min-w-[180px] flex-1 items-center gap-2 rounded-lg border border-zinc-200 px-2.5 py-1.5 sm:max-w-[240px]">
                <Search size={14} className="text-zinc-400" />
                <input
                  value={busca}
                  onChange={(e) => {
                    setBusca(e.target.value);
                    setLimite(POR_PAGINA);
                  }}
                  placeholder="Cliente ou protocolo"
                  className="w-full bg-transparent text-sm text-zinc-800 outline-none placeholder:text-zinc-400"
                />
              </label>
            </div>

            {/* Uma reclamação que a leitura não pegou: protocolo ou link, e as três perguntas. */}
            <div className="flex flex-wrap items-center gap-2 border-b border-zinc-100 bg-zinc-50/60 px-5 py-2.5">
              <span className="text-xs font-medium text-zinc-500">Faltou alguém?</span>
              <input
                value={nova}
                onChange={(e) => setNova(e.target.value)}
                placeholder="Protocolo (RA-…) ou link do Reclame Aqui"
                className="min-w-[200px] flex-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-sm text-zinc-800 outline-none placeholder:text-zinc-400 focus:border-zinc-400"
              />
              <MarcaDeCancelamento
                protocolo={nova}
                rotuloDoBotao="Adicionar"
                onMudou={() => {
                  setNova("");
                  void carregar();
                }}
              />
            </div>

            {!dados && !erro ? (
              <p className="flex items-center gap-2 px-5 py-10 text-sm text-zinc-500">
                <Loader2 size={15} className="animate-spin" /> Juntando reclamações, NPS e conversas…
              </p>
            ) : filtrados.length === 0 ? (
              <p className="px-5 py-10 text-sm text-zinc-500">{busca ? "Ninguém com esse nome ou protocolo." : "Ninguém nesta situação no período."}</p>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {filtrados.slice(0, limite).map((c) => {
                  const expandido = aberto === c.chave;
                  const outros = c.sinais.filter((s) => s !== c.pedido);
                  return (
                    <li key={c.chave} className="px-5 py-3">
                      <div className="flex items-start gap-3">
                        <button
                          type="button"
                          onClick={() => setAberto(expandido ? null : c.chave)}
                          aria-expanded={expandido}
                          className="mt-0.5 rounded p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                          aria-label={expandido ? "Esconder detalhes" : "Ver detalhes"}
                        >
                          <ChevronRight size={15} className={`transition-transform ${expandido ? "rotate-90" : ""}`} />
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className="flex flex-wrap items-baseline gap-x-2">
                            <span className="font-medium text-zinc-900">{c.nome}</span>
                            {/* A marcação à mão contra a nossa própria resposta: para conferir. */}
                            {c.conflito && (
                              <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-900" title={c.conflito}>
                                conferir
                              </span>
                            )}
                            <span className="text-xs text-zinc-400">
                              {c.pedido ? `pediu em ${dia(c.pedido.quando)} · ${FRENTE[c.pedido.frente]}` : `chegou cancelado · ${dia(c.desde)}`}
                            </span>
                          </p>
                          {c.pedido && (
                            <p className="mt-0.5 truncate text-sm text-zinc-600" title={c.pedido.trecho}>
                              {fala(c.pedido.trecho)}
                            </p>
                          )}
                        </div>
                        <DesfechoDoCliente cliente={c} onMudou={() => void carregar()} />
                      </div>

                      {expandido && (
                        <div className="ml-8 mt-2 space-y-1.5 rounded-lg bg-zinc-50 px-3 py-2.5 text-xs text-zinc-600">
                          <p>
                            <span className="font-medium text-zinc-800">{c.desfecho === "retido" ? "Por que ficou: " : c.desfecho === "em-aberto" ? "Situação: " : "Por que saiu: "}</span>
                            {c.porque}
                          </p>
                          {outros.length > 0 && (
                            <ul className="space-y-0.5">
                              {outros.slice(0, 5).map((s, i) => (
                                <li key={i}>
                                  <span className="text-zinc-400">
                                    {dia(s.quando)} · {FRENTE[s.frente]} ·{" "}
                                  </span>
                                  {fala(s.trecho)}
                                </li>
                              ))}
                            </ul>
                          )}
                          {c.protocolos.length > 0 && (
                            <p className="flex flex-wrap gap-2 pt-0.5">
                              {c.protocolos.map((p) => (
                                <Link key={p} href={linkDoCaso(p)} className="font-mono text-violet-700 hover:underline">
                                  {p}
                                </Link>
                              ))}
                            </p>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {filtrados.length > limite && (
              <button
                type="button"
                onClick={() => setLimite((l) => l + POR_PAGINA)}
                className="w-full border-t border-zinc-100 px-5 py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50"
              >
                Mostrar mais {Math.min(POR_PAGINA, filtrados.length - limite)} de {filtrados.length - limite}
              </button>
            )}
          </SurfaceCard>

          <div className="space-y-5">
            {/* O que pede atenção agora — nomes e o motivo principal; o que fazer está na ficha do caso. */}
            {dados && (dados.reclamacoes.length > 0 || dados.emRisco.length > 0) && (
              <SurfaceCard title="Atenção agora" bodyClassName="pt-1">
                {dados.reclamacoes.length > 0 && (
                  <>
                    <p className="pb-1 text-[11px] font-medium uppercase tracking-wide text-zinc-400">Chance de cancelar</p>
                    <ul className="mb-3 space-y-2">
                      {dados.reclamacoes.slice(0, 6).map((r) => (
                        <li key={r.id} className="flex items-start gap-2">
                          <span
                            className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${r.risco.nivel === "alto" ? "bg-rose-500" : r.risco.nivel === "cancelou" ? "bg-zinc-700" : "bg-amber-400"}`}
                            title={r.risco.nivel === "alto" ? "Chance alta" : r.risco.nivel === "cancelou" ? "Já cancelou" : "Chance média"}
                          />
                          <span className="min-w-0">
                            <Link href={r.frente === "reclame-aqui" ? `/reclame-aqui/${r.id}` : `/redes-sociais/${r.id}`} className="block truncate text-sm font-medium text-zinc-800 hover:text-violet-700">
                              {r.cliente}
                            </Link>
                            <span className="block truncate text-xs text-zinc-500">{r.risco.motivos[0]?.texto}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                {dados.emRisco.length > 0 && (
                  <>
                    <p className="pb-1 text-[11px] font-medium uppercase tracking-wide text-zinc-400">Cliente em risco</p>
                    <ul className="space-y-2">
                      {dados.emRisco.slice(0, 6).map((c) => (
                        <li key={c.chave} className="min-w-0">
                          {c.protocolos[0] ? (
                            <Link href={linkDoCaso(c.protocolos[0])} className="block truncate text-sm font-medium text-zinc-800 hover:text-violet-700">
                              {c.nome}
                            </Link>
                          ) : (
                            <span className="block truncate text-sm font-medium text-zinc-800">{c.nome}</span>
                          )}
                          <span className="block truncate text-xs text-zinc-500">{c.sinais.map((s) => ROTULO_DO_RISCO[s]).join(" · ")}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </SurfaceCard>
            )}

          </div>
        </div>

        {/* Qualquer reclamação, para adicionar à conta quando o cliente pediu para cancelar. */}
        {dados && <OutrasReclamacoes reclamacoes={dados.foraDaConta} onMudou={() => void carregar()} />}
      </div>
    </MainLayout>
  );
}
