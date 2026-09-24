"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { BookOpenCheck, Download, FilePlus2, Loader2, Search, X } from "lucide-react";

import MainLayout from "@/components/layout/MainLayout";

import PageHeading from "@/components/shared/PageHeading";
import { ConfirmDelete } from "@/components/shared/Modal";

import EditorDoDocumento from "@/components/documentacao/EditorDoDocumento";
import ImportarDocumentos from "@/components/documentacao/ImportarDocumentos";
import LeitorDoDocumento from "@/components/documentacao/LeitorDoDocumento";
import { useSecaoAtiva } from "@/components/documentacao/useSecaoAtiva";

import { useDocs } from "@/lib/context/DocsContext";
import { useToast } from "@/lib/context/ToastContext";

import { excluirDocumento } from "@/lib/actions/documentos";
import { ORDEM_DOS_ESCOPOS, SLUGS_DOS_DOCUMENTOS_DO_TIME } from "@/lib/documentos/indice";
import { dobrar } from "@/lib/models/markdown";
import { secoesDoDocumento, tituloSemEmoji, type Playbook, type SecaoDoDocumento } from "@/lib/models/playbook";

/**
 * Documentação: os documentos do time, para ler, buscar e editar.
 *
 * Lista à esquerda (por grupo, na ordem dos documentos), o documento no
 * meio e o índice "Nesta página" acompanhando a leitura. O endereço
 * `?doc=cintcw-nps#checklist-para-encerrar` abre direto na seção — é o
 * que o "por quê?" das telas usa. A busca procura dentro do texto, sem
 * depender de acento, e mostra em que seção achou.
 */
export default function DocumentacaoPage() {
  return (
    <MainLayout>
      {/* useSearchParams suspende o render; sem o Suspense a página inteira vira dinâmica. */}
      <Suspense fallback={null}>
        <Documentacao />
      </Suspense>
    </MainLayout>
  );
}

const ORDEM_DO_TIME = new Map<string, number>(SLUGS_DOS_DOCUMENTOS_DO_TIME.map((s, i) => [s, i]));

function ordemDoGrupo(escopo: string) {
  const i = ORDEM_DOS_ESCOPOS.indexOf(escopo);
  return i === -1 ? ORDEM_DOS_ESCOPOS.length : i;
}

interface Achado {
  doc: Playbook;
  secoes: SecaoDoDocumento[];
}

