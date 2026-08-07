"use client";

import { useEffect, ReactNode } from "react";

import { X } from "lucide-react";

interface Props {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** Largura do painel. `wide` para formulários com duas colunas. */
  size?: "default" | "wide";
}

export default function Modal({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  size = "default",
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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">

      <div
        onClick={onClose}
        className="absolute inset-0 bg-zinc-900/40 backdrop-blur-[2px]"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl ${
          size === "wide"
            ? "sm:max-w-3xl"
            : "sm:max-w-lg"
        }`}
      >

        <header className="flex items-start justify-between gap-4 border-b border-zinc-100 px-6 py-5">

          <div className="min-w-0">

            <h2 className="text-lg font-semibold tracking-tight text-zinc-900">
              {title}
            </h2>

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
