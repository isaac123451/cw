"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { ArrowRight, Search, X } from "lucide-react";

import { filtrarMapa, GRUPOS_DO_MAPA, MAPA } from "@/lib/models/ondeFica";
import { pluralDe } from "@/lib/plural";

/**
 * Onde fica? (12/11/2026) — cada função da plataforma em uma linha: o que
 * faz, o caminho no menu e o "Ir até lá". Lista compacta, com filtro; o
 * item vindo da busca (#id) chega destacado.
 */
const ouvirHash = (avisar: () => void) => {
  window.addEventListener("hashchange", avisar);
  return () => window.removeEventListener("hashchange", avisar);
};

export default function OndeFica() {
  const [termo, setTermo] = useState("");
  const achados = useMemo(() => filtrarMapa(termo), [termo]);

  /* O item que a busca abriu (…?aba=onde-fica#ext-disparo) aparece destacado e à vista. */
  const hash = useSyncExternalStore(ouvirHash, () => window.location.hash, () => "");
  const destaque = useMemo(() => {
    const id = decodeURIComponent(hash.slice(1));
    return MAPA.some((m) => m.id === id) ? id : null;
  }, [hash]);
  useEffect(() => {
    if (destaque) requestAnimationFrame(() => document.getElementById(`onde-${destaque}`)?.scrollIntoView({ block: "center" }));
  }, [destaque]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1 basis-72">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            id="onde-fica-busca"
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            placeholder="O que você procura? Ex.: meta, áudio, disparo, permissão"
            aria-label="Procurar uma função"
            className="h-10 w-full rounded-xl border border-zinc-200 bg-white pl-9 pr-9 text-sm outline-none transition-colors focus:border-violet-400"
          />
          {termo && (
            <button
              type="button"
              onClick={() => setTermo("")}
              title="Limpar"
              className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <p className="text-xs text-zinc-500">
          {termo ? `${achados.length} de ${MAPA.length}` : `${MAPA.length} ${pluralDe(MAPA.length, "função", "funções")}`} · a busca do topo (Ctrl K) também acha cada uma
        </p>
      </div>

      {achados.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-zinc-200 px-4 py-8 text-center text-sm text-zinc-500">
          Nada com esse nome. Tente outra palavra, como &ldquo;nota&rdquo;, &ldquo;cliente&rdquo; ou &ldquo;WhatsApp&rdquo;.
        </p>
      ) : (
        GRUPOS_DO_MAPA.filter((g) => achados.some((a) => a.grupo === g)).map((grupo) => (
          <section key={grupo} aria-label={grupo}>
            <h2 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{grupo}</h2>
            <ul className="divide-y divide-zinc-100 overflow-hidden rounded-2xl border border-zinc-200/80 bg-white">
              {achados
                .filter((a) => a.grupo === grupo)
                .map((m) => (
                  <li
                    key={m.id}
                    id={`onde-${m.id}`}
                    className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3 sm:flex-nowrap ${destaque === m.id ? "bg-violet-50/70" : ""}`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-zinc-900">{m.nome}</p>
                      <p className="text-sm text-zinc-600">{m.faz}</p>
                    </div>
                    <p className="flex min-w-0 flex-wrap items-center gap-1 text-xs text-zinc-500 sm:max-w-[46%] sm:justify-end">
                      {m.caminho.map((c, i) => (
                        <span key={c} className="flex items-center gap-1">
                          {i > 0 && <span aria-hidden className="text-zinc-300">›</span>}
                          <span className="rounded-md border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-zinc-600">{c}</span>
                        </span>
                      ))}
                    </p>
                    {m.href ? (
                      <Link
                        href={m.href}
                        className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-violet-700 hover:bg-violet-50"
                      >
                        Ir até lá <ArrowRight size={13} />
                      </Link>
                    ) : (
                      <span className="w-[74px] shrink-0 text-right text-[11px] text-zinc-400">{m.grupo === "Extensão do Chrome" ? "no Chrome" : "na tela"}</span>
                    )}
                  </li>
                ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
