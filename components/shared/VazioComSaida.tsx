"use client";

import Link from "next/link";

import type { ReactNode } from "react";

/**
 * Lista vazia que explica o porquê e oferece o próximo passo (roadmap
 * 1.0, "Nenhuma tela sem saída").
 *
 * Um "Nenhum resultado." sozinho deixa a dúvida que mais afasta quem
 * usa: *não tem nada, ou não carregou, ou eu filtrei errado?* Aqui a
 * tela diz qual das três é, e o botão faz a coisa certa — limpar o
 * filtro, cadastrar o primeiro, ir para onde o dado nasce.
 */
export interface SaidaDoVazio {
  rotulo: string;
  href?: string;
  onClick?: () => void;
}

export default function VazioComSaida({
  titulo,
  porque,
  saidas = [],
  icone,
  compacto = false,
}: {
  titulo?: string;
  porque?: ReactNode;
  saidas?: SaidaDoVazio[];
  icone?: ReactNode;
  compacto?: boolean;
}) {
  const botao = (primeiro: boolean) =>
    primeiro
      ? "rounded-xl bg-violet-700 px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-violet-800"
      : "rounded-xl px-3.5 py-2 text-xs font-medium text-violet-700 ring-1 ring-inset ring-violet-200 transition-colors hover:bg-violet-50";

  return (
    <div className={`flex flex-col items-center text-center ${compacto ? "px-4 py-6" : "px-6 py-12"}`}>
      {icone && <div className="mb-3 text-zinc-300">{icone}</div>}
      {titulo && <p className="text-sm font-medium text-zinc-700">{titulo}</p>}
      {porque && <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-zinc-500">{porque}</p>}
      {saidas.length > 0 && (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {saidas.map((s, i) =>
            s.href ? (
              <Link key={s.rotulo} href={s.href} className={botao(i === 0)}>
                {s.rotulo}
              </Link>
            ) : (
              <button key={s.rotulo} type="button" onClick={s.onClick} className={botao(i === 0)}>
                {s.rotulo}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}
