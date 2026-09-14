"use client";

import { createElement, useEffect, useState, type ComponentType } from "react";
import Link from "next/link";

import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  Database,
  ExternalLink,
  Eye,
  EyeOff,
  FileBarChart,
  FileSpreadsheet,
  Gauge,
  Hash,
  KeyRound,
  LifeBuoy,
  Link2,
  Loader2,
  Mail,
  MessageCircle,
  MessageSquareWarning,
  Pencil,
  PhoneCall,
  Plus,
  ShieldCheck,
  Siren,
  Store,
  Trash2,
  Video,
} from "lucide-react";

import PageHeading from "@/components/shared/PageHeading";
import PorQue from "@/components/shared/PorQue";
import Modal, { ConfirmDelete } from "@/components/shared/Modal";
import { ErroDoServidor, RodapeDeSalvar, Rotulo } from "@/components/shared/Rodape";

import { useToast } from "@/lib/context/ToastContext";

import { excluirAtalho, importarAtalhosDoDocumento, listarAtalhos, moverAtalho, salvarAtalho } from "@/lib/actions/atalhos";
import { ATALHOS_DO_DOCUMENTO, LEMBRETES_DE_SEGURANCA } from "@/lib/documentos/atalhosDoDocumento";
import { dominioDe, enderecoValido, normalizarEndereco, type Atalho } from "@/lib/models/atalho";

const ICONES: Record<string, ComponentType<{ size?: number; className?: string }>> = {
  "whatsapp-web": MessageCircle,
  "portal-cardapio-web": Store,
  "central-de-ajuda": LifeBuoy,
  "reclame-aqui-empresa": MessageSquareWarning,
  hugme: BarChart3,
  wootric: Gauge,
  "cw-engine": Database,
  slack: Hash,
  "slack-incidentes": Siren,
  gmail: Mail,
  "google-meet": Video,
  meetime: PhoneCall,
  "relatorio-do-ciclo": FileBarChart,
};

function iconeDe(a: Atalho) {
  return ICONES[a.chave] ?? (a.grupo === "planilha" ? FileSpreadsheet : Link2);
}

const campo =
  "h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-violet-400";

type Rascunho = Pick<Atalho, "nome" | "url" | "grupo" | "descricao" | "acesso" | "ativo"> & { id?: string };

/**
 * Ferramentas e Acessos, a um clique.
 *
 * A lista do documento vira atalhos com o endereço que a gestão
 * configurar — e com o jeito certo de entrar em cada ferramenta ao lado,
 * porque o documento é sobretudo sobre isso: não salvar senha, não
 * repassar acesso. A edição é no próprio cartão (nada de formulário
 * comprido em janela), com Salvar confirmado pelo servidor. A mesma
 * lista aparece no popup da extensão.
 */
