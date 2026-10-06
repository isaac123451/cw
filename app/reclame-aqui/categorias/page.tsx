"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import Link from "next/link";

import { ArrowRight, CheckCircle2, CircleAlert, Loader2, Sparkles, Undo2 } from "lucide-react";

import MainLayout from "@/components/layout/MainLayout";
import PageHeading from "@/components/shared/PageHeading";
import SurfaceCard from "@/components/shared/SurfaceCard";
import ModuleNav from "@/components/reclame-aqui/ModuleNav";

import { decidirPropostasDeCategoria, desfazerReclassificacao, lerRevisaoDeCategorias, unificarNasOficiais, type RevisaoDeCategorias } from "@/lib/actions/revisaoDeCategorias";
import { useSettings } from "@/lib/context/SettingsContext";
import { useToast } from "@/lib/context/ToastContext";
import type { PropostaNaTela } from "@/lib/services/propostaDeCategoria.service";
import { pluralDe } from "@/lib/plural";

const br = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");
const LOTE_DA_TELA = 60;

const CONFIANCA: Record<string, { rotulo: string; classe: string }> = {
  alta: { rotulo: "alta", classe: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  media: { rotulo: "média", classe: "bg-amber-50 text-amber-700 ring-amber-200" },
  baixa: { rotulo: "baixa", classe: "bg-zinc-100 text-zinc-600 ring-zinc-200" },
};

function mudaCategoria(p: PropostaNaTela) {
  return (p.atual.categoria ?? "") !== p.proposta.categoria;
}

function classificacao(c: { categoria: string | null; subcategoria: string | null }) {
  if (!c.categoria) return "sem categoria";
  return c.subcategoria ? `${c.categoria} › ${c.subcategoria}` : c.categoria;
}

/**
 * A revisão das categorias (1.132).
 *
 * "Ajeite também a parte de categorias de reclamações, os dados estão
 * incorretos" — e a escolha dele: unificar nas da documentação e a IA
 * propor a categoria certa de cada uma, para ele aprovar. Três passos na
 * ordem em que precisam acontecer, e o histórico com o desfazer.
 */
export default function CategoriasPage() {

  const { notify } = useToast();
  const { aplicarCategorias } = useSettings();

  const [revisao, setRevisao] = useState<RevisaoDeCategorias | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState<null | "unificar" | "aceitar" | "recusar" | { lote: string }>(null);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [filtroConfianca, setFiltroConfianca] = useState<string>("todas");
  const [filtroCategoria, setFiltroCategoria] = useState<string>("todas");
  const [filtroTipo, setFiltroTipo] = useState<"todas" | "categoria" | "subcategoria">("categoria");
  const [mostrar, setMostrar] = useState(LOTE_DA_TELA);
  const [andamento, setAndamento] = useState<{ feitas: number; total: number; diferentes: number } | null>(null);
  const parar = useRef(false);

  const recarregar = useCallback(async () => {
    const r = await lerRevisaoDeCategorias();
    if (r.ok) {
      setRevisao(r.revisao);
      setErro(null);
    } else setErro(r.erro);
  }, []);

  useEffect(() => {
    let vivo = true;
    lerRevisaoDeCategorias().then((r) => {
      if (!vivo) return;
      if (r.ok) setRevisao(r.revisao);
      else setErro(r.erro);
    });
    return () => {
      vivo = false;
    };
  }, []);

  const pendentes = useMemo(() => revisao?.propostas.pendentes ?? [], [revisao]);
  const filtradas = useMemo(
    () =>
      pendentes.filter(
        (p) =>
          (filtroConfianca === "todas" || p.confianca === filtroConfianca) &&
          (filtroCategoria === "todas" || p.proposta.categoria === filtroCategoria) &&
          (filtroTipo === "todas" || (filtroTipo === "categoria") === mudaCategoria(p))
      ),
    [pendentes, filtroConfianca, filtroCategoria, filtroTipo]
  );
  /* "De → para" das que mudam a categoria: o que a aprovação faz com a distribuição. */
  const fluxos = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of pendentes.filter(mudaCategoria)) {
      const k = `${p.atual.categoria ?? "sem categoria"} → ${p.proposta.categoria}`;
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return [...m].sort((a, b) => b[1] - a[1]);
  }, [pendentes]);
  const quantasMudamCategoria = useMemo(() => pendentes.filter(mudaCategoria).length, [pendentes]);
  const categoriasPropostas = useMemo(() => [...new Set(pendentes.map((p) => p.proposta.categoria))].sort(), [pendentes]);

  const unificacaoPendente = Boolean(revisao && (revisao.unificacao.trocas > 0 || revisao.unificacao.movimentos.some((m) => m.casos > 0)));
  const pode = Boolean(revisao?.podeMudar);
  const s = revisao?.propostas.porStatus ?? {};

  async function unificar() {
    setConfirmar(null);
    setOcupado("unificar");
    const r = await unificarNasOficiais();
    setOcupado(null);
    if (!r.ok) {
      notify({ tone: "error", title: "A unificação não foi gravada.", detail: r.erro });
      return;
    }
    aplicarCategorias(r.categorias, r.subcategorias);
    notify({ tone: "success", title: "Categorias unificadas.", detail: `${r.casos} ${pluralDe(r.casos, "reclamação", "reclamações")} mudaram de categoria ou subcategoria; ${r.categoriasDesativadas} ${pluralDe(r.categoriasDesativadas, "categoria", "categorias")} e ${r.subcategoriasJuntadas} ${pluralDe(r.subcategoriasJuntadas, "subcategoria", "subcategorias")} ficaram desativadas. Dá para desfazer no histórico.` });
    await recarregar();
  }

  async function classificar() {
    if (!revisao) return;
    parar.current = false;
    const total = revisao.propostas.semProposta;
    let feitas = 0;
    let diferentes = 0;
    setAndamento({ feitas, total, diferentes });
    while (!parar.current) {
      let r: { ok: boolean; erro?: string; classificadas: number; diferentes: number; restantes: number };
      try {
        const resposta = await fetch("/api/reclame-aqui/categorias/propor", { method: "POST" });
        r = await resposta.json();
      } catch {
        r = { ok: false, erro: "A conexão caiu no meio — o que já foi classificado está guardado.", classificadas: 0, diferentes: 0, restantes: 0 };
      }
      if (!r.ok) {
        notify({ tone: "error", title: "A IA parou.", detail: `${r.erro ?? "Sem resposta."} O que já foi classificado está guardado; é só continuar.` });
        break;
      }
      feitas += r.classificadas;
      diferentes += r.diferentes;
      setAndamento({ feitas, total, diferentes });
      if (r.restantes === 0 || r.classificadas === 0) break;
    }
    setAndamento(null);
    await recarregar();
  }

  async function decidir(decisao: "aceitar" | "recusar") {
    const ids = [...selecionadas];
    setConfirmar(null);
    setOcupado(decisao);
    const r = await decidirPropostasDeCategoria({ ids, decisao });
    setOcupado(null);
    if (!r.ok) {
      notify({ tone: "error", title: "Nada foi gravado.", detail: r.erro });
      return;
    }
    aplicarCategorias(r.categorias, r.subcategorias);
    setSelecionadas(new Set());
    notify({
      tone: "success",
      title: decisao === "aceitar" ? `${r.aplicadas} ${pluralDe(r.aplicadas, "reclamação", "reclamações")} ${pluralDe(r.aplicadas, "reclassificada", "reclassificadas")}.` : `${r.recusadas} ${pluralDe(r.recusadas, "proposta", "propostas")} ${pluralDe(r.recusadas, "recusada", "recusadas")}.`,
      detail: r.desatualizadas ? `${r.desatualizadas} tinham mudado depois da proposta e voltaram para a fila da IA — nada foi aplicado por cima.` : undefined,
    });
    await recarregar();
  }

  async function desfazer(lote: string) {
    setConfirmar(null);
    setOcupado(lote);
    const r = await desfazerReclassificacao(lote);
    setOcupado(null);
    if (!r.ok) {
      notify({ tone: "error", title: "Nada foi desfeito.", detail: r.erro });
      return;
    }
    aplicarCategorias(r.categorias, r.subcategorias);
    notify({ tone: "success", title: `${r.desfeitas} ${pluralDe(r.desfeitas, "troca", "trocas")} ${pluralDe(r.desfeitas, "desfeita", "desfeitas")}.`, detail: r.preservadas ? `${r.preservadas} ${pluralDe(r.preservadas, "reclamação", "reclamações")} tinham sido mudadas depois e ficaram como estão.` : undefined });
    await recarregar();
  }

  const alternar = (id: string) =>
    setSelecionadas((atual) => {
      const nova = new Set(atual);
      if (nova.has(id)) nova.delete(id);
      else nova.add(id);
      return nova;
    });

  return (
    <MainLayout>
      <div className="space-y-5">
        <PageHeading
          eyebrow="Reclame Aqui"
          title="Categorias"
          description="As categorias das reclamações, na lista da documentação e com a classificação revisada: unificar o que veio duplicado, a IA propõe a categoria certa de cada uma, e só muda o que for aprovado."
        />

        <ModuleNav />

        {erro && <p className="rounded-xl bg-rose-50 px-4 py-2.5 text-sm text-rose-700 ring-1 ring-inset ring-rose-200">{erro}</p>}
        {!revisao && !erro && (
          <p className="flex items-center gap-2 text-sm text-zinc-500">
            <Loader2 size={15} className="animate-spin" /> Lendo as categorias…
          </p>
        )}

        {revisao && (
          <>
            {!pode && (
              <p className="rounded-xl bg-zinc-50 px-4 py-2.5 text-sm text-zinc-600 ring-1 ring-inset ring-zinc-200">
                Você vê a revisão; unificar, aceitar e desfazer são de administrador.
              </p>
            )}

            {/* 1. Unificar. */}
            <SurfaceCard
              title="1. Unificar nas categorias da documentação"
              description="As categorias que vieram da planilha do portal passam para a oficial delas, e as subcategorias repetidas viram uma só. As de origem ficam desativadas — nada é excluído."
            >
              {unificacaoPendente ? (
                <div className="space-y-3">
                  <ul className="grid grid-cols-1 gap-1.5 text-sm md:grid-cols-2">
                    {revisao.unificacao.movimentos.map((m) => (
                      <li key={m.nome} className="flex items-center gap-2 rounded-lg bg-zinc-50 px-3 py-1.5 ring-1 ring-inset ring-zinc-200">
                        <span className="min-w-0 truncate text-zinc-700">{m.nome}</span>
                        <span className="shrink-0 tabular-nums text-xs text-zinc-500">{m.casos}</span>
                        <ArrowRight size={13} className="shrink-0 text-zinc-400" />
                        <span className="shrink-0 font-medium text-zinc-900">{m.para}</span>
                      </li>
                    ))}
                  </ul>
                  {revisao.unificacao.fusoes.length > 0 && (
                    <details className="text-sm text-zinc-600">
                      <summary className="cursor-pointer">{revisao.unificacao.fusoes.length} {pluralDe(revisao.unificacao.fusoes.length, "grupo", "grupos")} de subcategorias repetidas viram uma só</summary>
                      <ul className="mt-2 space-y-1">
                        {revisao.unificacao.fusoes.map((f) => (
                          <li key={`${f.categoria}-${f.fica}`}>
                            <span className="text-zinc-500">{f.categoria}:</span> fica <b className="font-medium text-zinc-800">{f.fica}</b> ← {f.saem.map((x) => `${x.nome} (${x.casos})`).join(", ")}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    {confirmar === "unificar" ? (
                      <>
                        <span className="text-sm text-zinc-700">{revisao.unificacao.trocas} {pluralDe(revisao.unificacao.trocas, "reclamação", "reclamações")} mudam de categoria ou subcategoria. Confirmar?</span>
                        <button type="button" onClick={unificar} className="rounded-lg bg-violet-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-800">
                          Confirmar
                        </button>
                        <button type="button" onClick={() => setConfirmar(null)} className="rounded-lg px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100">
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        disabled={!pode || ocupado !== null}
                        onClick={() => setConfirmar("unificar")}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-violet-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-800 disabled:opacity-50"
                      >
                        {ocupado === "unificar" && <Loader2 size={14} className="animate-spin" />}
                        Unificar
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <p className="flex items-center gap-1.5 text-sm text-emerald-700">
                  <CheckCircle2 size={15} /> Todas as reclamações estão nas categorias da documentação, sem subcategoria repetida.
                </p>
              )}
            </SurfaceCard>

            {/* 2. A IA. */}
            <SurfaceCard
              title="2. A IA lê cada relato e propõe a categoria"
              description="Escolhe pelo problema principal de que o cliente reclama — quem reclama do sistema parado e cita o suporte é Sistema, não Atendimento. Só fica proposto; nada muda sem aprovação."
            >
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-zinc-600">
                <span>
                  <b className="tabular-nums text-zinc-900">{revisao.propostas.totalDoReclameAqui - revisao.propostas.semProposta}</b> de{" "}
                  <span className="tabular-nums">{revisao.propostas.totalDoReclameAqui}</span> lidas pela IA
                </span>
                <span>
                  <b className="tabular-nums text-zinc-900">{s.igual ?? 0}</b> já estavam certas
                </span>
                <span>
                  <b className="tabular-nums text-zinc-900">{s.pendente ?? 0}</b> esperando decisão
                </span>
                <span>
                  <b className="tabular-nums text-zinc-900">{s.aceita ?? 0}</b> aceitas · <b className="tabular-nums text-zinc-900">{s.recusada ?? 0}</b> recusadas
                </span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {andamento ? (
                  <>
                    <span className="flex items-center gap-2 text-sm text-zinc-700">
                      <Loader2 size={15} className="animate-spin" />
                      Lendo {andamento.feitas} de {andamento.total} · {andamento.diferentes} com outra categoria
                    </span>
                    <button type="button" onClick={() => (parar.current = true)} className="rounded-lg px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100">
                      Parar
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    disabled={!pode || unificacaoPendente || revisao.propostas.semProposta === 0 || ocupado !== null}
                    onClick={classificar}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-violet-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-800 disabled:opacity-50"
                  >
                    <Sparkles size={14} />
                    {revisao.propostas.semProposta > 0 ? `Classificar ${revisao.propostas.semProposta} com a IA` : "Todas já foram lidas"}
                  </button>
                )}
                {unificacaoPendente && <span className="text-xs text-zinc-500">Unifique primeiro — a IA escolhe entre as subcategorias já sem repetição.</span>}
              </div>
            </SurfaceCard>

            {/* 3. Decidir. */}
            <SurfaceCard
              title="3. Aprovar as propostas"
              description="Só aparecem as que a IA classificou diferente do que está gravado. Aceitar troca a categoria e registra de onde veio; dá para desfazer o lote inteiro."
            >
              {pendentes.length === 0 ? (
                <p className="text-sm text-zinc-500">Nenhuma proposta esperando decisão.</p>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-xl bg-zinc-50 px-3 py-2.5 text-sm text-zinc-700 ring-1 ring-inset ring-zinc-200">
                    <p>
                      <b className="tabular-nums">{quantasMudamCategoria}</b> mudam a categoria e <b className="tabular-nums">{pendentes.length - quantasMudamCategoria}</b> só a subcategoria. As que mais mudam:
                    </p>
                    <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-600">
                      {fluxos.slice(0, 10).map(([k, n]) => (
                        <span key={k} className="tabular-nums">
                          {k} <b className="text-zinc-800">{n}</b>
                        </span>
                      ))}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value as typeof filtroTipo)} className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm" aria-label="Tipo de mudança">
                      <option value="categoria">Mudam a categoria ({quantasMudamCategoria})</option>
                      <option value="subcategoria">Só a subcategoria ({pendentes.length - quantasMudamCategoria})</option>
                      <option value="todas">Todas ({pendentes.length})</option>
                    </select>
                    <select value={filtroConfianca} onChange={(e) => setFiltroConfianca(e.target.value)} className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm" aria-label="Confiança">
                      <option value="todas">Toda confiança</option>
                      <option value="alta">Confiança alta</option>
                      <option value="media">Confiança média</option>
                      <option value="baixa">Confiança baixa</option>
                    </select>
                    <select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)} className="rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm" aria-label="Categoria proposta">
                      <option value="todas">Toda categoria proposta</option>
                      {categoriasPropostas.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <button type="button" onClick={() => setSelecionadas(new Set(filtradas.map((p) => p.id)))} className="rounded-lg px-2.5 py-1.5 text-zinc-600 hover:bg-zinc-100">
                      Selecionar as {filtradas.length} filtradas
                    </button>
                    {selecionadas.size > 0 && (
                      <button type="button" onClick={() => setSelecionadas(new Set())} className="rounded-lg px-2.5 py-1.5 text-zinc-600 hover:bg-zinc-100">
                        Limpar seleção
                      </button>
                    )}
                    <span className="ml-auto flex flex-wrap items-center gap-2">
                      {confirmar === "aceitar" || confirmar === "recusar" ? (
                        <>
                          <span className="text-zinc-700">
                            {confirmar === "aceitar" ? "Trocar a categoria de" : "Recusar"} {selecionadas.size} {pluralDe(selecionadas.size, "reclamação", "reclamações")}?
                          </span>
                          <button type="button" onClick={() => decidir(confirmar)} className="rounded-lg bg-violet-700 px-3 py-1.5 font-medium text-white hover:bg-violet-800">
                            Confirmar
                          </button>
                          <button type="button" onClick={() => setConfirmar(null)} className="rounded-lg px-3 py-1.5 text-zinc-600 hover:bg-zinc-100">
                            Cancelar
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            disabled={!pode || selecionadas.size === 0 || ocupado !== null}
                            onClick={() => setConfirmar("aceitar")}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-violet-700 px-3 py-1.5 font-medium text-white hover:bg-violet-800 disabled:opacity-50"
                          >
                            {ocupado === "aceitar" && <Loader2 size={14} className="animate-spin" />}
                            Aceitar {selecionadas.size || ""}
                          </button>
                          <button
                            type="button"
                            disabled={!pode || selecionadas.size === 0 || ocupado !== null}
                            onClick={() => setConfirmar("recusar")}
                            className="rounded-lg px-3 py-1.5 text-zinc-700 ring-1 ring-inset ring-zinc-200 hover:bg-zinc-50 disabled:opacity-50"
                          >
                            Recusar
                          </button>
                        </>
                      )}
                    </span>
                  </div>

                  <ul className="divide-y divide-zinc-100 rounded-xl ring-1 ring-inset ring-zinc-200">
                    {filtradas.slice(0, mostrar).map((p) => (
                      <LinhaDaProposta key={p.id} p={p} marcada={selecionadas.has(p.id)} alternar={() => alternar(p.id)} />
                    ))}
                  </ul>
                  {filtradas.length > mostrar && (
                    <button type="button" onClick={() => setMostrar((m) => m + LOTE_DA_TELA)} className="text-sm font-medium text-violet-700 hover:underline">
                      Mostrar mais {Math.min(LOTE_DA_TELA, filtradas.length - mostrar)} de {filtradas.length - mostrar}
                    </button>
                  )}
                </div>
              )}
            </SurfaceCard>

            {/* Histórico. */}
            {revisao.lotes.length > 0 && (
              <SurfaceCard title="Histórico" description="Cada unificação e cada aprovação é um lote. Desfazer devolve as reclamações à categoria de antes — menos as que alguém mudou depois.">
                <ul className="divide-y divide-zinc-100 text-sm">
                  {revisao.lotes.map((l) => (
                    <li key={l.lote} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                      <span className="font-medium text-zinc-800">{l.origem === "ia" ? "Aprovação de propostas da IA" : "Unificação"}</span>
                      <span className="tabular-nums text-zinc-500">
                        {l.trocas} {pluralDe(l.trocas, "troca", "trocas")} · {br(l.em)} · {l.por}
                      </span>
                      {l.desfeito ? (
                        <span className="text-xs text-zinc-400">desfeito</span>
                      ) : confirmar && typeof confirmar === "object" && confirmar.lote === l.lote ? (
                        <span className="ml-auto flex items-center gap-2">
                          <span className="text-zinc-700">Desfazer {l.trocas} {pluralDe(l.trocas, "troca", "trocas")}?</span>
                          <button type="button" onClick={() => desfazer(l.lote)} className="rounded-lg bg-violet-700 px-3 py-1 font-medium text-white hover:bg-violet-800">
                            Confirmar
                          </button>
                          <button type="button" onClick={() => setConfirmar(null)} className="rounded-lg px-3 py-1 text-zinc-600 hover:bg-zinc-100">
                            Cancelar
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={!pode || ocupado !== null}
                          onClick={() => setConfirmar({ lote: l.lote })}
                          className="ml-auto inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-zinc-600 hover:bg-zinc-100 disabled:opacity-50"
                        >
                          {ocupado === l.lote ? <Loader2 size={13} className="animate-spin" /> : <Undo2 size={13} />}
                          Desfazer
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </SurfaceCard>
            )}
          </>
        )}
      </div>
    </MainLayout>
  );
}

function LinhaDaProposta({ p, marcada, alternar }: { p: PropostaNaTela; marcada: boolean; alternar: () => void }) {
  const c = CONFIANCA[p.confianca] ?? CONFIANCA.baixa;
  const muda = mudaCategoria(p);
  return (
    <li className={`flex gap-3 px-3 py-2.5 ${marcada ? "bg-violet-50/60" : ""}`}>
      <input type="checkbox" checked={marcada} onChange={alternar} className="mt-1 size-4 shrink-0 accent-violet-700" aria-label={`Selecionar ${p.protocolo}`} />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <Link href={`/reclame-aqui/${p.protocolo}`} className="min-w-0 truncate text-sm font-medium text-zinc-900 hover:underline">
            {p.titulo}
          </Link>
          <span className="text-xs tabular-nums text-zinc-400">
            {p.protocolo} · {br(p.abertaEm)}
          </span>
        </div>
        <p className="flex flex-wrap items-center gap-1.5 text-sm">
          <span className="text-zinc-500 line-through decoration-zinc-300">{classificacao(p.atual)}</span>
          <ArrowRight size={13} className="text-zinc-400" />
          <span className={muda ? "font-medium text-zinc-900" : "text-zinc-800"}>{classificacao(p.proposta)}</span>
          <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ${c.classe}`}>confiança {c.rotulo}</span>
          {!muda && (
            <span className="inline-flex items-center gap-1 text-[11px] text-zinc-500">
              <CircleAlert size={11} /> só a subcategoria
            </span>
          )}
        </p>
        <p className="text-xs text-zinc-500">{p.motivo}</p>
      </div>
    </li>
  );
}
