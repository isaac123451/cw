"use client";

import { useEffect, useState } from "react";

import { History, Loader2 } from "lucide-react";

import { Case } from "@/lib/models/case";
import type { ContatoView } from "@/lib/models/tratativa";

import { listarContatos } from "@/lib/actions/tratativa";
import { useMovements } from "@/lib/context/MovementsContext";

import {
  buildTimeline,
  quandoNaLinha,
  TIMELINE_TONE,
} from "@/lib/services/timeline.service";

import SurfaceCard from "@/components/shared/SurfaceCard";

/**
 * Histórico do caso.
 *
 * Soma ao que o caso diz de si (registro, resposta, avaliação) o que foi
 * registrado ao longo da trilha: triagem, contatos, áreas acionadas,
 * escalonamentos, moderação e CW Engine. Os contatos vêm do banco quando
 * a aba abre — a lista do quadro não os carrega.
 */
export default function CaseTimeline({
  data,
}: {
  data: Case;
}) {

  const { movements } = useMovements();

  const [contatos, setContatos] = useState<ContatoView[] | null>(null);

  useEffect(() => {
    let ativo = true;
    listarContatos(data.protocol)
      .then((lista) => ativo && setContatos(lista))
      .catch(() => ativo && setContatos([]));
    return () => {
      ativo = false;
    };
  }, [data.protocol, data.ultimoContatoEm]);

  const entries = buildTimeline(data, movements, contatos ?? []);

  return (
    <SurfaceCard
      title="Histórico da reclamação"
      description="A trilha do caso na ordem em que aconteceu, com quem fez cada passo. Horários de Brasília."
    >

      {contatos === null && (
        <p className="mb-4 flex items-center gap-1.5 text-xs text-zinc-400">
          <Loader2 size={12} className="animate-spin" /> Buscando os contatos registrados…
        </p>
      )}

      <ol className="relative space-y-5 before:absolute before:left-[5px] before:top-2 before:h-[calc(100%-1rem)] before:w-px before:bg-zinc-200 before:content-['']">

        {entries.map((item) => (

          <li key={item.id} className="relative pl-6">

            <span
              className={`absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-white ${TIMELINE_TONE[item.tone]}`}
            />

            <p className="text-sm font-medium text-zinc-800">
              {item.title}
            </p>

            <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">
              <span
                className="tabular-nums"
                title={item.aproximado ? "Data aproximada: o momento exato não foi registrado." : undefined}
              >
                {item.aproximado ? "≈ " : ""}
                {quandoNaLinha(item.at)}
              </span>{" "}
              · {item.detail}
            </p>

          </li>

        ))}

      </ol>

      <p className="mt-5 flex items-center gap-2 border-t border-zinc-100 pt-4 text-xs text-zinc-400">
        <History size={13} />
        Rastreabilidade completa: origem, triagem, contatos, áreas internas, resposta, moderação,
        avaliação e finalização.
      </p>

    </SurfaceCard>
  );
}