export default function FerramentasEAcessos() {
  const { notify } = useToast();

  const [atalhos, setAtalhos] = useState<Atalho[] | null>(null);
  const [erroDaCarga, setErroDaCarga] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState<Rascunho | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [importando, setImportando] = useState(false);
  const [excluindo, setExcluindo] = useState<Atalho>();

  useEffect(() => {
    let vivo = true;
    listarAtalhos()
      .then((r) => {
        if (!vivo) return;
        if (r.ok) setAtalhos(r.atalhos);
        else setErroDaCarga(r.erro);
      })
      .catch(() => vivo && setErroDaCarga("Não foi possível carregar os atalhos. Recarregue a página."));
    return () => {
      vivo = false;
    };
  }, []);

  const lista = atalhos ?? [];
  const visiveis = lista.filter((a) => editando || a.ativo);
  const ferramentas = visiveis.filter((a) => a.grupo === "ferramenta");
  const planilhas = visiveis.filter((a) => a.grupo === "planilha");
  const faltam = ATALHOS_DO_DOCUMENTO.filter((d) => !lista.some((a) => a.chave === d.chave));
  const semEndereco = lista.filter((a) => a.ativo && !a.url).length;

  function editar(a?: Atalho, grupo: Atalho["grupo"] = "ferramenta") {
    setErro(null);
    setRascunho(a ? { id: a.id, nome: a.nome, url: a.url, grupo: a.grupo, descricao: a.descricao, acesso: a.acesso, ativo: a.ativo } : { nome: "", url: "", grupo, descricao: "", acesso: "", ativo: true });
  }

  async function salvar() {
    if (!rascunho || salvando) return;
    setSalvando(true);
    setErro(null);
    try {
      const r = await salvarAtalho(rascunho);
      if (!r.ok) return setErro(r.erro);
      setAtalhos((atual) => {
        const outros = (atual ?? []).filter((a) => a.id !== r.atalho.id);
        return [...outros, r.atalho].sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, "pt-BR"));
      });
      notify({ tone: "success", title: rascunho.id ? "Atalho salvo" : "Atalho criado", detail: r.atalho.nome });
      setRascunho(null);
    } catch {
      setErro("Não foi possível falar com o servidor. O que foi digitado continua aqui.");
    } finally {
      setSalvando(false);
    }
  }

  async function mover(a: Atalho, direcao: "subir" | "descer") {
    const r = await moverAtalho(a.id, direcao).catch(() => null);
    if (!r || !r.ok) return notify({ tone: "error", title: "A ordem não mudou", detail: r && !r.ok ? r.erro : "Sem resposta do servidor." });
    setAtalhos(r.atalhos);
  }

  async function alternarAtivo(a: Atalho) {
    const r = await salvarAtalho({ ...a, ativo: !a.ativo }).catch(() => null);
    if (!r || !r.ok) return notify({ tone: "error", title: "Não foi alterado", detail: r && !r.ok ? r.erro : "Sem resposta do servidor." });
    setAtalhos((atual) => (atual ?? []).map((x) => (x.id === a.id ? r.atalho : x)));
    notify({ tone: "success", title: r.atalho.ativo ? "Atalho mostrado" : "Atalho escondido", detail: r.atalho.ativo ? "Volta para a página e para o popup da extensão." : "Sai da página e do popup; continua guardado aqui." });
  }

  async function confirmarExclusao() {
    if (!excluindo) return;
    const alvo = excluindo;
    const r = await excluirAtalho(alvo.id).catch(() => null);
    if (!r || !r.ok) return notify({ tone: "error", title: "O atalho não foi excluído", detail: r && !r.ok ? r.erro : "Sem resposta do servidor." });
    setAtalhos((atual) => (atual ?? []).filter((x) => x.id !== alvo.id));
    setExcluindo(undefined);
    notify({ tone: "success", title: "Atalho excluído", detail: alvo.nome });
  }

  const editor = (grupo: Atalho["grupo"]) =>
    rascunho && !rascunho.id && rascunho.grupo === grupo ? <EditorDoAtalho rascunho={rascunho} onMudar={setRascunho} salvando={salvando} erro={erro} onSalvar={salvar} onCancelar={() => setRascunho(null)} /> : null;

  return (
    <div className="space-y-6">
      <PageHeading eyebrow="Conhecimento" title="Ferramentas e acessos" description="As ferramentas do dia a dia a um clique, com o jeito certo de entrar em cada uma. A mesma lista aparece no popup da extensão.">
        {atalhos && (
          <button
            type="button"
            onClick={() => {
              setEditando((e) => !e);
              setRascunho(null);
            }}
            aria-pressed={editando}
            className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium ring-1 ring-inset transition-colors ${
              editando ? "bg-violet-700 text-white ring-violet-700 hover:bg-violet-800" : "bg-white text-zinc-700 ring-zinc-200 hover:bg-zinc-50"
            }`}
          >
            <Pencil size={15} /> {editando ? "Concluir edição" : "Editar atalhos"}
          </button>
        )}
      </PageHeading>

      <section className="flex flex-wrap items-start gap-4 rounded-2xl bg-amber-50/70 px-5 py-4 ring-1 ring-inset ring-amber-100">
        <ShieldCheck size={22} className="mt-0.5 shrink-0 text-amber-600" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h2 className="text-sm font-semibold text-amber-950">Lembretes de segurança</h2>
            <PorQue chave="ferramentas.acessos" />
          </div>
          <ul className="mt-1.5 grid gap-x-6 gap-y-1 text-sm leading-6 text-amber-900 md:grid-cols-2">
            {LEMBRETES_DE_SEGURANCA.map((l) => (
              <li key={l} className="flex gap-2">
                <span aria-hidden className="mt-2.5 h-1 w-1 shrink-0 rounded-full bg-amber-500" />
                {l}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {erroDaCarga && <ErroDoServidor erro={erroDaCarga} />}

      {!atalhos && !erroDaCarga && (
        <p className="flex items-center justify-center gap-2 py-16 text-sm text-zinc-500">
          <Loader2 size={16} className="animate-spin" /> Carregando os atalhos…
        </p>
      )}

      {atalhos && faltam.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-violet-50/60 px-4 py-3 ring-1 ring-inset ring-violet-100">
          <p className="text-sm leading-6 text-violet-950">
            {faltam.length === ATALHOS_DO_DOCUMENTO.length
              ? `As ${faltam.length} ferramentas e planilhas do documento ainda não estão aqui.`
              : `Faltam ${faltam.length} ${faltam.length === 1 ? "ferramenta" : "ferramentas"} do documento: ${faltam.map((f) => f.nome).join(", ")}.`}
          </p>
          <button type="button" onClick={() => setImportando(true)} className="rounded-xl bg-violet-700 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-violet-800">
            Ver e importar
          </button>
        </div>
      )}

      {atalhos && semEndereco > 0 && (
        <p className="text-xs text-zinc-500">
          {semEndereco} {semEndereco === 1 ? "atalho está" : "atalhos estão"} sem endereço — o documento diz &ldquo;link fornecido pela gestão&rdquo;. Clique em &ldquo;Configurar o endereço&rdquo; no cartão.
        </p>
      )}

      {atalhos && (
        <>
          <section aria-labelledby="titulo-ferramentas">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5">
                <h2 id="titulo-ferramentas" className="text-sm font-semibold text-zinc-800">Ferramentas</h2>
                <PorQue chave="ferramentas.lista" />
              </div>
              {editando && (
                <button type="button" onClick={() => editar(undefined, "ferramenta")} className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-violet-700 hover:bg-violet-50">
                  <Plus size={13} /> Nova ferramenta
                </button>
              )}
            </div>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {ferramentas.map((a, i) => (
                <li key={a.id}>
                  {rascunho?.id === a.id ? (
                    <EditorDoAtalho rascunho={rascunho} onMudar={setRascunho} salvando={salvando} erro={erro} onSalvar={salvar} onCancelar={() => setRascunho(null)} />
                  ) : (
                    <CartaoDoAtalho
                      atalho={a}
                      editando={editando}
                      primeiro={i === 0}
                      ultimo={i === ferramentas.length - 1}
                      onEditar={() => editar(a)}
                      onMover={(d) => mover(a, d)}
                      onAlternar={() => alternarAtivo(a)}
                      onExcluir={() => setExcluindo(a)}
                    />
                  )}
                </li>
              ))}
              {editor("ferramenta") && <li>{editor("ferramenta")}</li>}
            </ul>
            {ferramentas.length === 0 && !editor("ferramenta") && (
              <p className="mt-3 rounded-2xl border border-dashed border-zinc-200 bg-white py-10 text-center text-sm text-zinc-500">Nenhuma ferramenta ainda. Importe a lista do documento ou crie uma.</p>
            )}
          </section>

          <section aria-labelledby="titulo-planilhas">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5">
                <h2 id="titulo-planilhas" className="text-sm font-semibold text-zinc-800">Planilhas</h2>
                <PorQue chave="ferramentas.planilhas" />
              </div>
              {editando && (
                <button type="button" onClick={() => editar(undefined, "planilha")} className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-violet-700 hover:bg-violet-50">
                  <Plus size={13} /> Nova planilha
                </button>
              )}
            </div>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {planilhas.map((a, i) => (
                <li key={a.id}>
                  {rascunho?.id === a.id ? (
                    <EditorDoAtalho rascunho={rascunho} onMudar={setRascunho} salvando={salvando} erro={erro} onSalvar={salvar} onCancelar={() => setRascunho(null)} />
                  ) : (
                    <CartaoDoAtalho
                      atalho={a}
                      editando={editando}
                      primeiro={i === 0}
                      ultimo={i === planilhas.length - 1}
                      onEditar={() => editar(a)}
                      onMover={(d) => mover(a, d)}
                      onAlternar={() => alternarAtivo(a)}
                      onExcluir={() => setExcluindo(a)}
                    />
                  )}
                </li>
              ))}
              {editor("planilha") && <li>{editor("planilha")}</li>}
            </ul>
          </section>
        </>
      )}

      {importando && (
        <ImportarAtalhos
          faltam={faltam}
          onClose={() => setImportando(false)}
          onImportado={(novos, criados) => {
            setAtalhos(novos);
            setImportando(false);
            notify({ tone: "success", title: "Ferramentas importadas", detail: `${criados} ${criados === 1 ? "atalho criado" : "atalhos criados"}. Os sem endereço pedem o link da gestão.` });
          }}
        />
      )}

      <ConfirmDelete open={Boolean(excluindo)} label={excluindo?.nome ?? ""} onCancel={() => setExcluindo(undefined)} onConfirm={confirmarExclusao} />
    </div>
  );
}

function CartaoDoAtalho({
  atalho: a,
  editando,
  primeiro,
  ultimo,
  onEditar,
  onMover,
  onAlternar,
  onExcluir,
}: {
  atalho: Atalho;
  editando: boolean;
  primeiro: boolean;
  ultimo: boolean;
  onEditar: () => void;
  onMover: (d: "subir" | "descer") => void;
  onAlternar: () => void;
  onExcluir: () => void;
}) {
  const interno = a.url.startsWith("/");
  const abrir = "inline-flex items-center gap-1.5 rounded-xl bg-violet-700 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-violet-800";

  return (
    <article className={`flex h-full flex-col rounded-2xl border bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] ${a.ativo ? "border-zinc-200/80" : "border-dashed border-zinc-200 opacity-60"}`}>
      <div className="flex items-start gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${a.grupo === "planilha" ? "bg-emerald-50 text-emerald-700" : "bg-violet-50 text-violet-700"}`}>
          {/* createElement: o ícone vem de um mapa, não é um componente criado aqui. */}
          {createElement(iconeDe(a), { size: 19 })}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold leading-snug text-zinc-900">{a.nome}</h3>
          <p className="truncate text-xs text-zinc-400">{a.url ? dominioDe(a.url) : "sem endereço"}</p>
        </div>
        {!editando &&
          a.url &&
          (interno ? (
            <Link href={a.url} className={abrir}>
              Abrir
            </Link>
          ) : (
            <a href={a.url} target="_blank" rel="noopener noreferrer" className={abrir} aria-label={`Abrir ${a.nome} em outra aba`}>
              Abrir <ExternalLink size={12} />
            </a>
          ))}
      </div>

      {a.descricao && <p className="mt-2.5 text-sm leading-6 text-zinc-600">{a.descricao}</p>}
      {a.acesso && (
        <p className="mt-2 flex items-start gap-1.5 text-xs leading-5 text-zinc-500">
          <KeyRound size={12} className="mt-1 shrink-0 text-amber-500" />
          {a.acesso}
        </p>
      )}

      <div className="mt-auto pt-3">
        {!a.url && !editando && (
          <button type="button" onClick={onEditar} className="w-full rounded-xl border border-dashed border-violet-300 py-2 text-xs font-medium text-violet-700 transition-colors hover:bg-violet-50">
            Configurar o endereço
          </button>
        )}
        {editando && (
          <div className="flex flex-wrap items-center gap-1 border-t border-zinc-100 pt-2.5">
            <button type="button" onClick={onEditar} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-violet-700 hover:bg-violet-50">
              <Pencil size={12} /> Editar
            </button>
            <button type="button" onClick={onAlternar} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100">
              {a.ativo ? <EyeOff size={12} /> : <Eye size={12} />} {a.ativo ? "Esconder" : "Mostrar"}
            </button>
            <span className="ml-auto flex items-center">
              <button type="button" onClick={() => onMover("subir")} disabled={primeiro} aria-label={`Subir ${a.nome}`} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 disabled:opacity-30">
                <ArrowUp size={13} />
              </button>
              <button type="button" onClick={() => onMover("descer")} disabled={ultimo} aria-label={`Descer ${a.nome}`} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 disabled:opacity-30">
                <ArrowDown size={13} />
              </button>
              <button type="button" onClick={onExcluir} aria-label={`Excluir ${a.nome}`} className="rounded-lg p-1.5 text-zinc-400 hover:bg-rose-50 hover:text-rose-600">
                <Trash2 size={13} />
              </button>
            </span>
          </div>
        )}
      </div>
    </article>
  );
}

