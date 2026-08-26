import { ReactNode } from "react";

import { Info } from "lucide-react";

import { cn } from "@/lib/utils";

interface Props {
  title?: string;
  description?: string;
  /**
   * Explicação mais longa, mostrada ao passar o mouse no ícone ao lado
   * do título — para dizer como o número é apurado sem poluir a tela.
   */
  hint?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

/**
 * Container padrão das telas: cabeçalho opcional + corpo.
 * Mantém raio, borda e sombra consistentes em toda a plataforma.
 */
export default function SurfaceCard({
  title,
  description,
  hint,
  action,
  children,
  className,
  bodyClassName,
}: Props) {
  return (
    <section
      className={cn(
        "min-w-0 rounded-2xl border border-zinc-200/80 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-12px_rgba(16,24,40,0.10)]",
        className
      )}
    >

      {(title || action) && (

        <header className="flex items-start justify-between gap-4 border-b border-zinc-100 px-6 py-5">

          <div className="min-w-0">

            {title && (

              <h2 className="flex items-center gap-1.5 text-base font-semibold tracking-tight text-zinc-900">

                {title}

                {hint && (
                  <span
                    title={hint}
                    className="cursor-help text-zinc-300 transition-colors hover:text-violet-600"
                  >
                    <Info size={14} />
                  </span>
                )}

              </h2>

            )}

            {description && (
              <p className="mt-1 text-sm text-zinc-500">
                {description}
              </p>
            )}

          </div>

          {action}

        </header>

      )}

      {/*
        O corpo não pode empurrar o cartão para fora da tela.

        Item de grid nasce com `min-width: auto`, então um gráfico ou
        uma tabela larga estica a coluna inteira — num celular de 375 px
        o cartão da evolução mensal ficava com 570, e o dos casos
        críticos com 896. O documento não rolava (o `overflow` do main
        segurava), mas metade de cada cartão ficava do lado de fora.

        `min-w-0` deixa o cartão encolher; `overflow-x-auto` dá ao
        conteúdo largo a barra dele, em vez de espalhá-lo pela página.
      */}
      <div
        className={cn(
          "min-w-0 overflow-x-auto p-5 sm:p-6",
          bodyClassName
        )}
      >
        {children}
      </div>

    </section>
  );
}
