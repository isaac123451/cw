"use client";

import { useEffect, useRef, useState } from "react";

import { MoreHorizontal, type LucideIcon } from "lucide-react";

export interface ItemDoMenu {
  rotulo: string;
  icone: LucideIcon;
  onClick: () => void;
  /** Explica o que faz, no title. */
  dica?: string;
  desativado?: boolean;
}

/**
 * O que a tela faz de vez em quando (configurar, exportar, importar) sem
 * disputar o topo com o que se faz todo dia. Sete botões do mesmo peso
 * lado a lado não dizem qual importa; aqui fica um botão, e o resto num
 * menu que fecha no clique fora e no Esc.
 */
export default function MenuMais({ itens, rotulo = "Mais" }: { itens: ItemDoMenu[]; rotulo?: string }) {

  const [aberto, setAberto] = useState(false);
  /* Abre para a esquerda; se o botão estiver perto da borda esquerda, abre para a direita. */
  const [paraDireita, setParaDireita] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    function fora(e: MouseEvent) {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAberto(false);
    }
    function tecla(e: KeyboardEvent) {
      if (e.key === "Escape") setAberto(false);
    }
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", tecla);
    };
  }, [aberto]);

  return (
    <div ref={raiz} className="relative">

      <button
        type="button"
        onClick={(e) => {
          setParaDireita(e.currentTarget.getBoundingClientRect().right < 236);
          setAberto((a) => !a);
        }}
        aria-haspopup="menu"
        aria-expanded={aberto}
        className={`flex items-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
          aberto ? "border-zinc-300 bg-zinc-50 text-zinc-900" : "border-zinc-200 text-zinc-700 hover:border-zinc-300"
        }`}
      >
        <MoreHorizontal size={16} />
        {rotulo}
      </button>

      {aberto && (
        <div
          role="menu"
          className={`absolute ${paraDireita ? "left-0" : "right-0"} top-[calc(100%+6px)] z-40 min-w-[220px] overflow-hidden rounded-xl border border-zinc-200 bg-white p-1 shadow-[0_12px_32px_-12px_rgba(16,24,40,0.25)]`}
        >
          {itens.map((item) => (
            <button
              key={item.rotulo}
              type="button"
              role="menuitem"
              title={item.dica}
              disabled={item.desativado}
              onClick={() => {
                setAberto(false);
                item.onClick();
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-zinc-700 transition-colors hover:bg-zinc-50 hover:text-zinc-900 disabled:pointer-events-none disabled:opacity-50"
            >
              <item.icone size={15} className="shrink-0 text-zinc-400" />
              {item.rotulo}
            </button>
          ))}
        </div>
      )}

    </div>
  );
}
