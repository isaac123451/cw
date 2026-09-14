"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

import {
  Bold,
  Eye,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  MessageSquareText,
  PencilLine,
  Table2,
} from "lucide-react";

import Markdown from "@/components/documentacao/Markdown";
import { ErroDoServidor, RodapeDeSalvar, Rotulo } from "@/components/shared/Rodape";

import { useDocs } from "@/lib/context/DocsContext";
import { useSession } from "@/lib/context/SessionContext";
import { useToast } from "@/lib/context/ToastContext";

import { salvarDocumento } from "@/lib/actions/documentos";
import { markdownDosPassos, type Playbook } from "@/lib/models/playbook";

const campo =
  "h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-violet-400";

const AJUDA = `## Título de uma seção

Um parágrafo explicando o processo, com **negrito** onde importa.

- Um item de lista
- Outro item

1. Primeiro passo
2. Segundo passo

> @setor-responsável
> [Saudação]! Modelo de mensagem para copiar.`;

/**
 * O documento aberto para edição, na própria página.
 *
 * Não é um diálogo: o texto de um documento do time tem cem linhas, e
 * editar isso numa janela por cima da tela é a "usabilidade zero" que o
 * Isaac apontou. A barra de cima insere a marcação sem precisar
 * decorar; "Ver como fica" mostra o documento como a leitura vai
 * mostrar. Ctrl+S salva. O Salvar só confirma com a resposta do
 * servidor, e o que foi digitado fica se ele recusar.
 */
