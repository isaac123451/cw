"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { useCallback, useEffect, useRef, useState } from "react";

import { X } from "lucide-react";

import { notifyGlobal } from "@/lib/context/ToastContext";
import { tourPorId, type TourDaNovidade as Tour } from "@/lib/models/novidades";
import { tourDaTela } from "@/lib/models/primeiraSemana";

/**
 * O tour de uma novidade, na própria tela.
 *
 * A página de Novidades leva para `?tour=<id>`; aqui, um balão aponta o
 * elemento de cada passo com um contorno — sem escurecer nem desfocar a
 * tela, que continua usável por baixo. Enter ou → avança, Esc sai.
 *
 * O elemento pode demorar (a lista chega depois da tela): cada passo
 * espera até 4 s por ele. Se não aparece — lista vazia, menu escondido no
 * celular —, o passo é pulado, em vez de apontar para o nada.
 */
export default function TourDaNovidade() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const id = params.get("tour");
  /* Os tours das novidades e os da primeira semana (um por tela) usam o mesmo balão. */
  const tour = tourPorId(id) ?? tourDaTela(id);

  const sair = useCallback(() => {
    const resto = new URLSearchParams(params.toString());
    resto.delete("tour");
    const busca = resto.toString();
    router.replace(`${pathname}${busca ? `?${busca}` : ""}`, { scroll: false });
  }, [params, pathname, router]);

  if (!tour) return null;
  return <Balao key={tour.id} tour={tour} onSair={sair} />;
}

const LARGURA = 296;
const ESPERA_MS = 4000;

function Balao({ tour, onSair }: { tour: Tour; onSair: () => void }) {

  const [indice, setIndice] = useState(0);
  const [alvo, setAlvo] = useState<DOMRect | null>(null);
  const achados = useRef(0);

  const passo = tour.passos[indice];
  const ultimo = indice === tour.passos.length - 1;

  const avancar = useCallback(() => {
    setAlvo(null);
    if (ultimo && achados.current === 0) {
      notifyGlobal({ tone: "info", title: "Nada para mostrar nesta tela agora.", detail: "O tour aponta itens que aparecem com dados na tela, ou numa tela mais larga." });
    }
    if (ultimo) onSair();
    else setIndice((i) => i + 1);
  }, [ultimo, onSair]);

  /* Procura o elemento do passo; acha, rola até ele e acompanha rolagem e redimensionamento. */
  useEffect(() => {
    if (!passo) return;
    let el: Element | null = null;
    const inicio = Date.now();

    const visivel = (e: Element) => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    const medir = () => {
      if (el) setAlvo(el.getBoundingClientRect());
    };

    const procura = window.setInterval(() => {
      const achado = [...document.querySelectorAll(passo.alvo)].find(visivel) ?? null;
      if (achado) {
        window.clearInterval(procura);
        el = achado;
        achados.current += 1;
        el.scrollIntoView({ block: "nearest", behavior: "smooth" });
        window.setTimeout(medir, 350);
        medir();
      } else if (Date.now() - inicio > ESPERA_MS) {
        window.clearInterval(procura);
        avancar();
      }
    }, 200);

    window.addEventListener("scroll", medir, true);
    window.addEventListener("resize", medir);
    return () => {
      window.clearInterval(procura);
      window.removeEventListener("scroll", medir, true);
      window.removeEventListener("resize", medir);
    };
  }, [passo, avancar]);

  useEffect(() => {
    function tecla(e: KeyboardEvent) {
      if (e.key === "Escape") onSair();
      /* Enter já aperta o botão, que nasce com o foco. */
      else if (e.key === "ArrowRight") {
        e.preventDefault();
        avancar();
      }
    }
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [avancar, onSair]);

  if (!passo || !alvo) return null;

  const largura = Math.min(LARGURA, window.innerWidth - 16);
  /* Abaixo; se não cabe, acima; alvo alto demais (o menu inteiro), ao lado. */
  const ALTURA = 180;
  const lado = alvo.bottom + ALTURA >= window.innerHeight && alvo.top < ALTURA ? "direita" : alvo.bottom + ALTURA < window.innerHeight ? "abaixo" : "acima";
  const limitarX = (x: number) => Math.max(8, Math.min(x, window.innerWidth - largura - 8));
  const left = lado === "direita" ? limitarX(alvo.right + 12) : limitarX(alvo.left);
  const top = lado === "abaixo" ? alvo.bottom + 12 : lado === "acima" ? alvo.top - 12 : Math.max(8, Math.min(alvo.top + 16, window.innerHeight - ALTURA));

  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none fixed z-[70] rounded-lg ring-2 ring-violet-500 transition-all duration-150 motion-reduce:transition-none"
        style={{ left: alvo.left - 3, top: alvo.top - 3, width: alvo.width + 6, height: alvo.height + 6 }}
      />
      <div
        role="dialog"
        aria-label={`Novidade: ${passo.titulo}`}
        className="fixed z-[71] rounded-xl border border-zinc-200 bg-white p-3.5 shadow-[0_12px_32px_-8px_rgba(16,24,40,0.25)]"
        style={{ left, top, width: largura, transform: lado === "acima" ? "translateY(-100%)" : undefined }}
      >
        <div className="flex items-start gap-2">
          <p className="min-w-0 flex-1 text-[13px] font-semibold text-zinc-900">{passo.titulo}</p>
          <button type="button" onClick={onSair} aria-label="Sair do tour" className="-mr-1 -mt-1 rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700">
            <X size={14} />
          </button>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-zinc-600">{passo.texto}</p>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-[11px] tabular-nums text-zinc-400">
            {tour.passos.length > 1 ? `${indice + 1} de ${tour.passos.length}` : ""}
          </span>
          <button type="button" onClick={avancar} autoFocus className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800">
            {ultimo ? "Entendi" : "Próximo"}
          </button>
        </div>
      </div>
    </>
  );
}
