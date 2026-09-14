"use client";

import { useEffect, useRef, ReactNode } from "react";

import { GripHorizontal, X } from "lucide-react";

import PorQue from "@/components/shared/PorQue";

import type { ChaveDoPorQue } from "@/lib/documentos/porques";

interface Props {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** Largura do painel. `wide` para formulários com duas colunas; `xl` para lista e detalhe lado a lado. */
  size?: "default" | "wide" | "xl";
  /** O trecho do documento que explica este passo — o "por quê?" ao lado do título. */
  porque?: ChaveDoPorQue;
}

export default function Modal({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  size = "default",
  porque,
}: Props) {

  // Esc fecha e o fundo trava o scroll enquanto o painel está aberto.
  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", onKey);

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  /*
    O painel se arrasta pelo cabeçalho, e o fundo não desfoca.

    O Isaac, sobre as janelas flutuantes: "eu gosto da ideia, as vezes é
    até interessante se der para mover e sem blur". Com o desfoque, o
    que estava atrás — o caso, a lista — sumia justamente quando a
    pessoa precisava consultar para preencher. Arrastar tira o painel
    de cima do que se quer ler.

    A posição vai direto no estilo do elemento, sem estado: arrastar não
    redesenha o formulário a cada pixel, e fechar e abrir de novo volta
    ao centro (o elemento é criado de novo). No celular o painel é uma
    folha que sobe de baixo — ali não se arrasta.
  */
  const painel = useRef<HTMLDivElement>(null);
  const arrasto = useRef<{ x0: number; y0: number; x: number; y: number } | null>(null);
  const posicao = useRef({ x: 0, y: 0 });

  function comecar(evento: React.PointerEvent<HTMLElement>) {
    if (evento.button !== 0) return;
    if ((evento.target as HTMLElement).closest("button, a, input, select, textarea")) return;
    if (!window.matchMedia("(min-width: 640px)").matches) return;
    arrasto.current = { x0: evento.clientX, y0: evento.clientY, x: posicao.current.x, y: posicao.current.y };
    evento.currentTarget.setPointerCapture(evento.pointerId);
  }

  function mover(evento: React.PointerEvent<HTMLElement>) {
    const a = arrasto.current;
    const el = painel.current;
    if (!a || !el) return;
    /* Nunca some da tela: sobra sempre um pedaço do cabeçalho para pegar de volta. */
    const limiteX = window.innerWidth / 2 + el.offsetWidth / 2 - 120;
    const limiteY = window.innerHeight / 2 + el.offsetHeight / 2 - 60;
    const x = Math.max(-limiteX, Math.min(limiteX, a.x + evento.clientX - a.x0));
    const y = Math.max(-limiteY, Math.min(limiteY, a.y + evento.clientY - a.y0));
    posicao.current = { x, y };
    el.style.transform = `translate(${x}px, ${y}px)`;
  }

  function soltar(evento: React.PointerEvent<HTMLElement>) {
    if (!arrasto.current) return;
    arrasto.current = null;
    evento.currentTarget.releasePointerCapture(evento.pointerId);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">

      <div
        onClick={onClose}
        className="absolute inset-0 bg-zinc-900/25"
      />

      <div
        ref={painel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl ring-1 ring-zinc-900/5 sm:rounded-3xl ${
          size === "xl"
            ? "sm:max-w-5xl"
            : size === "wide"
              ? "sm:max-w-3xl"
              : "sm:max-w-lg"
        }`}
      >

        <header
          onPointerDown={comecar}
          onPointerMove={mover}
          onPointerUp={soltar}
          onPointerCancel={soltar}
          title="Arraste para mover"
          className="flex touch-none select-none items-start justify-between gap-4 border-b border-zinc-100 px-6 py-5 sm:cursor-move"
        >

          <div className="min-w-0">

            {/* O "por quê?" fica ao lado do título, fora dele: o nome do diálogo é só o título. */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-zinc-900">
                <GripHorizontal size={15} className="hidden shrink-0 text-zinc-300 sm:block" aria-hidden />
                {title}
              </h2>
              {porque && <PorQue chave={porque} />}
            </div>

            {description && (
              <p className="mt-1 text-sm text-zinc-500">
                {description}
              </p>
            )}

          </div>

          <button
            onClick={onClose}
            aria-label="Fechar"
            className="shrink-0 rounded-xl p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
          >
            <X size={18} />
          </button>

        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {children}
        </div>

        {footer && (
          <footer className="flex items-center justify-end gap-2 border-t border-zinc-100 bg-zinc-50/60 px-6 py-4">
            {footer}
          </footer>
        )}

      </div>

    </div>
  );
}

/* ============================================================
   CAMPOS
============================================================ */

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>

      <label className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
        {label}
      </label>

      <div className="mt-1.5">{children}</div>

      {hint && (
        <p className="mt-1 text-xs text-zinc-400">
          {hint}
        </p>
      )}

    </div>
  );
}

export const inputClass =
  "h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm outline-none transition-colors placeholder:text-zinc-400 focus:border-violet-400";

export const textareaClass =
  "w-full resize-y rounded-xl border border-zinc-200 p-3 text-sm leading-relaxed outline-none transition-colors placeholder:text-zinc-400 focus:border-violet-400";

export function PrimaryButton({
  children,
  onClick,
  disabled,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-800 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400"
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-200/60"
    >
      {children}
    </button>
  );
}

/** Confirmação de exclusão — evita apagar registro por engano. */
export function ConfirmDelete({
  open,
  label,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  label: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      open={open}
      title="Confirmar exclusão"
      description={`"${label}" será removido. Esta ação não pode ser desfeita.`}
      onClose={onCancel}
      footer={
        <>
          <GhostButton onClick={onCancel}>
            Cancelar
          </GhostButton>

          <button
            onClick={onConfirm}
            className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-rose-700"
          >
            Excluir
          </button>
        </>
      }
    >
      <p className="text-sm leading-relaxed text-zinc-600">
        Se este registro estiver vinculado a outros itens, os
        vínculos também serão perdidos.
      </p>
    </Modal>
  );
}