function Documentacao() {
  const params = useSearchParams();
  const router = useRouter();
  const { notify } = useToast();
  const { playbooks, loading, retirarDaLista } = useDocs();

  const [busca, setBusca] = useState("");
  const [editando, setEditando] = useState<"novo" | string | null>(null);
  const [importando, setImportando] = useState(false);
  const [excluindo, setExcluindo] = useState<Playbook>();
  const excluindoAgora = useRef(false);
  const secaoPendente = useRef<string | null>(null);
  const primeiraAbertura = useRef(true);

  const ordenados = useMemo(
    () =>
      [...playbooks].sort(
        (a, b) =>
          ordemDoGrupo(a.scope) - ordemDoGrupo(b.scope) ||
          a.scope.localeCompare(b.scope, "pt-BR") ||
          (ORDEM_DO_TIME.get(a.slug) ?? 99) - (ORDEM_DO_TIME.get(b.slug) ?? 99) ||
          a.title.localeCompare(b.title, "pt-BR")
      ),
    [playbooks]
  );

  const termo = dobrar(busca.trim());

  const achados = useMemo<Achado[]>(() => {
    if (termo.length < 2) return ordenados.map((doc) => ({ doc, secoes: [] }));
    return ordenados.flatMap((doc) => {
      const secoes = doc.conteudo ? secoesDoDocumento(doc.conteudo).filter((s) => dobrar(`${s.titulo}\n${s.texto}`).includes(termo)) : [];
      const noTopo = dobrar(`${doc.title} ${doc.summary} ${doc.scope}`).includes(termo);
      const nasEtapas = !doc.conteudo && dobrar(JSON.stringify(doc.steps) + (doc.rules ?? []).join(" ")).includes(termo);
      /* A seção de nível 3 já vem dentro da de nível 2 que a contém: mostra a mais específica. */
      const especificas = secoes.filter((s) => s.nivel === 3 || !secoes.some((o) => o.nivel === 3 && s.texto.includes(o.titulo)));
      return noTopo || nasEtapas || secoes.length > 0 ? [{ doc, secoes: especificas }] : [];
    });
  }, [ordenados, termo]);

  const grupos = useMemo(() => {
    const mapa = new Map<string, Achado[]>();
    for (const a of achados) {
      const g = a.doc.scope || "Sem grupo";
      mapa.set(g, [...(mapa.get(g) ?? []), a]);
    }
    return [...mapa.entries()];
  }, [achados]);

  const slug = params.get("doc");
  const atual = (slug && playbooks.find((p) => p.slug === slug)) || achados[0]?.doc;
  const documentoEmEdicao = editando && editando !== "novo" ? playbooks.find((p) => p.id === editando) : undefined;
  const faltamDoTime = SLUGS_DOS_DOCUMENTOS_DO_TIME.filter((s) => !playbooks.some((p) => p.slug === s)).length;
  const escopos = [...new Set([...ORDEM_DOS_ESCOPOS, ...playbooks.map((p) => p.scope).filter(Boolean)])];

  /*
    O índice do documento aberto, na lista: as seções de nível 2 sempre,
    e as de nível 3 só dentro da seção que está sendo lida — o NPS tem
    sete tipos debaixo de uma seção só, e mostrar tudo empurraria a lista.
  */
  const conteudoAtual = atual?.conteudo;
  const secoesDoAtual = useMemo(() => (conteudoAtual ? secoesDoDocumento(conteudoAtual) : []), [conteudoAtual]);
  const [ativa, fixarSecao] = useSecaoAtiva(editando ? "" : secoesDoAtual.map((s) => s.ancora).join("|"));
  const paiDe = useMemo(() => {
    const mapa = new Map<string, string>();
    let pai = "";
    for (const s of secoesDoAtual) {
      if (s.nivel === 2) pai = s.ancora;
      mapa.set(s.ancora, pai);
    }
    return mapa;
  }, [secoesDoAtual]);
  const paiDaAtiva = ativa ? paiDe.get(ativa) : undefined;
  const lista = useRef<HTMLElement>(null);

  /* A seção lida fica à vista na lista, sem mexer na rolagem do documento. */
  useEffect(() => {
    const nav = lista.current;
    const item = nav?.querySelector<HTMLElement>("[data-secao-lida]");
    if (!nav || !item) return;
    /* A lista é `relative`: o offsetTop do item já é medido a partir dela. */
    const topo = item.offsetTop;
    /*
      Sem `behavior: "smooth"`: no Chrome, uma rolagem suave aqui cancela
      a rolagem suave do documento que está em andamento — o link para a
      seção parava no meio do caminho.
    */
    if (topo < nav.scrollTop + 8 || topo + item.offsetHeight > nav.scrollTop + nav.clientHeight - 8) {
      nav.scrollTop = Math.max(0, topo - nav.clientHeight / 3);
    }
  }, [ativa]);

  /** O link que chega de fora vai direto; o clique no índice rola suave. */
  function rolarAte(ancora: string, suave = true) {
    const el = document.getElementById(ancora);
    if (!el) return false;
    el.scrollIntoView({ behavior: suave ? "smooth" : "auto", block: "start" });
    return true;
  }

  /*
    A seção do endereço (ou a que a busca pediu) só existe depois que o
    documento desenhou. Na primeira abertura vale o `#` que veio no link.
  */
  useEffect(() => {
    if (!atual?.conteudo) return;
    const alvo = secaoPendente.current ?? (primeiraAbertura.current ? decodeURIComponent(window.location.hash.slice(1)) : "");
    if (!alvo) {
      primeiraAbertura.current = false;
      return;
    }
    /*
      As marcas só mudam quando a rolagem acontece: no modo de
      desenvolvimento o React roda o efeito, desfaz e roda de novo, e a
      segunda vez precisa achar o alvo ainda pendente.
    */
    const quadro = requestAnimationFrame(() => {
      primeiraAbertura.current = false;
      secaoPendente.current = null;
      fixarSecao(alvo);
      if (rolarAte(alvo, false)) window.history.replaceState(null, "", `/documentacao?doc=${encodeURIComponent(atual.slug)}#${alvo}`);
    });
    return () => cancelAnimationFrame(quadro);
  }, [atual?.slug, atual?.conteudo, fixarSecao]);

  function abrir(doc: Playbook, ancora?: string) {
    setEditando(null);
    if (doc.slug === atual?.slug && ancora) return irParaSecao(ancora);
    secaoPendente.current = ancora ?? null;
    router.replace(`/documentacao?doc=${encodeURIComponent(doc.slug)}`, { scroll: false });
    if (!ancora) document.querySelector("main")?.scrollTo({ top: 0 });
  }

  function irParaSecao(ancora: string) {
    if (!atual) return;
    window.history.replaceState(null, "", `/documentacao?doc=${encodeURIComponent(atual.slug)}#${ancora}`);
    fixarSecao(ancora);
    rolarAte(ancora);
  }

  async function copiarLink(ancora?: string) {
    if (!atual) return;
    const url = `${window.location.origin}/documentacao?doc=${encodeURIComponent(atual.slug)}${ancora ? `#${ancora}` : ""}`;
    try {
      await navigator.clipboard.writeText(url);
      notify({ tone: "success", title: ancora ? "Link da seção copiado" : "Link do documento copiado", detail: url });
    } catch {
      notify({ tone: "error", title: "O navegador não deixou copiar", detail: url });
    }
  }

  async function confirmarExclusao() {
    if (!excluindo || excluindoAgora.current) return;
    excluindoAgora.current = true;
    const alvo = excluindo;
    try {
      const r = await excluirDocumento(alvo.id);
      if (!r.ok) {
        notify({ tone: "error", title: "O documento não foi excluído", detail: r.erro });
        return;
      }
      retirarDaLista(alvo.id);
      setExcluindo(undefined);
      notify({ tone: "success", title: "Documento excluído", detail: alvo.title });
      router.replace("/documentacao", { scroll: false });
    } catch {
      notify({ tone: "error", title: "Não foi possível falar com o servidor", detail: "O documento continua aqui." });
    } finally {
      excluindoAgora.current = false;
    }
  }

  return (
    <div className="space-y-6">
      <PageHeading eyebrow="Conhecimento" title="Documentação" description="Os documentos do time e os processos da operação — para ler, buscar e editar.">
        <button
          type="button"
          onClick={() => setImportando(true)}
          className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 ring-1 ring-inset ring-zinc-200 transition-colors hover:bg-zinc-50"
        >
          <Download size={16} /> Importar documentos do time
        </button>
        <button
          type="button"
          onClick={() => setEditando("novo")}
          className="flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-800"
        >
          <FilePlus2 size={16} /> Novo documento
        </button>
      </PageHeading>

      {!loading && faltamDoTime > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-emerald-50/70 px-4 py-3 ring-1 ring-inset ring-emerald-100">
          <p className="flex items-start gap-2.5 text-sm leading-6 text-emerald-900">
            <BookOpenCheck size={18} className="mt-0.5 shrink-0 text-emerald-600" />
            {faltamDoTime === SLUGS_DOS_DOCUMENTOS_DO_TIME.length
              ? "Os nove documentos do time (Reclame Aqui, NPS, Redes Sociais, Google, Ofertas, rotina…) ainda não estão aqui."
              : `Faltam ${faltamDoTime} dos nove documentos do time.`}{" "}
            Importados, eles viram leitura com busca, links para cada seção e o &ldquo;por quê?&rdquo; das telas.
          </p>
          <button type="button" onClick={() => setImportando(true)} className="rounded-xl bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-800">
            Ver e importar
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-0">
          <div className="rounded-3xl border border-zinc-200/80 bg-white p-3">
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar nos documentos…"
                aria-label="Buscar nos documentos"
                className="h-10 w-full rounded-xl border border-zinc-200 pl-9 pr-8 text-sm outline-none transition-colors focus:border-violet-400"
              />
              {busca && (
                <button type="button" onClick={() => setBusca("")} aria-label="Limpar a busca" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-zinc-400 hover:text-zinc-700">
                  <X size={14} />
                </button>
              )}
            </div>

            {termo.length >= 2 && (
              <p className="mt-2 px-1 text-xs text-zinc-500">
                {achados.length === 0 ? "Nada encontrado." : `${achados.length} ${achados.length === 1 ? "documento" : "documentos"} com “${busca.trim()}”`}
              </p>
            )}

            <nav ref={lista} aria-label="Documentos" className="relative mt-2 max-h-72 space-y-3 overflow-y-auto pr-1 lg:max-h-[calc(100vh-13rem)]">
              {loading && (
                <p className="flex items-center gap-2 px-2 py-6 text-sm text-zinc-400">
                  <Loader2 size={14} className="animate-spin" /> Carregando…
                </p>
              )}
              {grupos.map(([grupo, itens]) => (
                <div key={grupo}>
                  <p className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">{grupo}</p>
                  <ul className="space-y-0.5">
                    {itens.map(({ doc, secoes }) => {
                      const ativo = doc.id === atual?.id && !editando;
                      return (
                        <li key={doc.id}>
                          <button
                            type="button"
                            onClick={() => abrir(doc)}
                            aria-current={ativo ? "page" : undefined}
                            className={`w-full rounded-xl px-2.5 py-2 text-left transition-colors ${ativo ? "bg-violet-50 text-violet-900" : "text-zinc-700 hover:bg-zinc-50"}`}
                          >
                            <span className="line-clamp-2 text-[13px] font-medium leading-5">{doc.title}</span>
                            <span className="mt-0.5 block text-[11px] text-zinc-400">
                              {doc.conteudo ? `${secoesDoDocumento(doc.conteudo).filter((s) => s.nivel === 2).length} seções` : doc.steps.length ? `${doc.steps.length} etapas` : "sem texto"}
                            </span>
                          </button>
                          {secoes.length > 0 && (
                            <ul className="mb-1 ml-3 mt-0.5 space-y-0.5 border-l border-amber-200 pl-2">
                              {secoes.slice(0, 4).map((s) => (
                                <li key={s.ancora}>
                                  <button type="button" onClick={() => abrir(doc, s.ancora)} className="w-full rounded-lg px-2 py-1 text-left text-[12px] leading-4 text-zinc-600 hover:bg-amber-50 hover:text-zinc-900">
                                    {tituloSemEmoji(s.titulo)}
                                  </button>
                                </li>
                              ))}
                              {secoes.length > 4 && <li className="px-2 text-[11px] text-zinc-400">e mais {secoes.length - 4}</li>}
                            </ul>
                          )}
                          {ativo && termo.length < 2 && secoesDoAtual.length > 1 && (
                            <ol aria-label="Nesta página" className="mb-2 ml-3 mt-1 space-y-px border-l border-zinc-100">
                              {secoesDoAtual
                                .filter((s) => s.nivel === 2 || paiDe.get(s.ancora) === paiDaAtiva)
                                .map((s) => {
                                  const lida = s.ancora === ativa;
                                  return (
                                    <li key={s.ancora}>
                                      <button
                                        type="button"
                                        onClick={() => irParaSecao(s.ancora)}
                                        aria-current={lida ? "location" : undefined}
                                        data-secao-lida={lida ? "" : undefined}
                                        className={`-ml-px block w-full border-l-2 py-1 pr-1 text-left text-[12px] leading-4 transition-colors ${s.nivel === 3 ? "pl-5" : "pl-2.5"} ${
                                          lida ? "border-violet-600 font-medium text-violet-800" : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-900"
                                        }`}
                                      >
                                        {tituloSemEmoji(s.titulo)}
                                      </button>
                                    </li>
                                  );
                                })}
                            </ol>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </nav>
          </div>
        </aside>

        <div className="min-w-0">
          {editando ? (
            <EditorDoDocumento
              key={editando}
              documento={documentoEmEdicao}
              escopos={escopos}
              onCancelar={() => setEditando(null)}
              onSalvo={(doc) => {
                setEditando(null);
                router.replace(`/documentacao?doc=${encodeURIComponent(doc.slug)}`, { scroll: false });
              }}
            />
          ) : atual ? (
            <LeitorDoDocumento
              key={atual.id}
              doc={atual}
              destaque={termo.length >= 2 ? busca.trim() : ""}
              ativa={ativa}
              onEditar={() => setEditando(atual.id)}
              onExcluir={() => setExcluindo(atual)}
              onIrParaSecao={irParaSecao}
              aoCopiarLink={copiarLink}
            />
          ) : (
            !loading && (
              <div className="rounded-3xl border border-dashed border-zinc-200 bg-white px-6 py-16 text-center">
                <p className="text-sm font-medium text-zinc-700">{termo.length >= 2 ? "Nenhum documento fala disso." : "Nenhum documento ainda."}</p>
                <p className="mt-1 text-sm text-zinc-500">Importe os documentos do time ou escreva um novo.</p>
              </div>
            )
          )}
        </div>
      </div>

      {importando && (
        <ImportarDocumentos
          onClose={() => setImportando(false)}
          onImportado={(s) => {
            setImportando(false);
            setEditando(null);
            router.replace(`/documentacao?doc=${encodeURIComponent(s)}`, { scroll: false });
          }}
        />
      )}

      <ConfirmDelete open={Boolean(excluindo)} label={excluindo?.title ?? ""} onCancel={() => setExcluindo(undefined)} onConfirm={confirmarExclusao} />
    </div>
  );
}
