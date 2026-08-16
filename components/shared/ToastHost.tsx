"use client";

import Link from "next/link";

import {
  CheckCircle2,
  Info,
  TriangleAlert,
  X,
} from "lucide-react";

import {
  ToastTone,
  useToast,
} from "@/lib/context/ToastContext";

const estilo: Record<
  ToastTone,
  { faixa: string; icone: string }
> = {
  success: {
    faixa: "bg-emerald-500",
    icone: "text-emerald-600",
  },
  error: {
    faixa: "bg-rose-500",
    icone: "text-rose-600",
  },
  info: {
    faixa: "bg-sky-500",
    icone: "text-sky-600",
  },
};

const Icone = {
  success: CheckCircle2,
  error: TriangleAlert,
  info: Info,
};

/**
 * Pilha de avisos no canto inferior direito.
 *
 * `aria-live="polite"` para leitor de tela anunciar sem interromper o
 * que a pessoa está fazendo.
 */
export default function ToastHost() {

  const { toasts, dismiss } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-5 right-5 z-[100] flex w-[360px] max-w-[calc(100vw-2.5rem)] flex-col gap-2.5"
    >

      {toasts.map((toast) => {

        const Glyph = Icone[toast.tone];

        return (
          <div
            key={toast.id}
            role="status"
            className="pointer-events-auto flex overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_12px_32px_-12px_rgba(16,24,40,0.28)]"
          >

            <span
              className={`w-1 shrink-0 ${estilo[toast.tone].faixa}`}
            />

            <div className="flex flex-1 items-start gap-3 px-4 py-3.5">

              <Glyph
                size={17}
                className={`mt-0.5 shrink-0 ${estilo[toast.tone].icone}`}
              />

              <div className="min-w-0 flex-1">

                <p className="text-sm font-medium leading-snug text-zinc-900">
                  {toast.title}
                </p>

                {toast.detail && (
                  <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">
                    {toast.detail}
                  </p>
                )}

                {toast.href && (
                  <Link
                    href={toast.href}
                    target={
                      toast.href.startsWith("http")
                        ? "_blank"
                        : undefined
                    }
                    rel="noopener noreferrer"
                    onClick={() => dismiss(toast.id)}
                    className="mt-1.5 inline-block text-xs font-medium text-violet-700 hover:underline"
                  >
                    {toast.hrefLabel ?? "Abrir"}
                  </Link>
                )}

              </div>

              <button
                onClick={() => dismiss(toast.id)}
                aria-label="Fechar aviso"
                className="shrink-0 rounded-lg p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
              >
                <X size={14} />
              </button>

            </div>

          </div>
        );
      })}

    </div>
  );
}