function EditorDoAtalho({
  rascunho,
  onMudar,
  salvando,
  erro,
  onSalvar,
  onCancelar,
}: {
  rascunho: Rascunho;
  onMudar: (r: Rascunho) => void;
  salvando: boolean;
  erro: string | null;
  onSalvar: () => void;
  onCancelar: () => void;
}) {
  const valido = rascunho.nome.trim() !== "" && enderecoValido(normalizarEndereco(rascunho.url));
  const mudar = <K extends keyof Rascunho>(k: K, v: Rascunho[K]) => onMudar({ ...rascunho, [k]: v });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (valido) onSalvar();
      }}
      className="h-full space-y-3 rounded-2xl border border-violet-200 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]"
    >
      <label className="block space-y-1">
        <Rotulo>Nome</Rotulo>
        <input autoFocus value={rascunho.nome} onChange={(e) => mudar("nome", e.target.value)} className={campo} placeholder="Ex.: HugMe" />
      </label>
      <label className="block space-y-1">
        <Rotulo>Endereço</Rotulo>
        <input value={rascunho.url} onChange={(e) => mudar("url", e.target.value)} className={campo} placeholder="https://… ou /relatorio" inputMode="url" />
      </label>
      <label className="block space-y-1">
        <Rotulo>Para que serve</Rotulo>
        <input value={rascunho.descricao} onChange={(e) => mudar("descricao", e.target.value)} className={campo} />
      </label>
      <label className="block space-y-1">
        <Rotulo>Como acessar</Rotulo>
        <input value={rascunho.acesso} onChange={(e) => mudar("acesso", e.target.value)} className={campo} placeholder="Ex.: login fornecido pela gestão; não salvar a senha." />
      </label>
      <ErroDoServidor erro={erro} />
      <div className="flex justify-end gap-2 pt-1">
        <RodapeDeSalvar salvando={salvando} desabilitado={!valido} onSalvar={onSalvar} onCancelar={onCancelar} />
      </div>
    </form>
  );
}

