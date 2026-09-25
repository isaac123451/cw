"use client";

import { useEffect, useState } from "react";

import { Sparkles } from "lucide-react";

import { sugestoesDeEstabelecimento, type SugestaoDeEstabelecimento } from "@/lib/actions/identificacao";

/**
 * "Pode ser:" — o estabelecimento provável de um caso sem vínculo (1.83).
 *
 * As pistas do próprio caso (nome, @ do perfil, documento, e-mail, o que
 * o cliente escreveu no relato e nas conversas guardadas) viram até três
 * sugestões, cada uma com o porquê. O clique escolhe a conta como se
 * fosse pelo campo — quem vincula é a pessoa.
 */
export default function SugestoesDeEstabelecimento({ protocolo, onEscolher }: { protocolo: string; onEscolher: (id: string) => void }) {
  const [sugestoes, setSugestoes] = useState<SugestaoDeEstabelecimento[]>([]);

  useEffect(() => {
    let vivo = true;
    sugestoesDeEstabelecimento(protocolo)
      .then((s) => vivo && setSugestoes(s))
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [protocolo]);

  if (sugestoes.length === 0) return null;

  return (
    <div className="mt-2 rounded-lg bg-violet-50/60 px-3 py-2 ring-1 ring-inset ring-violet-100">
      <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-violet-700">
        <Sparkles size={11} /> Pode ser
      </p>
      <ul className="mt-1 space-y-1">
        {sugestoes.map((s) => (
          <li key={s.id} className="flex items-center gap-2 text-xs">
            <span className="min-w-0 flex-1 truncate">
              <span className="font-medium text-zinc-800">{s.nome}</span>
              <span className="text-zinc-500"> · {s.motivo}</span>
            </span>
            <button type="button" onClick={() => onEscolher(s.id)} className="shrink-0 rounded-md px-2 py-0.5 font-medium text-violet-700 ring-1 ring-inset ring-violet-200 hover:bg-white">
              Vincular
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
