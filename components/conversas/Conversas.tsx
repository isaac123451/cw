"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { Building2, ChevronDown, ChevronUp, Clock, FileDown, FileSpreadsheet, FileUp, Link2, Loader2, MessageCircle, Phone, Search, Sparkles, Trash2, X } from "lucide-react";

import PageHeading from "@/components/shared/PageHeading";
import { ConfirmDelete } from "@/components/shared/Modal";
import { ErroDoServidor, RodapeDeSalvar } from "@/components/shared/Rodape";

import Baloes, { type BalaoDaConversa } from "@/components/conversas/Baloes";
import EvidenciaDaConversa, { useEvidencia } from "@/components/conversas/EvidenciaDaConversa";
import ImportarConversa from "@/components/conversas/ImportarConversa";

import { useSla } from "@/lib/context/SlaContext";
import { useToast } from "@/lib/context/ToastContext";
import { useAgora } from "@/lib/hooks/useAgora";

import {
  buscarParaVincular,
  corrigirLadosDaConversa,
  excluirConversa,
  exportarConversa,
  lerConversa,
  listarConversas,
  resumirConversa,
  salvarResumo,
  sugestoesDeVinculo,
  vincularConversa,
} from "@/lib/actions/conversas";
import { ladosDaConversa, retratoDaConversa, type ConversaResumo, type ConversaView } from "@/lib/models/conversa";
import { descreverMinutosUteis, descreverRegistro } from "@/lib/services/horasUteis";

/*
  Os recortes da lista. "Esperando a gente" é o que mais importa: o
  cliente falou por último e ninguém respondeu — é a conversa que vira
  reclamação se ficar parada.
*/
const FILTROS = [
  { chave: "todas", rotulo: "Todas", passa: () => true },
  { chave: "esperando", rotulo: "Esperando a gente", passa: (c: ConversaResumo) => c.ultimaDe === "cliente" },
  { chave: "sem-vinculo", rotulo: "Sem vínculo", passa: (c: ConversaResumo) => !c.caso && !c.nps && !c.estabelecimento },
  { chave: "sem-resumo", rotulo: "Sem resumo", passa: (c: ConversaResumo) => !c.temResumo },
] as const;

type ChaveDoFiltro = (typeof FILTROS)[number]["chave"];

/**
 * Conversas do WhatsApp guardadas.
 *
 * "Um local para transcrição de conversas do WhatsApp", encaixado no
 * processo: a lista busca por texto, contato, telefone, protocolo e
 * estabelecimento; a conversa aparece em balões, ligada ao caso, ao
 * ciclo de NPS ou ao estabelecimento; o resumo por IA só fica gravado se
 * alguém clicar em Salvar. Só existe o que alguém guardou — pela
 * extensão ou pelo arquivo exportado.
 */
