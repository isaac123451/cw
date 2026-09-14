"use client";

import {
  BookOpenCheck,
  Check,
  ChevronDown,
  CircleAlert,
  Clock3,
  ExternalLink,
  Link2,
  ListTree,
  Pencil,
  Trash2,
  UserRound,
} from "lucide-react";

import Markdown from "@/components/documentacao/Markdown";

import { ORIGEM_DOS_DOCUMENTOS_DO_TIME } from "@/lib/documentos/indice";
import { secoesDoDocumento, tituloSemEmoji, type Playbook, type SecaoDoDocumento } from "@/lib/models/playbook";

/** "2026-09-14" → "14/09/2026". */
function dataCurta(iso: string) {
  const [a, m, d] = iso.slice(0, 10).split("-");
  return d && m && a ? `${d}/${m}/${a}` : iso;
}

/**
 * O documento aberto.
 *
 * O índice "Nesta página" mora na lista da esquerda, abrindo as seções
 * do documento aberto; aqui ele só aparece na tela estreita, onde a
 * lista fica em cima e some da vista ao rolar.
 */
export default function LeitorDoDocumento({
  doc,
  destaque,
  ativa,
  onEditar,
  onExcluir,
  onIrParaSecao,
  aoCopiarLink,
}: {
  doc: Playbook;
  destaque: string;
  /** A seção no topo da leitura (`useSecaoAtiva`). */
  ativa: string | null;
  onEditar: () => void;
  onExcluir: () => void;
  onIrParaSecao: (ancora: string) => void;
  /** Sem âncora, o link do documento. */
  aoCopiarLink: (ancora?: string) => void;
}) {
  const secoes = doc.conteudo ? secoesDoDocumento(doc.conteudo) : [];
  const doTime = doc.origem === ORIGEM_DOS_DOCUMENTOS_DO_TIME;

  return (
      <article className="min-w-0 rounded-3xl border border-zinc-200/80 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <header className="border-b border-zinc-100 p-5 sm:p-7">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-700 ring-1 ring-inset ring-violet-100">{doc.scope || "Sem grupo"}</span>
            {doTime && (
              <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-100">
                <BookOpenCheck size={12} /> Documento do time
              </span>
            )}
            {!doc.conteudo && doc.steps.length > 0 && (
              <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-medium text-zinc-600">Em etapas</span>
            )}
          </div>

          <h1 className="mt-3 text-2xl font-semibold leading-tight text-zinc-900 sm:text-[28px]">{doc.title}</h1>
          {doc.summary && <p className="mt-2 max-w-3xl text-[15px] leading-7 text-zinc-600">{doc.summary}</p>}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
              <span className="flex items-center gap-1">
                <UserRound size={12} /> {doc.owner}
              </span>
              <span>Versão {doc.version}</span>
              <span>Atualizado em {dataCurta(doc.updatedAt)}</span>
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={onEditar}
                className="flex items-center gap-1.5 rounded-xl bg-violet-700 px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-violet-800"
              >
                <Pencil size={13} /> Editar
              </button>
              <button
                type="button"
                onClick={() => aoCopiarLink()}
                className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium text-zinc-600 ring-1 ring-inset ring-zinc-200 transition-colors hover:bg-zinc-50"
              >
                <Link2 size={13} /> Copiar link
              </button>
              {doc.confluenceUrl && (
                <a
                  href={doc.confluenceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium text-sky-700 ring-1 ring-inset ring-sky-200 transition-colors hover:bg-sky-50"
                >
                  <ExternalLink size={13} /> Confluence
                </a>
              )}
              <button
                type="button"
                onClick={onExcluir}
                title="Excluir documento"
                aria-label="Excluir documento"
                className="rounded-xl p-2 text-zinc-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        </header>

        {secoes.length > 1 && (
          <details className="group border-b border-zinc-100 px-5 py-3 sm:px-7 lg:hidden">
            <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              <ListTree size={14} /> Nesta página · {secoes.filter((s) => s.nivel === 2).length} seções
              <ChevronDown size={14} className="ml-auto transition-transform group-open:rotate-180" />
            </summary>
            <Indice secoes={secoes} ativa={ativa} onIr={onIrParaSecao} className="mt-3" />
          </details>
        )}

        <div className="p-5 sm:p-7">
          {doc.conteudo ? (
            <Markdown conteudo={doc.conteudo} destaque={destaque} aoCopiarLink={(a) => aoCopiarLink(a)} />
          ) : (
            <PassosAntigos doc={doc} />
          )}
        </div>
      </article>
  );
}

function Indice({ secoes, ativa, onIr, className = "" }: { secoes: SecaoDoDocumento[]; ativa: string | null; onIr: (ancora: string) => void; className?: string }) {
  return (
    <nav aria-label="Seções do documento" className={className}>
      <ol className="space-y-0.5 border-l border-zinc-100">
        {secoes.map((s) => {
          const atual = s.ancora === ativa;
          return (
            <li key={s.ancora}>
              <a
                href={`#${s.ancora}`}
                onClick={(e) => {
                  e.preventDefault();
                  onIr(s.ancora);
                }}
                aria-current={atual ? "location" : undefined}
                className={`-ml-px block border-l-2 py-1 pr-2 text-[13px] leading-5 transition-colors ${s.nivel === 3 ? "pl-6 text-zinc-500" : "pl-3 font-medium"} ${
                  atual ? "border-violet-600 text-violet-800" : "border-transparent text-zinc-600 hover:border-zinc-300 hover:text-zinc-900"
                }`}
              >
                {tituloSemEmoji(s.titulo)}
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Os playbooks antigos, em etapas, como eram lidos antes. */
function PassosAntigos({ doc }: { doc: Playbook }) {
  if (doc.steps.length === 0 && !doc.rules?.length)
    return <p className="rounded-2xl border border-dashed border-zinc-200 py-12 text-center text-sm text-zinc-400">Este documento ainda não tem texto. Clique em Editar para escrever.</p>;

  return (
    <div className="space-y-6">
      <ol className="space-y-3">
        {doc.steps.map((step, index) => (
          <li key={`${step.title}-${index}`} className="rounded-2xl border border-zinc-100 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-semibold text-violet-700">{index + 1}</span>
                <h3 className="text-sm font-semibold text-zinc-900">{step.title.replace(/^\d+\.\s*/, "")}</h3>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {step.owner && (
                  <span className="flex items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-medium text-zinc-600">
                    <UserRound size={11} /> {step.owner}
                  </span>
                )}
                {step.sla && (
                  <span className="flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700 ring-1 ring-inset ring-amber-100">
                    <Clock3 size={11} /> {step.sla}
                  </span>
                )}
              </div>
            </div>
            {step.detail && <p className="mt-3 pl-10 text-sm leading-relaxed text-zinc-600">{step.detail}</p>}
            {step.checklist && (
              <ul className="mt-3 space-y-1.5 pl-10">
                {step.checklist.map((entry) => (
                  <li key={entry} className="flex items-start gap-2 text-sm text-zinc-500">
                    <Check size={13} className="mt-0.5 shrink-0 text-emerald-500" /> {entry}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>

      {doc.rules && doc.rules.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">Regras da operação</h2>
          <ul className="mt-3 space-y-2.5">
            {doc.rules.map((rule) => (
              <li key={rule} className="flex items-start gap-2.5 text-sm leading-relaxed text-zinc-600">
                <CircleAlert size={14} className="mt-0.5 shrink-0 text-violet-500" /> {rule}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
