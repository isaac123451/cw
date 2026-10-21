"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { GripHorizontal, X } from "lucide-react";

import { marcarAvaliacao } from "@/lib/actions/tratativa";
import { ajustarCasoNaTela } from "@/lib/context/ajusteDoCaso";
import type { Case } from "@/lib/models/case";
import { classeDaAvaliacao, ROTULO_DA_ORIGEM } from "@/lib/models/classeDaAvaliacao";
import { caseHref } from "@/lib/services/case.service";

/**
 * A mini janela do gráfico (21/10/2026).
 *
 * "Quando eu clicar em uma coluna de um gráfico, dependendo se tiver alguma
 * informação para apresentar, é preciso abrir uma mini janela com os casos
 * ou informações." Uma janela só, montada no layout; qualquer gráfico abre
 * com `abrirJanelaDeCasos` — sem precisar de estado próprio nem de modal.
 *
 * Painel flutuante pela regra da casa: arrastável pelo topo, sem fundo
 * escurecido nem desfoque, fecha no X ou com Esc.
 */

export interface LinhaDaJanela {
  titulo: string;
  detalhe?: string;
  href?: string;
}

export interface ConteudoDaJanela {
  titulo: string;
  /** Uma linha curta embaixo do título: o que a coluna conta. */
  descricao?: string;
  casos?: Case[];
  /** Informação que não é caso (ex.: avaliações do Google, respostas do NPS). */
  linhas?: LinhaDaJanela[];
}

const EVENTO = "cw:janela-de-casos";

/** Abre a mini janela. Sem casos nem linhas, não abre — a coluna vazia não tem o que mostrar. */
export function abrirJanelaDeCasos(conteudo: ConteudoDaJanela) {
  if (!conteudo.casos?.length && !conteudo.linhas?.length) return;
  window.dispatchEvent(new CustomEvent<ConteudoDaJanela>(EVENTO, { detail: conteudo }));
}