export default function Conversas() {
  const params = useSearchParams();
  const router = useRouter();
  const { notify } = useToast();

  const [termo, setTermo] = useState("");
  const [lista, setLista] = useState<ConversaResumo[] | null>(null);
  const [erroDaLista, setErroDaLista] = useState<string | null>(null);
  const [aberta, setAberta] = useState<ConversaView | null>(null);
  /** A conversa que não abriu — para não ficar "abrindo…" para sempre. */
  const [falhou, setFalhou] = useState<string | null>(null);
  const [importando, setImportando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [filtro, setFiltro] = useState<ChaveDoFiltro>("todas");
  const versao = useRef(0);

  const id = params.get("id");

  /* A lista acompanha a busca, com uma pausa curta para não consultar a cada tecla. */
  useEffect(() => {
    const minha = ++versao.current;
    const t = setTimeout(() => {
      listarConversas(termo)
        .then((r) => {
          if (minha !== versao.current) return;
          if (r.ok) {
            setLista(r.conversas);
            setErroDaLista(null);
          } else setErroDaLista(r.erro);
        })
        .catch(() => minha === versao.current && setErroDaLista("A lista não carregou. Recarregue a página."));
    }, termo ? 300 : 0);
    return () => clearTimeout(t);
  }, [termo]);

  useEffect(() => {
    if (!id) return;
    let vivo = true;
    lerConversa(id)
      .then((r) => {
        if (!vivo) return;
        if (r.ok) setAberta(r.conversa);
        else {
          setFalhou(id);
          notify({ tone: "error", title: "A conversa não abriu", detail: r.erro });
        }
      })
      .catch(() => vivo && setFalhou(id));
    return () => {
      vivo = false;
    };
  }, [id, notify]);

  const atual = aberta && aberta.id === id ? aberta : null;

  const passa: (c: ConversaResumo) => boolean = FILTROS.find((x) => x.chave === filtro)!.passa;
  const visiveis = lista?.filter(passa) ?? null;

  function abrir(novo: string) {
    router.replace(`/conversas?id=${encodeURIComponent(novo)}`, { scroll: false });
  }

  function atualizarNaLista(c: ConversaView) {
    setAberta(c);
    setLista((l) => (l ?? []).map((x) => (x.id === c.id ? { ...x, ...c } : x)));
  }

  async function recarregarLista() {
    const r = await listarConversas(termo).catch(() => null);
    if (r && r.ok) setLista(r.conversas);
  }

  async function confirmarExclusao() {
    if (!atual) return;
    const alvo = atual;
    const r = await excluirConversa(alvo.id).catch(() => null);
    if (!r || !r.ok) return notify({ tone: "error", title: "A conversa não foi excluída", detail: r && !r.ok ? r.erro : "Sem resposta do servidor." });
    setExcluindo(false);
    setAberta(null);
    setLista((l) => (l ?? []).filter((x) => x.id !== alvo.id));
    notify({ tone: "success", title: "Conversa excluída", detail: alvo.contatoNome });
    router.replace("/conversas", { scroll: false });
  }

  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow="Operação"
        title="Conversas do WhatsApp"
        description="As conversas que alguém guardou — pela extensão ou pelo arquivo que o WhatsApp exporta —, ligadas ao caso, ao NPS ou ao estabelecimento."
      >
        <button
          type="button"
          onClick={() => setImportando(true)}
          className="flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-800"
        >
          <FileUp size={16} /> Guardar pelo arquivo
        </button>
      </PageHeading>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-0">
          <div className="rounded-3xl border border-zinc-200/80 bg-white p-3">
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                value={termo}
                onChange={(e) => setTermo(e.target.value)}
                placeholder="Texto, contato, telefone ou protocolo"
                aria-label="Buscar nas conversas"
                className="h-10 w-full rounded-xl border border-zinc-200 pl-9 pr-8 text-sm outline-none transition-colors focus:border-violet-400"
              />
              {termo && (
                <button type="button" onClick={() => setTermo("")} aria-label="Limpar a busca" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-zinc-400 hover:text-zinc-700">
                  <X size={14} />
                </button>
              )}
            </div>
            {lista && lista.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1" role="group" aria-label="Recorte da lista">
                {FILTROS.map((x) => {
                  const n = lista.filter(x.passa).length;
                  const ativo = filtro === x.chave;
                  return (
                    <button
                      key={x.chave}
                      type="button"
                      aria-pressed={ativo}
                      onClick={() => setFiltro(x.chave)}
                      className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                        ativo ? "bg-violet-700 text-white" : x.chave === "esperando" && n > 0 ? "bg-amber-50 text-amber-800 hover:bg-amber-100" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                      }`}
                    >
                      {x.rotulo} {x.chave !== "todas" && <span className="opacity-70">{n}</span>}
                    </button>
                  );
                })}
              </div>
            )}
            <ErroDoServidor erro={erroDaLista} />
            <ul className="mt-2 max-h-80 space-y-0.5 overflow-y-auto pr-1 lg:max-h-[calc(100vh-13rem)]">
              {lista === null && !erroDaLista && (
                <li className="flex items-center gap-2 px-2 py-6 text-sm text-zinc-400">
                  <Loader2 size={14} className="animate-spin" /> Carregando…
                </li>
              )}
              {lista && lista.length > 0 && visiveis?.length === 0 && (
                <li className="px-3 py-8 text-center text-sm text-zinc-500">
                  Nenhuma conversa neste recorte.{" "}
                  <button type="button" onClick={() => setFiltro("todas")} className="font-medium text-violet-700 hover:underline">
                    Ver todas
                  </button>
                </li>
              )}
              {lista?.length === 0 && (
                <li className="px-3 py-8 text-center text-sm text-zinc-500">
                  {termo ? "Nenhuma conversa fala disso." : "Nenhuma conversa guardada ainda. Guarde pela extensão (\"Guardar a conversa\") ou pelo arquivo exportado."}
                </li>
              )}
              {visiveis?.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => abrir(c.id)}
                    aria-current={c.id === id ? "page" : undefined}
                    className={`w-full rounded-xl px-3 py-2.5 text-left transition-colors ${c.id === id ? "bg-violet-50" : "hover:bg-zinc-50"}`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-zinc-900">{c.contatoNome}</span>
                      <span className="shrink-0 text-[11px] text-zinc-400">{c.ultimaEm ? descreverRegistro(c.ultimaEm) : ""}</span>
                    </span>
                    <span className="mt-0.5 line-clamp-1 block text-xs text-zinc-500">{c.ultimoTexto}</span>
                    <span className="mt-1 flex flex-wrap gap-1">
                      {c.caso && <span className="rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-700">{c.caso.protocolo}</span>}
                      {c.nps && <span className="rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-sky-700">NPS {c.nps.nota}</span>}
                      {c.estabelecimento && <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">{c.estabelecimento.nome}</span>}
                      {c.ultimaDe === "cliente" && <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">esperando a gente</span>}
                      <span className="text-[10px] text-zinc-400">{c.mensagens} msg</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        <div className="min-w-0">
          {!id ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-3xl border border-dashed border-zinc-200 bg-white px-6 py-20 text-center">
              <MessageCircle size={26} className="text-zinc-300" />
              <p className="text-sm font-medium text-zinc-700">Escolha uma conversa na lista.</p>
              <p className="max-w-md text-sm text-zinc-500">Para guardar uma nova: na extensão, com a conversa aberta no WhatsApp Web, &ldquo;Guardar a conversa&rdquo;; ou aqui, pelo arquivo do &ldquo;Exportar conversa&rdquo;.</p>
            </div>
          ) : !atual && falhou !== id ? (
            <p className="flex items-center justify-center gap-2 rounded-3xl bg-white py-20 text-sm text-zinc-500">
              <Loader2 size={16} className="animate-spin" /> Abrindo a conversa…
            </p>
          ) : atual ? (
            <DetalheDaConversa conversa={atual} destaque={termo} onMudou={atualizarNaLista} onExcluir={() => setExcluindo(true)} />
          ) : null}
        </div>
      </div>

      {importando && (
        <ImportarConversa
          onClose={() => setImportando(false)}
          onGuardada={(novo) => {
            setImportando(false);
            recarregarLista();
            if (novo === id) lerConversa(novo).then((r) => r.ok && setAberta(r.conversa));
            abrir(novo);
          }}
        />
      )}

      <ConfirmDelete open={excluindo} label={atual ? `a conversa com ${atual.contatoNome}` : ""} onCancel={() => setExcluindo(false)} onConfirm={confirmarExclusao} />
    </div>
  );
}

function DetalheDaConversa({
  conversa: c,
  destaque,
  onMudou,
  onExcluir,
}: {
  conversa: ConversaView;
  destaque: string;
  onMudou: (c: ConversaView) => void;
  onExcluir: () => void;
}) {
  const fim = useRef<HTMLDivElement>(null);
  const rolagem = useRef<HTMLDivElement>(null);
  const { caso, gravando, marcar } = useEvidencia(c);
  const { expediente } = useSla();
  const agora = useAgora();

  const retrato = useMemo(() => (agora ? retratoDaConversa(c.lista, new Date(agora), expediente) : null), [c.lista, agora, expediente]);

  /*
    Busca dentro da conversa. Começa pelo termo da lista (quem buscou
    "reembolso" e abriu a conversa quer ver onde está), e as setas andam
    entre as ocorrências — numa conversa de 300 mensagens, destacar sem
    levar até lá é o mesmo que não achar.
  */
  const [buscaLocal, setBuscaLocal] = useState("");
  const termoAtivo = buscaLocal.trim().length >= 2 ? buscaLocal.trim() : destaque.trim().length >= 2 ? destaque.trim() : "";
  const ocorrencias = useMemo(
    () => (termoAtivo ? c.lista.filter((m) => m.texto.toLowerCase().includes(termoAtivo.toLowerCase())).map((m) => m.id) : []),
    [c.lista, termoAtivo]
  );
  const [navegacao, setNavegacao] = useState<{ termo: string; indice: number }>({ termo: "", indice: 0 });
  /* Termo novo começa pela ocorrência mais recente, como a conversa começa pelo fim. */
  const indice = navegacao.termo === termoAtivo ? Math.min(navegacao.indice, ocorrencias.length - 1) : ocorrencias.length - 1;
  const foco = indice >= 0 ? ocorrencias[indice] : null;

  function andar(passo: number) {
    if (ocorrencias.length === 0) return;
    setNavegacao({ termo: termoAtivo, indice: (indice + passo + ocorrencias.length) % ocorrencias.length });
  }

  /* Abre no fim, como o WhatsApp: o que importa é a última mensagem. */
  useEffect(() => {
    fim.current?.scrollIntoView({ block: "end" });
  }, [c.id]);

  /* Com uma ocorrência em foco, a tela vai até ela. */
  useEffect(() => {
    if (!foco) return;
    rolagem.current?.querySelector(`[data-msg="${CSS.escape(foco)}"]`)?.scrollIntoView({ block: "center" });
  }, [foco, c.id]);

  /* Nossas mensagens que tiveram resposta depois: só elas podem ser o 1º contato. */
  const comResposta = new Set<string>();
  let clienteDepois = false;
  for (let i = c.lista.length - 1; i >= 0; i--) {
    const m = c.lista[i];
    if (m.de === "cliente") clienteDepois = true;
    else if (m.de === "nos" && clienteDepois && m.em) comResposta.add(m.id);
  }

  const acoes = caso
    ? (m: BalaoDaConversa) => {
        const msg = c.lista.find((x) => x.id === m.id);
        if (!msg || !msg.em) return null;
        const botao = "whitespace-nowrap rounded-lg px-2 py-1 text-[11px] font-medium ring-1 ring-inset disabled:opacity-50";
        if (msg.de === "cliente" && !caso.validadoEm) {
          return (
            <button type="button" disabled={gravando === msg.id} onClick={() => marcar(msg, "validacao")} className={`${botao} bg-white text-emerald-700 ring-emerald-200 hover:bg-emerald-50`}>
              é a confirmação
            </button>
          );
        }
        if (msg.de === "nos" && !caso.primeiroContatoEm && comResposta.has(msg.id)) {
          return (
            <button type="button" disabled={gravando === msg.id} onClick={() => marcar(msg, "contato")} className={`${botao} bg-white text-violet-700 ring-violet-200 hover:bg-violet-50`}>
              é o 1º contato
            </button>
          );
        }
        return null;
      }
    : undefined;

  return (
    <article className="overflow-hidden rounded-3xl border border-zinc-200/80 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-100 p-5">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-zinc-900">{c.contatoNome}</h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            {c.telefone ? `+${c.telefone} · ` : ""}
            {c.mensagens} mensagens · guardada por {c.guardadaPor}
          </p>
          {retrato && (
            <p className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
              {retrato.esperandoDesde ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-800 ring-1 ring-inset ring-amber-200" title="Contado no expediente, desde a primeira mensagem do cliente sem resposta">
                  <Clock size={11} />
                  {retrato.minutosEsperando
                    ? `Esperando a gente há ${descreverMinutosUteis(retrato.minutosEsperando, expediente)} no expediente`
                    : `Esperando a gente desde ${descreverRegistro(retrato.esperandoDesde)}`}
                </span>
              ) : retrato.ultimaDe === "nos" ? (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-800 ring-1 ring-inset ring-emerald-200">A última palavra foi nossa</span>
              ) : null}
              {retrato.respostaMediaMin != null && (
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-zinc-600" title="Da primeira fala do cliente até a nossa resposta, em horas de expediente">
                  Respondemos em {descreverMinutosUteis(retrato.respostaMediaMin, expediente)}, em média ({retrato.respostas})
                </span>
              )}
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-zinc-600">
                {retrato.doCliente} do cliente · {retrato.nossas} nossas
              </span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <ExportarConversa conversa={c} />
          <button type="button" onClick={onExcluir} aria-label="Excluir a conversa" title="Excluir a conversa" className="rounded-xl p-2 text-zinc-400 transition-colors hover:bg-rose-50 hover:text-rose-600">
            <Trash2 size={15} />
          </button>
        </div>
      </header>

      <Vinculos conversa={c} onMudou={onMudou} />
      <CorrigirLados key={c.id} conversa={c} onMudou={onMudou} />
      <EvidenciaDaConversa conversa={c} caso={caso} gravando={gravando} marcar={marcar} />
      <Resumo conversa={c} onMudou={onMudou} />

      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-100 bg-white px-5 py-2">
        <div className="relative min-w-[12rem] flex-1">
          <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            value={buscaLocal}
            onChange={(e) => setBuscaLocal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                andar(e.shiftKey ? 1 : -1);
              }
            }}
            placeholder={destaque.trim().length >= 2 ? `Buscar nesta conversa (agora: "${destaque.trim()}")` : "Buscar nesta conversa"}
            aria-label="Buscar nesta conversa"
            className="h-8 w-full rounded-lg border border-zinc-200 pl-8 pr-2 text-xs outline-none focus:border-violet-400"
          />
        </div>
        {termoAtivo && (
          <div className="flex items-center gap-1 text-[11px] text-zinc-500">
            <span aria-live="polite">{ocorrencias.length === 0 ? "nenhuma" : `${indice + 1} de ${ocorrencias.length}`}</span>
            <button type="button" onClick={() => andar(-1)} disabled={ocorrencias.length === 0} aria-label="Ocorrência anterior" title="Anterior (Enter)" className="rounded-md p-1 hover:bg-zinc-100 disabled:opacity-40">
              <ChevronUp size={14} />
            </button>
            <button type="button" onClick={() => andar(1)} disabled={ocorrencias.length === 0} aria-label="Próxima ocorrência" title="Próxima (Shift+Enter)" className="rounded-md p-1 hover:bg-zinc-100 disabled:opacity-40">
              <ChevronDown size={14} />
            </button>
          </div>
        )}
      </div>

      <div ref={rolagem} className="max-h-[60vh] overflow-y-auto bg-zinc-50/70 px-4 py-4">
        <Baloes mensagens={c.lista} destaque={termoAtivo} foco={foco} acoes={acoes} />
        <div ref={fim} />
      </div>
    </article>
  );
}

/**
 * Baixar a conversa: .txt no formato do WhatsApp ou .xlsx.
 *
 * O .txt é o mesmo formato do "Exportar conversa" do WhatsApp — serve
 * para anexar num chamado, mandar para o jurídico, e volta para cá pela
 * importação sem duplicar nada. O arquivo é montado no servidor e baixa
 * direto, sem passar por endereço público.
 */
function ExportarConversa({ conversa }: { conversa: ConversaView }) {
  const { notify } = useToast();
  const [baixando, setBaixando] = useState<"txt" | "xlsx" | null>(null);

  async function baixar(formato: "txt" | "xlsx") {
    setBaixando(formato);
    try {
      const r = await exportarConversa(conversa.id, formato);
      if (!r.ok) return notify({ tone: "error", title: "Não deu para exportar", detail: r.erro });

      const bytes = Uint8Array.from(atob(r.arquivo), (ch) => ch.charCodeAt(0));
      const url = URL.createObjectURL(
        new Blob([bytes], {
          type: formato === "txt" ? "text/plain;charset=utf-8" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        })
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = r.nome;
      link.click();
      URL.revokeObjectURL(url);

      notify({ tone: "success", title: `${r.mensagens} mensagem(ns) exportada(s)`, detail: r.nome });
    } catch {
      notify({ tone: "error", title: "Sem resposta do servidor", detail: "O arquivo não foi gerado." });
    } finally {
      setBaixando(null);
    }
  }

  const botao = "flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-medium text-zinc-600 ring-1 ring-inset ring-zinc-200 transition-colors hover:bg-zinc-50 disabled:opacity-50";

  return (
    <>
      <button
        type="button"
        onClick={() => baixar("txt")}
        disabled={baixando !== null}
        title="Baixa a conversa em .txt, no formato do “Exportar conversa” do WhatsApp"
        className={botao}
      >
        {baixando === "txt" ? <Loader2 size={13} className="animate-spin" /> : <FileDown size={13} />} .txt
      </button>
      <button
        type="button"
        onClick={() => baixar("xlsx")}
        disabled={baixando !== null}
        title="Baixa a conversa em planilha, uma mensagem por linha"
        className={botao}
      >
        {baixando === "xlsx" ? <Loader2 size={13} className="animate-spin" /> : <FileSpreadsheet size={13} />} .xlsx
      </button>
    </>
  );
}

function Vinculos({ conversa: c, onMudou }: { conversa: ConversaView; onMudou: (c: ConversaView) => void }) {
  const { notify } = useToast();
  const [busca, setBusca] = useState("");
  const [achados, setAchados] = useState<Awaited<ReturnType<typeof buscarParaVincular>> | null>(null);
  const [gravando, setGravando] = useState(false);
  const [sugestoes, setSugestoes] = useState<{ para: string; dados: Awaited<ReturnType<typeof sugestoesDeVinculo>> } | null>(null);

  /* A chave muda quando o vínculo muda: o que acabou de ser ligado sai da sugestão. */
  const chaveDasSugestoes = `${c.id}|${c.caso?.id ?? ""}|${c.nps?.id ?? ""}|${c.estabelecimento?.id ?? ""}`;

  useEffect(() => {
    if (!c.telefone) return;
    let vivo = true;
    sugestoesDeVinculo(c.id)
      .then((dados) => {
        if (vivo) setSugestoes({ para: chaveDasSugestoes, dados });
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [c.id, c.telefone, chaveDasSugestoes]);

  const sugeridas = sugestoes?.para === chaveDasSugestoes && sugestoes.dados.ok ? sugestoes.dados : null;
  const totalSugerido = sugeridas ? sugeridas.casos.length + sugeridas.nps.length + sugeridas.estabelecimentos.length : 0;

  useEffect(() => {
    if (busca.trim().length < 2) return;
    let vivo = true;
    const t = setTimeout(() => buscarParaVincular(busca).then((r) => vivo && setAchados(r)), 300);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [busca]);

  async function gravar(mudanca: Partial<{ caseId: string | null; npsResponseId: string | null; establishmentId: string | null }>, rotulo: string) {
    setGravando(true);
    try {
      const r = await vincularConversa(c.id, {
        caseId: c.caso?.id ?? null,
        npsResponseId: c.nps?.id ?? null,
        establishmentId: c.estabelecimento?.id ?? null,
        ...mudanca,
      });
      if (!r.ok) return notify({ tone: "error", title: "O vínculo não foi gravado", detail: r.erro });
      onMudou(r.conversa);
      setBusca("");
      setAchados(null);
      notify({ tone: "success", title: rotulo });
    } catch {
      notify({ tone: "error", title: "Sem resposta do servidor", detail: "O vínculo não foi gravado." });
    } finally {
      setGravando(false);
    }
  }

  const chip = "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset";
  const lista = achados && achados.ok ? achados : null;

  return (
    <section aria-label="Vínculos" className="border-b border-zinc-100 px-5 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <Link2 size={14} className="text-zinc-400" aria-hidden />
        {c.caso ? (
          <span className={`${chip} bg-violet-50 text-violet-800 ring-violet-100`}>
            <Link href={`/${c.caso.frente === "Reclame Aqui" ? "reclame-aqui" : "redes-sociais"}/${encodeURIComponent(c.caso.protocolo)}`} className="hover:underline">
              {c.caso.frente} · {c.caso.protocolo}
            </Link>
            <button type="button" disabled={gravando} onClick={() => gravar({ caseId: null }, "Caso desvinculado")} aria-label="Desvincular o caso" className="text-violet-400 hover:text-violet-800">
              <X size={12} />
            </button>
          </span>
        ) : null}
        {c.nps ? (
          <span className={`${chip} bg-sky-50 text-sky-800 ring-sky-100`}>
            <Link href={`/nps/${c.nps.id}`} className="hover:underline">
              NPS · {c.nps.cliente} ({c.nps.nota})
            </Link>
            <button type="button" disabled={gravando} onClick={() => gravar({ npsResponseId: null }, "NPS desvinculado")} aria-label="Desvincular o NPS" className="text-sky-400 hover:text-sky-800">
              <X size={12} />
            </button>
          </span>
        ) : null}
        {c.estabelecimento ? (
          <span className={`${chip} bg-emerald-50 text-emerald-800 ring-emerald-100`}>
            <Building2 size={12} />
            <Link href={`/estabelecimentos/${c.estabelecimento.slug}`} className="hover:underline">
              {c.estabelecimento.nome}
            </Link>
            <button type="button" disabled={gravando} onClick={() => gravar({ establishmentId: null }, "Estabelecimento desvinculado")} aria-label="Desvincular o estabelecimento" className="text-emerald-400 hover:text-emerald-800">
              <X size={12} />
            </button>
          </span>
        ) : null}
        <div className="relative min-w-[14rem] flex-1">
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder={c.caso || c.nps || c.estabelecimento ? "Vincular a mais…" : "Vincular a um caso, NPS ou estabelecimento…"}
            aria-label="Buscar para vincular"
            className="h-8 w-full rounded-lg border border-zinc-200 px-2.5 text-xs outline-none focus:border-violet-400"
          />
          {lista && busca.trim().length >= 2 && (
            <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-xl bg-white p-1.5 shadow-xl ring-1 ring-zinc-900/10">
              {lista.casos.length + lista.nps.length + lista.estabelecimentos.length === 0 && <p className="px-2 py-3 text-xs text-zinc-500">Nada encontrado.</p>}
              {lista.casos.map((x) => (
                <button key={x.id} type="button" disabled={gravando} onClick={() => gravar({ caseId: x.id }, `Vinculada ao caso ${x.protocolo}`)} className="block w-full rounded-lg px-2 py-1.5 text-left text-xs hover:bg-violet-50">
                  <strong>{x.protocolo}</strong> · {x.cliente} <span className="text-zinc-400">({x.frente})</span>
                </button>
              ))}
              {lista.nps.map((x) => (
                <button key={x.id} type="button" disabled={gravando} onClick={() => gravar({ npsResponseId: x.id }, `Vinculada ao NPS de ${x.cliente}`)} className="block w-full rounded-lg px-2 py-1.5 text-left text-xs hover:bg-sky-50">
                  <strong>NPS {x.nota}</strong> · {x.cliente} <span className="text-zinc-400">({descreverRegistro(x.quando)})</span>
                </button>
              ))}
              {lista.estabelecimentos.map((x) => (
                <button key={x.id} type="button" disabled={gravando} onClick={() => gravar({ establishmentId: x.id }, `Vinculada a ${x.nome}`)} className="block w-full rounded-lg px-2 py-1.5 text-left text-xs hover:bg-emerald-50">
                  <Building2 size={11} className="mr-1 inline" /> {x.nome}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {totalSugerido > 0 && sugeridas && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="inline-flex items-center gap-1 text-zinc-500" title="Registros com o mesmo telefone (DDD e número) desta conversa">
            <Phone size={11} /> Mesmo telefone:
          </span>
          {sugeridas.casos.map((x) => (
            <button key={x.id} type="button" disabled={gravando} onClick={() => gravar({ caseId: x.id }, `Vinculada ao caso ${x.protocolo}`)} className="rounded-full bg-white px-2 py-0.5 font-medium text-violet-700 ring-1 ring-inset ring-violet-200 hover:bg-violet-50 disabled:opacity-50">
              + {x.frente} {x.protocolo} · {x.cliente}
            </button>
          ))}
          {sugeridas.nps.map((x) => (
            <button key={x.id} type="button" disabled={gravando} onClick={() => gravar({ npsResponseId: x.id }, `Vinculada ao NPS de ${x.cliente}`)} className="rounded-full bg-white px-2 py-0.5 font-medium text-sky-700 ring-1 ring-inset ring-sky-200 hover:bg-sky-50 disabled:opacity-50">
              + NPS {x.nota} · {x.cliente} ({descreverRegistro(x.quando)})
            </button>
          ))}
          {sugeridas.estabelecimentos.map((x) => (
            <button key={x.id} type="button" disabled={gravando} onClick={() => gravar({ establishmentId: x.id }, `Vinculada a ${x.nome}`)} className="rounded-full bg-white px-2 py-0.5 font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200 hover:bg-emerald-50 disabled:opacity-50">
              + {x.nome} <span className="font-normal opacity-70">({x.campo})</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * Qual autor é o nosso lado.
 *
 * Aberto sozinho quando a conversa tem dois autores e todas as falas de
 * um lado só — a leitura errou a direção. Nos outros casos, fica um link
 * discreto: quem vê o próprio texto do lado do cliente conserta sem
 * precisar de ninguém.
 */
function CorrigirLados({ conversa: c, onMudou }: { conversa: ConversaView; onMudou: (c: ConversaView) => void }) {
  const { notify } = useToast();
  const lados = useMemo(() => ladosDaConversa(c.lista), [c.lista]);
  const [aberto, setAberto] = useState(false);
  const [nosso, setNosso] = useState<string | null>(null);
  const [avisos, setAvisos] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (lados.autores.length < 2) return null;

  const mostrar = aberto || lados.suspeita;
  const escolhido = nosso ?? lados.autores.find((a) => a.lado === "nos")?.nome ?? null;

  async function salvar() {
    if (!escolhido) return setErro("Escolha qual autor é o nosso lado.");
    setSalvando(true);
    setErro(null);
    try {
      const r = await corrigirLadosDaConversa(c.id, { nosso: escolhido, avisos: avisos && lados.semAutorESemHora > 0 });
      if (!r.ok) return setErro(r.erro);
      onMudou(r.conversa);
      setAberto(false);
      setNosso(null);
      notify({
        tone: "success",
        title: "Lados corrigidos",
        detail: `${r.nossas} nossa(s), ${r.deles} do cliente${r.avisos ? `, ${r.avisos} aviso(s)` : ""}.`,
      });
    } catch {
      setErro("Sem resposta do servidor. Nada foi mudado.");
    } finally {
      setSalvando(false);
    }
  }

  if (!mostrar) {
    return (
      <div className="border-b border-zinc-100 px-5 py-1.5 text-right">
        <button type="button" onClick={() => setAberto(true)} className="text-[11px] text-zinc-400 hover:text-violet-700 hover:underline">
          as mensagens estão do lado errado?
        </button>
      </div>
    );
  }

  return (
    <section aria-label="Corrigir os lados" className="space-y-2 border-b border-amber-100 bg-amber-50/50 px-5 py-3">
      <p className="text-xs text-amber-900">
        {lados.suspeita ? (
          <>
            <strong>Todas as falas estão de um lado só</strong>, mas há {lados.autores.length} autores — a leitura errou a direção. Qual deles é o nosso lado?
          </>
        ) : (
          "Qual autor é o nosso lado? As mensagens dele ficam à direita; as dos outros, do cliente."
        )}
      </p>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Nosso lado">
        {lados.autores.map((a) => (
          <button
            key={a.nome}
            type="button"
            role="radio"
            aria-checked={escolhido === a.nome}
            onClick={() => setNosso(a.nome)}
            className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition-colors ${
              escolhido === a.nome ? "bg-violet-700 text-white ring-violet-700" : "bg-white text-zinc-700 ring-zinc-200 hover:bg-zinc-50"
            }`}
          >
            {a.nome} <span className="opacity-70">({a.mensagens})</span>
          </button>
        ))}
      </div>
      {lados.semAutorESemHora > 0 && (
        <label className="flex items-center gap-2 text-xs text-zinc-600">
          <input type="checkbox" checked={avisos} onChange={(e) => setAvisos(e.target.checked)} />
          Marcar como aviso as {lados.semAutorESemHora} linha(s) sem autor e sem hora (o aviso de criptografia, a velocidade do áudio) — não apaga nada
        </label>
      )}
      <ErroDoServidor erro={erro} />
      <div className="flex justify-end gap-2">
        <RodapeDeSalvar salvando={salvando} desabilitado={!escolhido} rotulo="Salvar os lados" onSalvar={salvar} onCancelar={() => { setAberto(false); setNosso(null); setErro(null); }} />
      </div>
    </section>
  );
}

