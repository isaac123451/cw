"use client";

import Link from "next/link";

import { useEffect, useState } from "react";

import { Siren } from "lucide-react";

import { leitura } from "@/lib/lote";

import type { Incidente } from "@/lib/models/radarDeIncidente";
import { descreverRegistro } from "@/lib/services/horasUteis";

/* Em lote, por rota (1.116): sai junto com as outras leituras da tela, em paralelo e fora da fila. */
const lerRadarDeIncidente = leitura("radar");

const FRENTE: Record<Incidente["frentes"][number], string> = {
  "reclame-aqui": "Reclame Aqui",
  redes: "Redes",
  nps: "NPS",
  conversa: "conversas",
};

/**
 * O radar de incidente no topo do Meu dia (Fase 31, 1.102). Só aparece
 * quando há incidente: três ou mais clientes no mesmo tema de falha em 6
 * horas, somando as frentes — com a lista dos afetados. Relido a cada 5
 * minutos com a tela aberta.
 */
export default function RadarDeIncidente() {
  const [incidentes, setIncidentes] = useState<Incidente[]>([]);

  useEffect(() => {
    let vivo = true;
    const ler = () => lerRadarDeIncidente().then((i) => vivo && setIncidentes(i)).catch(() => undefined);
    ler();
    const relogio = setInterval(ler, 5 * 60_000);
    return () => {
      vivo = false;
      clearInterval(relogio);
    };
  }, []);

  if (incidentes.length === 0) return null;

  return (
    <section aria-label="Radar de incidente" className="rounded-xl border border-rose-200 bg-rose-50/60 px-4 py-3">
      {incidentes.map((i) => (
        <details key={i.temaId} className="group">
          <summary className="flex cursor-pointer list-none items-start gap-2">
            <Siren size={16} className="mt-0.5 shrink-0 text-rose-700" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-rose-900">
                Possível incidente: {i.clientes} clientes sobre {i.tema.toLowerCase()} desde {descreverRegistro(i.desde)}
              </span>
              <span className="block text-xs text-rose-800/80">
                {i.frentes.map((f) => FRENTE[f]).join(" · ")} — confira com Produto se há falha em comum. Clique para ver os afetados.
              </span>
            </span>
          </summary>
          <ul className="mt-2 space-y-0.5 pl-6 text-xs">
            {i.afetados.slice(0, 20).map((a, k) => (
              <li key={k} className="text-zinc-700">
                <span className="tabular-nums text-zinc-500">{descreverRegistro(a.quando)}</span>{" "}
                {a.href ? (
                  <Link href={a.href} className="text-violet-700 hover:underline">
                    {a.rotulo}
                  </Link>
                ) : (
                  a.rotulo
                )}
              </li>
            ))}
          </ul>
        </details>
      ))}
    </section>
  );
}