const LIMITE = 200;
const dia = (iso?: string) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(2, 4)}` : "");

export default function JanelaDeCasos() {
  const [conteudo, setConteudo] = useState<ConteudoDaJanela | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const arraste = useRef<{ dx: number; dy: number } | null>(null);
  /* O que foi marcado aqui, enquanto a janela está aberta — por protocolo. */
  const [ajustes, setAjustes] = useState<Record<string, Partial<Case>>>({});
  const [gravando, setGravando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const abrir = (e: Event) => {
      setConteudo((e as CustomEvent<ConteudoDaJanela>).detail);
      setAjustes({});
      setErro(null);
      /* Abre no meio da tela: o canto direito é dos lembretes da Agenda, que cobririam a janela (21/10/2026). */
      setPos((p) => p ?? { x: Math.max(16, Math.round((window.innerWidth - 420) / 2)), y: 88 });
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setConteudo(null);
    window.addEventListener(EVENTO, abrir);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener(EVENTO, abrir);
      window.removeEventListener("keydown", esc);
    };
  }, []);

  if (!conteudo || !pos) return null;

  const casos = (conteudo.casos ?? []).map((c) => (ajustes[c.protocol] ? { ...c, ...ajustes[c.protocol] } : c));

  /*
    Marcar a avaliação (21/10/2026): "ter uma opção de marcar avaliação
    positiva … e negativa". Clicar na marca que já é sua tira a marca —
    volta a valer a da IA ou a regra pela nota.
  */
  async function marcar(c: Case, marca: "positiva" | "negativa") {
    const tirar = c.avaliacaoMarca === marca && c.avaliacaoMarcaPor !== "IA";
    setGravando(c.protocol);
    setErro(null);
    const r = await marcarAvaliacao({ protocol: c.protocol, marca: tirar ? null : marca });
    setGravando(null);
    if (!r.ok) {
      setErro(r.erro);
      return;
    }
    const campos: Partial<Case> = tirar
      ? { avaliacaoMarca: undefined, avaliacaoMarcaPor: undefined, avaliacaoMarcaEm: undefined, avaliacaoMarcaMotivo: undefined }
      : { avaliacaoMarca: marca, avaliacaoMarcaPor: r.por, avaliacaoMarcaEm: r.em, avaliacaoMarcaMotivo: undefined };
    setAjustes((a) => ({ ...a, [c.protocol]: { ...a[c.protocol], ...campos } }));
    ajustarCasoNaTela(c.protocol, campos);
  }

  const linhas = conteudo.linhas ?? [];
  const total = casos.length + linhas.length;

  const comecar = (e: React.PointerEvent) => {
    arraste.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const mover = (e: React.PointerEvent) => {
    if (!arraste.current) return;
    setPos({
      x: Math.min(window.innerWidth - 120, Math.max(0, e.clientX - arraste.current.dx)),
      y: Math.min(window.innerHeight - 60, Math.max(0, e.clientY - arraste.current.dy)),
    });
  };

  return (
    <div
      role="dialog"
      aria-label={conteudo.titulo}
      className="fixed z-[70] flex max-h-[70vh] w-[min(420px,calc(100vw-32px))] flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-[0_12px_32px_rgba(16,24,40,0.16)]"
      style={{ left: pos.x, top: pos.y }}
    >
      <div
        onPointerDown={comecar}
        onPointerMove={mover}
        onPointerUp={() => (arraste.current = null)}
        className="flex cursor-grab items-start gap-2 border-b border-zinc-100 px-3.5 py-2.5 active:cursor-grabbing"
      >
        <GripHorizontal size={14} className="mt-1 shrink-0 text-zinc-300" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-zinc-900">
            {conteudo.titulo} <span className="font-normal text-zinc-500">· {total}</span>
          </p>
          {conteudo.descricao && <p className="mt-0.5 text-xs text-zinc-500">{conteudo.descricao}</p>}
        </div>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setConteudo(null)}
          className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
          aria-label="Fechar"
        >
          <X size={15} />
        </button>
      </div>

      {erro && <p className="border-b border-rose-100 bg-rose-50 px-3.5 py-1.5 text-xs text-rose-800">{erro}</p>}
      <ul className="divide-y divide-zinc-100 overflow-y-auto">
        {casos.slice(0, LIMITE).map((c) => {
          const classe = classeDaAvaliacao(c);
          return (
          <li key={c.id}>
            <Link href={caseHref(c)} className="block px-3.5 pb-1 pt-2 hover:bg-zinc-50">
              <p className="flex items-baseline justify-between gap-2">
                <span className="truncate text-sm font-medium text-zinc-800">{c.customer || "Sem nome"}</span>
                <span className="shrink-0 text-[11px] tabular-nums text-zinc-400">{dia(c.createdAt)}</span>
              </p>
              <p className="truncate text-xs text-zinc-500">{c.title}</p>
              <p className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] text-zinc-400">
                <span className="font-mono text-violet-700">{c.protocol}</span>
                <span>{c.status}</span>
                {c.evaluated && (
                  <span className="text-zinc-600">
                    nota {c.score ?? "—"}
                    {c.resolved ? " · resolvida" : " · não resolvida"}
                    {c.evaluatedAt ? ` · avaliada ${dia(c.evaluatedAt)}` : ""}
                  </span>
                )}
              </p>
              {c.consideracaoFinal && <p className="mt-0.5 line-clamp-2 text-[11px] italic text-zinc-500">“{c.consideracaoFinal}”</p>}
            </Link>
            {classe && (
              <div className="flex flex-wrap items-center gap-1.5 px-3.5 pb-2 text-[11px]">
                {(["positiva", "negativa"] as const).map((m) => {
                  const ativa = classe.classe === m;
                  const cor = m === "positiva" ? "bg-emerald-50 text-emerald-800 ring-emerald-200" : "bg-rose-50 text-rose-800 ring-rose-200";
                  return (
                    <button
                      key={m}
                      type="button"
                      disabled={gravando === c.protocol}
                      onClick={() => void marcar(c, m)}
                      aria-pressed={ativa}
                      className={`rounded-full px-2 py-0.5 font-medium ring-1 ring-inset transition-colors disabled:opacity-50 ${ativa ? cor : "text-zinc-500 ring-zinc-200 hover:bg-zinc-50 hover:text-zinc-800"}`}
                      title={ativa && classe.origem === "voce" ? "Clique para tirar a sua marca" : `Marcar como ${m}`}
                    >
                      {m === "positiva" ? "Positiva" : "Negativa"}
                    </button>
                  );
                })}
                <span className="text-zinc-400" title={c.avaliacaoMarcaMotivo || undefined}>
                  {classe.classe === "neutra" ? "neutra pela nota" : ROTULO_DA_ORIGEM[classe.origem]}
                  {classe.origem === "voce" && c.avaliacaoMarcaPor ? ` · ${c.avaliacaoMarcaPor}` : ""}
                  {classe.origem === "ia" && c.avaliacaoMarcaMotivo ? ` — ${c.avaliacaoMarcaMotivo}` : ""}
                </span>
              </div>
            )}
          </li>
          );
        })}
        {linhas.slice(0, LIMITE).map((l, i) => {
          const corpo = (
            <>
              <p className="truncate text-sm text-zinc-800">{l.titulo}</p>
              {l.detalhe && <p className="truncate text-xs text-zinc-500">{l.detalhe}</p>}
            </>
          );
          return (
            <li key={`l${i}`}>
              {l.href ? (
                <Link href={l.href} className="block px-3.5 py-2 hover:bg-zinc-50">
                  {corpo}
                </Link>
              ) : (
                <div className="px-3.5 py-2">{corpo}</div>
              )}
            </li>
          );
        })}
      </ul>
      {total > LIMITE && <p className="border-t border-zinc-100 px-3.5 py-2 text-xs text-zinc-500">Mostrando {LIMITE} de {total}.</p>}
    </div>
  );
}