export default function EditorDoDocumento({
  documento,
  escopos,
  onSalvo,
  onCancelar,
}: {
  /** Sem documento, é um documento novo. */
  documento?: Playbook;
  escopos: string[];
  onSalvo: (doc: Playbook) => void;
  onCancelar: () => void;
}) {
  const { aplicarDoServidor } = useDocs();
  const { notify } = useToast();
  const sessao = useSession();

  const inicial = {
    titulo: documento?.title ?? "",
    escopo: documento?.scope ?? "",
    resumo: documento?.summary ?? "",
    conteudo: documento ? documento.conteudo ?? markdownDosPassos(documento) : "",
    responsavel: documento?.owner ?? sessao?.name ?? "",
    versao: documento?.version ?? "1.0",
    confluenceUrl: documento?.confluenceUrl ?? "",
  };

  const [valores, setValores] = useState(inicial);
  const [modo, setModo] = useState<"escrever" | "ver">("escrever");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [descartar, setDescartar] = useState(false);
  const texto = useRef<HTMLTextAreaElement>(null);
  const cursorPendente = useRef<number | null>(null);

  const sujo = (Object.keys(inicial) as (keyof typeof inicial)[]).some((k) => valores[k] !== inicial[k]);
  const valido = valores.titulo.trim() !== "" && valores.conteudo.trim() !== "";
  /* O documento em etapas vale salvar mesmo sem mexer: é o que o converte em texto. */
  const temOQueSalvar = sujo || Boolean(documento && !documento.conteudo);

  /* Fechar a aba com o texto por salvar pede confirmação ao navegador. */
  useEffect(() => {
    if (!sujo) return;
    const aviso = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", aviso);
    return () => window.removeEventListener("beforeunload", aviso);
  }, [sujo]);

  function mudar<K extends keyof typeof inicial>(k: K, v: string) {
    setValores((atual) => ({ ...atual, [k]: v }));
  }

  /** Põe a marcação em volta da seleção, ou no começo das linhas selecionadas. */
  function marcar(tipo: "h2" | "h3" | "negrito" | "lista" | "numerada" | "modelo" | "tabela") {
    const el = texto.current;
    if (!el) return;
    const { selectionStart: ini, selectionEnd: fim, value } = el;
    let novo = value;
    let cursor = fim;

    if (tipo === "negrito") {
      const sel = value.slice(ini, fim) || "texto em negrito";
      novo = `${value.slice(0, ini)}**${sel}**${value.slice(fim)}`;
      cursor = ini + sel.length + 4;
    } else if (tipo === "tabela") {
      const tabela = `\n| Coluna | Coluna |\n| --- | --- |\n| Valor | Valor |\n`;
      novo = `${value.slice(0, fim)}${tabela}${value.slice(fim)}`;
      cursor = fim + tabela.length;
    } else {
      const prefixo = { h2: "## ", h3: "### ", lista: "- ", numerada: "1. ", modelo: "> " }[tipo];
      const comeco = value.lastIndexOf("\n", ini - 1) + 1;
      const linhas = value.slice(comeco, fim).split("\n");
      const marcadas = linhas
        .map((l, i) => (tipo === "numerada" ? `${i + 1}. ` : prefixo) + l.replace(/^(#{1,4}\s+|[-*+]\s+|\d+[.)]\s+|>\s?)/, ""))
        .join("\n");
      novo = `${value.slice(0, comeco)}${marcadas}${value.slice(fim)}`;
      cursor = comeco + marcadas.length;
    }

    mudar("conteudo", novo);
    cursorPendente.current = cursor;
  }

  /*
    O cursor volta para depois da marcação assim que o texto novo está na
    tela. Era um requestAnimationFrame — que não roda com a aba em
    segundo plano, e aí o que se digitava ia parar no começo do texto.
  */
  useLayoutEffect(() => {
    const el = texto.current;
    if (!el || cursorPendente.current === null) return;
    el.focus();
    el.setSelectionRange(cursorPendente.current, cursorPendente.current);
    cursorPendente.current = null;
  });

  async function salvar() {
    if (!valido || !temOQueSalvar || salvando) return;
    setSalvando(true);
    setErro(null);
    try {
      const r = await salvarDocumento({ id: documento?.id, ...valores });
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      aplicarDoServidor([r.documento]);
      notify({ tone: "success", title: documento ? "Documento salvo" : "Documento criado", detail: r.documento.title });
      onSalvo(r.documento);
    } catch {
      setErro("Não foi possível falar com o servidor. O texto continua aqui — tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  function cancelar() {
    if (sujo && !descartar) return setDescartar(true);
    onCancelar();
  }

  const BOTOES = [
    { tipo: "h2", icone: Heading2, rotulo: "Seção" },
    { tipo: "h3", icone: Heading3, rotulo: "Subseção" },
    { tipo: "negrito", icone: Bold, rotulo: "Negrito" },
    { tipo: "lista", icone: List, rotulo: "Lista" },
    { tipo: "numerada", icone: ListOrdered, rotulo: "Lista numerada" },
    { tipo: "modelo", icone: MessageSquareText, rotulo: "Modelo de mensagem" },
    { tipo: "tabela", icone: Table2, rotulo: "Tabela" },
  ] as const;

  return (
    <section
      aria-label={documento ? `Editando ${documento.title}` : "Novo documento"}
      onKeyDown={(e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
          e.preventDefault();
          salvar();
        }
      }}
      className="rounded-3xl border border-violet-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]"
    >
      <div className="space-y-4 border-b border-zinc-100 p-5 sm:p-6">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-700">{documento ? "Editando o documento" : "Novo documento"}</p>

        <input
          value={valores.titulo}
          onChange={(e) => mudar("titulo", e.target.value)}
          placeholder="Título do documento"
          aria-label="Título do documento"
          className="w-full border-0 bg-transparent p-0 text-2xl font-semibold text-zinc-900 outline-none placeholder:text-zinc-300"
        />

        <textarea
          value={valores.resumo}
          onChange={(e) => mudar("resumo", e.target.value)}
          rows={2}
          placeholder="Resumo: o que este documento cobre, em uma ou duas frases."
          aria-label="Resumo"
          className="w-full resize-none border-0 bg-transparent p-0 text-sm leading-6 text-zinc-600 outline-none placeholder:text-zinc-300"
        />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block space-y-1">
            <Rotulo>Grupo</Rotulo>
            <input list="escopos-dos-documentos" value={valores.escopo} onChange={(e) => mudar("escopo", e.target.value)} placeholder="Ex.: NPS" className={campo} />
            <datalist id="escopos-dos-documentos">
              {escopos.map((e) => (
                <option key={e} value={e} />
              ))}
            </datalist>
          </label>
          <label className="block space-y-1">
            <Rotulo>Responsável</Rotulo>
            <input value={valores.responsavel} onChange={(e) => mudar("responsavel", e.target.value)} className={campo} />
          </label>
          <label className="block space-y-1">
            <Rotulo>Versão</Rotulo>
            <input value={valores.versao} onChange={(e) => mudar("versao", e.target.value)} placeholder="1.0" className={campo} />
          </label>
          <label className="block space-y-1">
            <Rotulo>Confluence (opcional)</Rotulo>
            <input value={valores.confluenceUrl} onChange={(e) => mudar("confluenceUrl", e.target.value)} placeholder="https://…" className={campo} />
          </label>
        </div>

        {documento && !documento.conteudo && documento.steps.length > 0 && (
          <p className="rounded-xl bg-sky-50/70 px-3.5 py-2.5 text-xs leading-5 text-sky-900 ring-1 ring-inset ring-sky-100">
            Este documento estava em etapas. Elas vieram escritas como texto abaixo — ajuste o que quiser; ao salvar, ele passa a ser lido como os outros. As etapas antigas continuam guardadas.
          </p>
        )}
      </div>

      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 bg-white/95 px-3 py-2 sm:px-5">
        <div className="flex flex-wrap items-center gap-0.5" role="toolbar" aria-label="Formatação">
          {BOTOES.map(({ tipo, icone: Icone, rotulo }) => (
            <button
              key={tipo}
              type="button"
              onClick={() => marcar(tipo)}
              /* O texto não perde o foco (nem a seleção) ao clicar na barra. */
              onMouseDown={(e) => e.preventDefault()}
              disabled={modo === "ver"}
              title={rotulo}
              aria-label={rotulo}
              className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-violet-50 hover:text-violet-700 disabled:opacity-30"
            >
              <Icone size={16} />
            </button>
          ))}
        </div>
        <div className="flex rounded-xl bg-zinc-100 p-0.5 text-xs font-medium">
          {(
            [
              ["escrever", "Escrever", PencilLine],
              ["ver", "Ver como fica", Eye],
            ] as const
          ).map(([m, rotulo, Icone]) => (
            <button
              key={m}
              type="button"
              onClick={() => setModo(m)}
              aria-pressed={modo === m}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-colors ${modo === m ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-800"}`}
            >
              <Icone size={13} /> {rotulo}
            </button>
          ))}
        </div>
      </div>

      <div className="p-5 sm:p-6">
        {modo === "escrever" ? (
          <textarea
            ref={texto}
            value={valores.conteudo}
            onChange={(e) => mudar("conteudo", e.target.value)}
            placeholder={AJUDA}
            aria-label="Texto do documento"
            spellCheck
            className="min-h-[60vh] w-full resize-y rounded-2xl border border-zinc-200 bg-zinc-50/40 p-4 font-mono text-[13px] leading-6 text-zinc-800 outline-none transition-colors placeholder:text-zinc-300 focus:border-violet-300 focus:bg-white"
          />
        ) : valores.conteudo.trim() ? (
          <article className="min-h-[60vh]">
            <Markdown conteudo={valores.conteudo} />
          </article>
        ) : (
          <p className="py-16 text-center text-sm text-zinc-400">O texto está vazio.</p>
        )}
        <ErroDoServidor erro={erro} />
      </div>

      <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 rounded-b-3xl border-t border-zinc-100 bg-white/95 px-5 py-3 sm:px-6">
        {descartar ? (
          <p className="text-sm text-amber-800">
            Sair sem salvar? O que foi mudado se perde.{" "}
            <button type="button" onClick={onCancelar} className="font-semibold underline underline-offset-2">
              Descartar
            </button>{" "}
            ·{" "}
            <button type="button" onClick={() => setDescartar(false)} className="font-semibold text-violet-700 underline underline-offset-2">
              Continuar editando
            </button>
          </p>
        ) : (
          <p className="text-xs text-zinc-400">{sujo ? "Mudanças por salvar · Ctrl+S salva" : "Sem mudanças"}</p>
        )}
        <div className="flex gap-2">
          <RodapeDeSalvar salvando={salvando} desabilitado={!valido || !temOQueSalvar} rotulo={documento ? "Salvar" : "Criar documento"} onSalvar={salvar} onCancelar={cancelar} />
        </div>
      </div>
    </section>
  );
}
