"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Keyboard, X } from "lucide-react";

import {
  ATALHOS_DE_ACAO,
  ATALHOS_DE_TELA,
  digitandoEm,
  JANELA_DO_G_MS,
  telaDaSequencia,
} from "@/lib/models/atalhosDeTeclado";

/**
 * Escuta os atalhos de teclado e mostra a lista no "?".
 *
 * Mora no topo, junto da busca: está em toda tela com menu, e em
 * nenhuma tela de login.
 */
export default function AtalhosDeTeclado() {
  const router = useRouter();
  const [ajuda, setAjuda] = useState(false);
  const anterior = useRef<{ tecla: string; em: number } | null>(null);

  useEffect(() => {
    function teclas(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey || digitandoEm(e.target)) return;
      /* Com um diálogo aberto (busca, janela de confirmação), o teclado é dele. */
      if (document.querySelector('[role="dialog"][aria-modal="true"], [role="dialog"][aria-label="Buscar na plataforma"]')) return;

      const tecla = e.key;
      const ultimo = anterior.current;
      const primeira = ultimo && Date.now() - ultimo.em < JANELA_DO_G_MS ? ultimo.tecla : null;

      const tela = telaDaSequencia(primeira, tecla);
      if (tela) {
        e.preventDefault();
        anterior.current = null;
        router.push(tela.href);
        return;
      }

      if (tecla === "?") {
        e.preventDefault();
        setAjuda((v) => !v);
      } else if (tecla === "Escape") {
        setAjuda(false);
      } else if (tecla === "n" && primeira !== "g") {
        e.preventDefault();
        router.push("/reclame-aqui/novo");
      }

      anterior.current = { tecla, em: Date.now() };
    }

    window.addEventListener("keydown", teclas);
    return () => window.removeEventListener("keydown", teclas);
  }, [router]);

  if (!ajuda) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center bg-zinc-900/20 px-3 pt-[12vh]" onMouseDown={() => setAjuda(false)}>
      <div
        role="dialog"
        aria-label="Atalhos de teclado"
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full max-w-[560px] overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-[0_24px_60px_-20px_rgba(16,24,40,0.35)]"
      >
        <div className="flex items-center gap-2 border-b border-zinc-100 px-4 py-3">
          <Keyboard size={16} className="text-zinc-400" />
          <p className="text-sm font-semibold text-zinc-900">Atalhos de teclado</p>
          <button type="button" onClick={() => setAjuda(false)} aria-label="Fechar" className="ml-auto rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700">
            <X size={15} />
          </button>
        </div>
        <div className="grid gap-6 p-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-[11px] font-medium text-zinc-400">Ir para</p>
            <ul className="space-y-1.5">
              {ATALHOS_DE_TELA.map((a) => (
                <li key={a.href} className="flex items-center justify-between gap-3 text-[13px] text-zinc-700">
                  {a.titulo}
                  <Teclas valor={a.teclas} />
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-2 text-[11px] font-medium text-zinc-400">Ações</p>
            <ul className="space-y-1.5">
              {ATALHOS_DE_ACAO.map((a) => (
                <li key={a.teclas} className="flex items-center justify-between gap-3 text-[13px] text-zinc-700">
                  {a.titulo}
                  <Teclas valor={a.teclas} />
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs leading-relaxed text-zinc-500">Os atalhos não valem enquanto se digita num campo.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Teclas({ valor }: { valor: string }) {
  return (
    <span className="flex shrink-0 gap-1">
      {valor.split(" ").map((t, i) =>
        t === "ou" ? (
          <span key={i} className="text-[11px] text-zinc-400">ou</span>
        ) : (
          <kbd key={i} className="min-w-5 rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-center font-sans text-[11px] text-zinc-600">
            {t}
          </kbd>
        )
      )}
    </span>
  );
}