function ImportarAtalhos({
  faltam,
  onClose,
  onImportado,
}: {
  faltam: typeof ATALHOS_DO_DOCUMENTO;
  onClose: () => void;
  onImportado: (atalhos: Atalho[], criados: number) => void;
}) {
  const [marcados, setMarcados] = useState<Set<string>>(() => new Set(faltam.map((f) => f.chave)));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function importar() {
    setSalvando(true);
    setErro(null);
    try {
      const r = await importarAtalhosDoDocumento([...marcados]);
      if (!r.ok) return setErro(r.erro);
      onImportado(r.atalhos, r.criados);
    } catch {
      setErro("Não foi possível falar com o servidor. Nada foi importado — tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      open
      porque="ferramentas.lista"
      title="Importar as ferramentas do documento"
      description="Os que o documento diz “link fornecido pela gestão” chegam sem endereço, para você configurar."
      onClose={onClose}
      footer={<RodapeDeSalvar salvando={salvando} desabilitado={marcados.size === 0} rotulo={`Importar ${marcados.size}`} onSalvar={importar} onCancelar={onClose} />}
    >
      <ul className="divide-y divide-zinc-100 overflow-hidden rounded-2xl ring-1 ring-inset ring-zinc-200">
        {faltam.map((f) => (
          <li key={f.chave}>
            <label className="flex cursor-pointer items-start gap-3 px-4 py-2.5 hover:bg-zinc-50">
              <input
                type="checkbox"
                checked={marcados.has(f.chave)}
                onChange={() =>
                  setMarcados((m) => {
                    const n = new Set(m);
                    if (n.has(f.chave)) n.delete(f.chave);
                    else n.add(f.chave);
                    return n;
                  })
                }
                className="mt-1 h-4 w-4 accent-violet-700"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-zinc-900">
                  {f.nome} <span className="text-xs font-normal text-zinc-400">· {f.grupo === "planilha" ? "planilha" : "ferramenta"}</span>
                </span>
                <span className="block truncate text-xs text-zinc-500">{f.url ? dominioDe(f.url) : "sem endereço — a gestão informa"}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <ErroDoServidor erro={erro} />
    </Modal>
  );
}