function Resumo({ conversa: c, onMudou }: { conversa: ConversaView; onMudou: (c: ConversaView) => void }) {
  const { notify } = useToast();
  const [rascunho, setRascunho] = useState<string | null>(null);
  const [pedindo, setPedindo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [peloMotor, setPeloMotor] = useState(false);

  async function pedir() {
    setPedindo(true);
    setErro(null);
    try {
      const r = await resumirConversa(c.id);
      if (!r.ok) return setErro(r.erro);
      setRascunho(r.resumo);
      setPeloMotor(r.provedor === "motor-proprio");
    } catch {
      setErro("A IA não respondeu agora. Tente de novo.");
    } finally {
      setPedindo(false);
    }
  }

  async function salvar() {
    if (rascunho === null) return;
    setSalvando(true);
    setErro(null);
    try {
      const r = await salvarResumo(c.id, rascunho);
      if (!r.ok) return setErro(r.erro);
      onMudou(r.conversa);
      setRascunho(null);
      notify({ tone: "success", title: rascunho.trim() ? "Resumo salvo" : "Resumo apagado" });
    } catch {
      setErro("Não foi possível falar com o servidor. O texto continua aqui.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <section aria-label="Resumo" className="border-b border-zinc-100 px-5 py-3">
      {rascunho !== null ? (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-700">Resumo — revise e salve se quiser guardar</p>
          {peloMotor && (
            <p className="text-xs text-zinc-500">Nenhuma IA respondeu agora; este rascunho saiu do motor próprio, pelas regras da documentação.</p>
          )}
          <textarea value={rascunho} onChange={(e) => setRascunho(e.target.value)} rows={6} aria-label="Resumo da conversa" className="w-full resize-y rounded-xl border border-zinc-200 p-3 text-sm leading-6 outline-none focus:border-violet-400" />
          <ErroDoServidor erro={erro} />
          <div className="flex justify-end gap-2">
            <RodapeDeSalvar salvando={salvando} rotulo="Salvar resumo" onSalvar={salvar} onCancelar={() => setRascunho(null)} />
          </div>
        </div>
      ) : c.resumo ? (
        <div className="flex items-start gap-3">
          <Sparkles size={15} className="mt-1 shrink-0 text-violet-500" />
          <div className="min-w-0 flex-1">
            <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-700">{c.resumo}</p>
            <p className="mt-1 text-[11px] text-zinc-400">
              Salvo por {c.resumoPor} em {descreverRegistro(c.resumoEm)} ·{" "}
              <button type="button" onClick={() => setRascunho(c.resumo ?? "")} className="font-medium text-violet-700 hover:underline">
                editar
              </button>{" "}
              ·{" "}
              <button type="button" onClick={pedir} disabled={pedindo} className="font-medium text-violet-700 hover:underline disabled:opacity-50">
                {pedindo ? "pedindo…" : "refazer com IA"}
              </button>
            </p>
            <ErroDoServidor erro={erro} />
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-zinc-500">Sem resumo. A IA lê as últimas mensagens e sugere; só fica gravado se você salvar.</p>
          <button type="button" onClick={pedir} disabled={pedindo} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium text-violet-700 ring-1 ring-inset ring-violet-200 transition-colors hover:bg-violet-50 disabled:opacity-50">
            {pedindo ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} Resumir com IA
          </button>
          <ErroDoServidor erro={erro} />
        </div>
      )}
    </section>
  );
}
