"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";

import { ArrowUpRight, BookOpen, X } from "lucide-react";

import Markdown from "@/components/documentacao/Markdown";

import { useDocs } from "@/lib/context/DocsContext";
import { linkDoPorQue, PORQUES, type ChaveDoPorQue } from "@/lib/documentos/porques";
import { secoesDoDocumento } from "@/lib/models/playbook";

/** Até onde o balão mostra o trecho: o resto é "continuar no documento". */
const LIMITE = 1100;
const LARGURA = 416;
const ALTURA_ESTIMADA = 420;

/** Os primeiros blocos do trecho que cabem no limite — sem cortar tabela ou lista no meio. */
function trechoCurto(texto: string) {
  const blocos = texto.split(/\n{2,}/);
  let saida = "";
  for (const b of blocos) {
    if (saida && saida.length + b.length > LIMITE) return { texto: saida, cortado: true };
    saida = saida ? `${saida}\n\n${b}` : b;
  }
  return { texto: saida, cortado: false };
}

type Posicao = { left: number; top?: number; bottom?: number };

/** Abaixo do botão; sem espaço embaixo, acima. Nunca fora da tela. */
function posicionar(botao: HTMLElement): Posicao {
  const r = botao.getBoundingClientRect();
  const left = Math.max(16, Math.min(r.left, window.innerWidth - LARGURA - 16));
  return r.bottom + ALTURA_ESTIMADA > window.innerHeight && r.top > ALTURA_ESTIMADA
    ? { left, bottom: window.innerHeight - r.top + 6 }
    : { left, top: r.bottom + 6 };
}

/**
 * O "por quê?" ao lado da regra.
 *
 * Abre um balão com o trecho do documento que sustenta aquela regra —
 * o passo "Recebimento e triagem" mostra a tabela de criticidade do
 * Reclame Aqui — e o link para ler no documento inteiro. O texto vem da
 * Documentação (o que foi importado e editado lá), não de uma cópia: se
 * o time mudar o documento, o balão muda junto. Sem os documentos
 * importados, o balão diz onde importar.
 *
 * O balão vai para o fim da página (portal), com posição fixa: dentro
 * de um cartão com `overflow-hidden` ele seria cortado, e dentro de um
 * `<p>` o texto do documento (parágrafos, tabelas) seria HTML inválido.
 */
export default function PorQue({
  chave,
  rotulo = "por quê?",
  compacto = false,
  className = "",
}: {
  chave: ChaveDoPorQue;
  rotulo?: string;
  /** Só o ícone — para os cartões pequenos dos passos. */
  compacto?: boolean;
  className?: string;
}) {
  const { playbooks } = useDocs();
  const [posicao, setPosicao] = useState<Posicao | null>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const balao = useRef<HTMLDivElement>(null);
  const aberto = posicao !== null;

  const regra = PORQUES[chave];
  const doc = playbooks.find((p) => p.slug === regra.doc);
  const secao = doc?.conteudo ? secoesDoDocumento(doc.conteudo).find((s) => s.ancora === regra.ancora) : undefined;
  const trecho = secao ? trechoCurto(secao.texto) : null;

  /* Fecha no Esc e no clique fora; acompanha a rolagem. */
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      const alvo = e.target as Node;
      if (!botao.current?.contains(alvo) && !balao.current?.contains(alvo)) setPosicao(null);
    };
    /* Na captura, e sem seguir adiante: o Esc fecha o balão, não o diálogo em que ele está. */
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setPosicao(null);
      botao.current?.focus();
    };
    const mover = (e: Event) => {
      if (balao.current?.contains(e.target as Node)) return;
      if (botao.current) setPosicao(posicionar(botao.current));
    };
    document.addEventListener("mousedown", fora);
    window.addEventListener("keydown", esc, true);
    window.addEventListener("scroll", mover, true);
    window.addEventListener("resize", mover);
    return () => {
      document.removeEventListener("mousedown", fora);
      window.removeEventListener("keydown", esc, true);
      window.removeEventListener("scroll", mover, true);
      window.removeEventListener("resize", mover);
    };
  }, [aberto]);

  return (
    <>
      <button
        ref={botao}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setPosicao(aberto || !botao.current ? null : posicionar(botao.current));
        }}
        aria-expanded={aberto}
        aria-haspopup="dialog"
        aria-label={`Por quê? ${regra.rotulo}`}
        title={`Por quê? ${regra.rotulo}`}
        className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 align-middle text-[11px] font-medium normal-case tracking-normal transition-colors ${
          aberto ? "bg-violet-100 text-violet-800" : "text-violet-600 hover:bg-violet-50 hover:text-violet-800"
        } ${className}`}
      >
        <BookOpen size={compacto ? 12 : 11} aria-hidden />
        {!compacto && rotulo}
      </button>

      {posicao &&
        createPortal(
          <div
            ref={balao}
            role="dialog"
            aria-label={regra.rotulo}
            style={{ position: "fixed", left: posicao.left, top: posicao.top, bottom: posicao.bottom, width: LARGURA }}
            className="z-[70] max-w-[calc(100vw-2rem)] rounded-2xl bg-white text-left shadow-2xl ring-1 ring-zinc-900/10"
          >
            <div className="flex items-start justify-between gap-3 border-b border-zinc-100 px-4 py-3">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-700">{doc?.title ?? "Documento do time"}</p>
                <p className="mt-0.5 text-sm font-semibold leading-snug text-zinc-900">{regra.rotulo}</p>
              </div>
              <button type="button" onClick={() => setPosicao(null)} aria-label="Fechar" className="shrink-0 rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700">
                <X size={14} />
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto px-4 py-3 text-sm">
              {!doc ? (
                <p className="leading-6 text-zinc-600">
                  Os documentos do time ainda não estão na plataforma. Importe em{" "}
                  <Link href="/documentacao" className="font-medium text-violet-700 underline underline-offset-2">
                    Documentação
                  </Link>{" "}
                  para ler aqui o trecho que sustenta esta regra.
                </p>
              ) : !trecho ? (
                <p className="leading-6 text-zinc-600">Este trecho mudou de nome no documento. Abra o documento para ler a regra.</p>
              ) : (
                <div className="[&>div]:text-[13.5px] [&>div]:leading-6">
                  <Markdown conteudo={trecho.texto} />
                  {trecho.cortado && <p className="mt-2 text-xs text-zinc-400">O trecho continua no documento.</p>}
                </div>
              )}
            </div>

            <div className="flex justify-end border-t border-zinc-100 px-4 py-2.5">
              <Link
                href={doc && trecho ? linkDoPorQue(regra) : `/documentacao${doc ? `?doc=${regra.doc}` : ""}`}
                onClick={() => setPosicao(null)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-violet-700 hover:text-violet-900"
              >
                Ler no documento <ArrowUpRight size={13} />
              </Link>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
