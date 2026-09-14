"use client";

import { Fragment, type ReactNode } from "react";

import { Info, Link2, MessageSquareText } from "lucide-react";

import { CopiarOuEditar } from "@/components/shared/TextoEditavel";

import {
  blocosDoMarkdown,
  marcarTermo,
  textoPuro,
  trechosDaLinha,
  type Bloco,
  type Trecho,
} from "@/lib/models/markdown";

/**
 * O documento desenhado.
 *
 * Cada bloco vira elemento do React — nada de `dangerouslySetInnerHTML`
 * —, então o que alguém digitar no editor aparece como texto. A citação
 * que traz `[marcador]` ou começa com `@` é um modelo de mensagem do
 * documento ("@setor-responsável / [Saudação]! O cliente…") e ganha o
 * Copiar e o Editar antes de copiar, como os textos gerados da ficha.
 */
export default function Markdown({
  conteudo,
  destaque = "",
  aoCopiarLink,
}: {
  conteudo: string;
  /** O termo da busca, marcado no texto. */
  destaque?: string;
  /** Copia o endereço da seção; sem ele, o título não mostra o ícone de link. */
  aoCopiarLink?: (ancora: string) => void;
}) {
  const blocos = blocosDoMarkdown(conteudo);
  return <div className="text-[15px] leading-7 text-zinc-700">{blocos.map((b, i) => <BlocoDoDocumento key={i} bloco={b} destaque={destaque} aoCopiarLink={aoCopiarLink} />)}</div>;
}

