"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Compass, X } from "lucide-react";

import { lerPrimeiroAcesso } from "@/lib/actions/primeiroAcesso";
import { progressoDoGuia } from "@/lib/models/primeiroAcesso";
import { oferecerTourDaTela } from "@/lib/models/primeiraSemana";

/**
 * "Primeira vez aqui?" — o convite do tour da tela, na primeira semana.
 *
 * Um aviso pequeno no rodapé, nunca o tour abrindo sozinho. Uma vez por
 * tela: mostrar ou fechar conta como visto. O que é do navegador (a
 * primeira visita e as telas já vistas) fica no navegador; o servidor só
 * é consultado quando há de fato um convite a fazer, e uma vez por sessão.
 */

const CHAVE_PRIMEIRA_VISITA = "cw:primeira-visita";
const CHAVE_VISTOS = "cw:tours-das-telas-vistos";
const EVENTO = "cw:guia-local";

const NA_TELA: Record<string, string> = {
  "/meu-dia": "no Meu dia",
  "/reclame-aqui": "no Reclame Aqui",
  "/nps": "no NPS",
  "/redes-sociais": "nas Redes Sociais",
  "/agenda": "na Agenda",
};

function ler(chave: string) {
  try {
    return localStorage.getItem(chave);
  } catch {
    return null;
  }
}

function gravar(chave: string, valor: string) {
  try {
    localStorage.setItem(chave, valor);
    window.dispatchEvent(new Event(EVENTO));
  } catch {
    /* Sem armazenamento: o convite volta na próxima visita, e só. */
  }
}

const ouvir = (avisar: () => void) => {
  window.addEventListener(EVENTO, avisar);
  return () => window.removeEventListener(EVENTO, avisar);
};

/* O roteiro em curso é lido uma vez por sessão, e só quando há convite a fazer. */
let roteiroEmCursoGuardado: boolean | null = null;

export default function DicaDaTela() {

  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();

  const primeiraVisita = useSyncExternalStore(ouvir, () => ler(CHAVE_PRIMEIRA_VISITA), () => null);
  const vistosTexto = useSyncExternalStore(ouvir, () => ler(CHAVE_VISTOS) ?? "[]", () => "[]");
  const [roteiroEmCurso, setRoteiroEmCurso] = useState<boolean | null>(roteiroEmCursoGuardado);

  /* A primeira visita, guardada uma vez: é dela que se contam os sete dias. */
  useEffect(() => {
    if (!ler(CHAVE_PRIMEIRA_VISITA)) gravar(CHAVE_PRIMEIRA_VISITA, new Date().toISOString());
  }, []);

  let jaVistas: string[] = [];
  try {
    const lido = JSON.parse(vistosTexto);
    if (Array.isArray(lido)) jaVistas = lido.filter((x) => typeof x === "string");
  } catch {
    jaVistas = [];
  }

  /* Antes de perguntar ao servidor: há convite possível nesta tela? */
  const candidato = oferecerTourDaTela({ rota: pathname, primeiraVisita, jaVistas, roteiroEmCurso: true });

  useEffect(() => {
    if (!candidato || roteiroEmCurso !== null) return;
    let vivo = true;
    lerPrimeiroAcesso()
      .then((r) => {
        const emCurso = r.ok && !r.estado.dispensadoEm && !progressoDoGuia(r.estado).concluido;
        roteiroEmCursoGuardado = emCurso;
        if (vivo) setRoteiroEmCurso(emCurso);
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [candidato, roteiroEmCurso]);

  const tour = roteiroEmCurso ? candidato : null;
  if (!tour || params.get("tour")) return null;

  const marcarVisto = () => gravar(CHAVE_VISTOS, JSON.stringify([...new Set([...jaVistas, tour.id])]));

  return (
    <div
      role="status"
      className="fixed bottom-5 left-1/2 z-[70] flex w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-3 rounded-xl border border-zinc-200 bg-white py-2 pl-3 pr-2 text-sm shadow-[0_8px_24px_-12px_rgba(16,24,40,0.3)]"
    >
      <Compass size={16} className="shrink-0 text-violet-600" />
      <span className="text-zinc-700">
        Primeira vez {NA_TELA[pathname] ?? "nesta tela"}?
      </span>
      <button
        type="button"
        onClick={() => {
          marcarVisto();
          router.push(`${pathname}?tour=${tour.id}`, { scroll: false });
        }}
        className="rounded-lg bg-violet-700 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-violet-800"
      >
        Ver em {tour.passos.length} passos
      </button>
      <button
        type="button"
        onClick={marcarVisto}
        aria-label="Agora não"
        title="Agora não — não aparece mais nesta tela"
        className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-50 hover:text-zinc-700"
      >
        <X size={14} />
      </button>
    </div>
  );
}
