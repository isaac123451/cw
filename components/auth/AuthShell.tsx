import Link from "next/link";

import { ReactNode } from "react";

import BrandMark from "@/components/shared/BrandMark";

interface Props {
  title: string;
  description: string;
  children: ReactNode;
  footer: ReactNode;
}

export default function AuthShell({
  title,
  description,
  children,
  footer,
}: Props) {
  return (
    <main className="flex min-h-screen bg-[#F6F7FB]">

      {/* Lado da marca */}

      <section className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-gradient-to-br from-[#5B2A86] via-[#6D34A0] to-[#7B3FBF] p-12 lg:flex">

        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/10"
        />

        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-[#F9A11B]/20"
        />

        <Link
          href="/"
          className="relative flex items-center gap-3"
        >
          <span className="rounded-2xl bg-white/10 p-2 backdrop-blur">
            <BrandMark size={30} />
          </span>

          <span className="text-lg font-semibold tracking-tight text-white">
            CW Reputação
          </span>
        </Link>

        <div className="relative">

          <h2 className="max-w-md text-3xl font-semibold leading-tight tracking-tight text-white">
            A central da Experiência do Cliente da Cardápio
            Web.
          </h2>

          <p className="mt-4 max-w-md text-sm leading-relaxed text-white/70">
            Atendimentos, processos, indicadores e impacto no
            negócio em um só lugar — do Reclame Aqui às redes
            sociais.
          </p>

        </div>

        <p className="relative text-xs text-white/50">
          Acesso restrito a colaboradores Cardápio Web.
        </p>

      </section>

      {/* Formulário */}

      <section className="flex w-full items-center justify-center p-6 lg:w-1/2 lg:p-12">

        <div className="w-full max-w-sm">

          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <BrandMark size={34} />
            <span className="text-base font-semibold tracking-tight text-zinc-900">
              CW Reputação
            </span>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            {title}
          </h1>

          <p className="mt-1.5 text-sm text-zinc-500">
            {description}
          </p>

          <div className="mt-7">{children}</div>

          <div className="mt-6 text-sm text-zinc-500">
            {footer}
          </div>

        </div>

      </section>

    </main>
  );
}