function BlocoDoDocumento({ bloco, destaque, aoCopiarLink }: { bloco: Bloco; destaque: string; aoCopiarLink?: (ancora: string) => void }) {
  const linha = (texto: string) => <Linha texto={texto} destaque={destaque} />;

  switch (bloco.tipo) {
    case "titulo": {
      const link = bloco.ancora && aoCopiarLink && (
        <button
          type="button"
          onClick={() => aoCopiarLink(bloco.ancora!)}
          title="Copiar o link desta seção"
          aria-label={`Copiar o link da seção ${textoPuro(bloco.texto)}`}
          className="ml-2 inline-flex translate-y-[-1px] items-center rounded-md p-1 align-middle text-zinc-300 opacity-0 transition-opacity hover:bg-violet-50 hover:text-violet-700 focus:opacity-100 group-hover:opacity-100"
        >
          <Link2 size={14} />
        </button>
      );
      if (bloco.nivel === 2)
        return (
          <h2 id={bloco.ancora} className="group mt-10 scroll-mt-6 border-b border-zinc-100 pb-2 text-lg font-semibold leading-snug text-zinc-900 first:mt-0">
            {linha(bloco.texto)}
            {link}
          </h2>
        );
      if (bloco.nivel === 3)
        return (
          <h3 id={bloco.ancora} className="group mt-7 scroll-mt-6 text-base font-semibold leading-snug text-zinc-900">
            {linha(bloco.texto)}
            {link}
          </h3>
        );
      return <h4 className="mt-5 text-sm font-semibold text-zinc-900">{linha(bloco.texto)}</h4>;
    }

    case "paragrafo":
      return <p className="mt-3">{linha(bloco.linhas.join(" "))}</p>;

    case "lista":
      return bloco.ordenada ? (
        <ol start={bloco.inicio} className="mt-3 list-decimal space-y-1.5 pl-6 marker:font-semibold marker:text-violet-600">
          {bloco.itens.map((item, i) => (
            <li key={i} className="pl-1">
              {linha(item)}
            </li>
          ))}
        </ol>
      ) : (
        <ul className="mt-3 list-disc space-y-1.5 pl-6 marker:text-violet-400">
          {bloco.itens.map((item, i) => (
            <li key={i} className="pl-1">
              {linha(item)}
            </li>
          ))}
        </ul>
      );

    case "citacao": {
      const modelo = bloco.linhas.some((l) => /\[[^\]]+\]/.test(l) || /^@/.test(l.trim()));
      if (!modelo)
        return (
          <aside className="mt-4 flex gap-3 rounded-2xl bg-sky-50/70 px-4 py-3 text-sm leading-6 text-sky-900 ring-1 ring-inset ring-sky-100">
            <Info size={16} className="mt-1 shrink-0 text-sky-500" />
            <div>
              {bloco.linhas.map((l, i) => (
                <p key={i}>{linha(l)}</p>
              ))}
            </div>
          </aside>
        );
      return (
        <figure className="mt-4 overflow-hidden rounded-2xl bg-white ring-1 ring-inset ring-violet-100">
          <figcaption className="flex flex-wrap items-center justify-between gap-2 border-b border-violet-100 bg-violet-50/50 px-4 py-2">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-violet-700">
              <MessageSquareText size={13} /> Modelo de mensagem
            </span>
            <CopiarOuEditar texto={bloco.linhas.map(textoPuro).join("\n")} rotulo="Copiar modelo" />
          </figcaption>
          <div className="space-y-1 px-4 py-3 text-sm leading-6 text-zinc-700">
            {bloco.linhas.map((l, i) => (
              <p key={i} className={l.trim() ? "" : "h-3"}>
                {linha(l)}
              </p>
            ))}
          </div>
        </figure>
      );
    }

    case "tabela":
      return (
        <div className="mt-4 overflow-x-auto rounded-2xl ring-1 ring-inset ring-zinc-200">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead className="bg-zinc-50">
              <tr>
                {bloco.cabecalho.map((c, i) => (
                  <th key={i} scope="col" className="whitespace-nowrap border-b border-zinc-200 px-3.5 py-2.5 text-xs font-semibold text-zinc-600">
                    {linha(c)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bloco.linhas.map((l, i) => (
                <tr key={i} className="align-top odd:bg-white even:bg-zinc-50/40">
                  {l.map((c, k) => (
                    <td key={k} className={`border-b border-zinc-100 px-3.5 py-2.5 leading-6 ${k === 0 ? "font-medium text-zinc-900" : "text-zinc-600"}`}>
                      {linha(c)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case "separador":
      return <hr className="my-8 border-zinc-100" />;
  }
}

/** Uma linha com negrito, itálico, código e link — e o termo da busca marcado. */
function Linha({ texto, destaque }: { texto: string; destaque: string }) {
  return <>{trechosDaLinha(texto).map((t, i) => <TrechoDaLinha key={i} trecho={t} destaque={destaque} />)}</>;
}

function TrechoDaLinha({ trecho, destaque }: { trecho: Trecho; destaque: string }): ReactNode {
  const filhos = (lista: Trecho[]) => lista.map((t, i) => <TrechoDaLinha key={i} trecho={t} destaque={destaque} />);
  switch (trecho.tipo) {
    case "texto":
      return <Marcado texto={trecho.texto} termo={destaque} />;
    case "negrito":
      return <strong className="font-semibold text-zinc-900">{filhos(trecho.filhos)}</strong>;
    case "italico":
      return <em>{filhos(trecho.filhos)}</em>;
    case "codigo":
      return <code className="rounded-md bg-zinc-100 px-1.5 py-0.5 font-mono text-[0.85em] text-zinc-800">{trecho.texto}</code>;
    case "link":
      return (
        <a href={trecho.href} target="_blank" rel="noopener noreferrer" className="font-medium text-violet-700 underline decoration-violet-300 underline-offset-2 hover:decoration-violet-600">
          {filhos(trecho.filhos)}
        </a>
      );
  }
}

function Marcado({ texto, termo }: { texto: string; termo: string }) {
  if (termo.trim().length < 2) return <>{texto}</>;
  return (
    <>
      {marcarTermo(texto, termo).map((p, i) =>
        p.achou ? (
          <mark key={i} className="rounded bg-amber-200/70 px-0.5 text-zinc-900">
            {p.texto}
          </mark>
        ) : (
          <Fragment key={i}>{p.texto}</Fragment>
        )
      )}
    </>
  );
}
