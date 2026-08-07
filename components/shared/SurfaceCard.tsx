import { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface Props {
  title?: string;
  description?: string;
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
  action,
  children,
  className,
  bodyClassName,
}: Props) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-zinc-200/80 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-12px_rgba(16,24,40,0.10)]",
        className
      )}
    >

      {(title || action) && (

        <header className="flex items-start justify-between gap-4 border-b border-zinc-100 px-6 py-5">

          <div className="min-w-0">

            {title && (
              <h2 className="text-base font-semibold tracking-tight text-zinc-900">
                {title}
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

      <div className={cn("p-6", bodyClassName)}>
        {children}
      </div>

    </section>
  );
}
