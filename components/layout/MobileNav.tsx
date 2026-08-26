"use client";

import { useEffect, useState } from "react";

import { usePathname } from "next/navigation";

import { Menu, X } from "lucide-react";

import Sidebar from "./Sidebar";

/**
 * A navegação em tela pequena.
 *
 * A barra lateral tem 256 px fixos e `h-screen`. Num celular de 375 px
 * isso é **dois terços da tela** — o conteúdo sobrava em 119 px, e a
 * barra de cima transbordava para fora da janela. Era o que o Isaac
 * reportou como "não está nada responsivo": não é que os cartões
 * quebrem, é que não há espaço para eles.
 *
 * A saída é a de sempre em aplicação de painel: a lateral vira gaveta.
 * A partir de `lg` ela volta a ser fixa, porque num monitor a navegação
 * sempre visível vale o espaço que ocupa.
 *
 * **Fecha ao trocar de rota.** Sem isso, tocar num item deixa a gaveta
 * aberta por cima da tela que acabou de abrir — e o gesto seguinte de
 * quem usa é sempre fechar, o que quer dizer que a tela pediu um toque
 * a mais em toda navegação.
 */
export default function MobileNav() {

  const [aberta, setAberta] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setAberta(false);
  }, [pathname]);

  /**
   * Gaveta aberta trava a rolagem do que está atrás.
   *
   * Sem isto, rolar dentro da gaveta rola a página por baixo, e ao
   * fechar a pessoa está num lugar que não escolheu.
   */
  useEffect(() => {

    if (!aberta) return;

    const antes = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = antes;
    };
  }, [aberta]);

  /** Esc fecha, como todo painel sobreposto. */
  useEffect(() => {

    if (!aberta) return;

    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAberta(false);
    };

    window.addEventListener("keydown", aoTeclar);

    return () =>
      window.removeEventListener("keydown", aoTeclar);
  }, [aberta]);

  return (
    <>
      <button
        type="button"
        onClick={() => setAberta(true)}
        aria-label="Abrir a navegação"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-zinc-600 transition-colors hover:bg-zinc-100 lg:hidden"
      >
        <Menu size={19} />
      </button>

      {aberta && (

        <div className="fixed inset-0 z-50 lg:hidden">

          <div
            className="absolute inset-0 bg-zinc-900/40 backdrop-blur-[2px]"
            onClick={() => setAberta(false)}
          />

          <div className="absolute inset-y-0 left-0 flex">

            <Sidebar />

            <button
              type="button"
              onClick={() => setAberta(false)}
              aria-label="Fechar a navegação"
              className="mt-3 ml-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-zinc-600 shadow-lg transition-colors hover:bg-zinc-100"
            >
              <X size={18} />
            </button>

          </div>

        </div>

      )}
    </>
  );
}
