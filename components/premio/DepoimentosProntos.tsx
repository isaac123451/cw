"use client";

import { useEffect, useMemo, useState } from "react";

import SurfaceCard from "@/components/shared/SurfaceCard";
import BotaoCopiar from "@/components/shared/BotaoCopiar";

import { listarAvaliacoesGoogle, type AvaliacaoGoogleView } from "@/lib/actions/avaliacoesGoogle";
import { useNps } from "@/lib/context/NpsContext";
import { depoimentosDoPremio, textoDoDepoimento } from "@/lib/models/premio";

/**
 * Depoimentos prontos (Fase 23): as melhores falas de quem gosta da
 * Cardápio Web, para a campanha e para o marketing.
 *
 * Cada um diz se pode ser usado: quem aceitou ser case e a avaliação
 * pública do Google, sim; o comentário do NPS sem aceite, só depois de
 * pedir autorização.
 */
export default function DepoimentosProntos() {

  const { responses } = useNps();
  const [google, setGoogle] = useState<AvaliacaoGoogleView[]>([]);
  const [so, setSo] = useState<"liberados" | "todos">("liberados");

  useEffect(() => {
    let vivo = true;
    listarAvaliacoesGoogle()
      .then((lista) => vivo && setGoogle(lista))
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, []);

  const todos = useMemo(() => depoimentosDoPremio({ nps: responses, google }), [responses, google]);
  const visiveis = so === "liberados" ? todos.filter((d) => d.liberado) : todos;

  return (
    <SurfaceCard
      title="Depoimentos prontos"
      description="Promotores do NPS com comentário e avaliações 5 estrelas do Google, sem ressalva. Primeiro quem aceitou ser case e o que já é público."
    >
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {(["liberados", "todos"] as const).map((o) => (
          <button key={o} type="button" aria-pressed={so === o} onClick={() => setSo(o)} className={`rounded-md px-2 py-1 font-medium ${so === o ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100"}`}>
            {o === "liberados" ? `Liberados (${todos.filter((d) => d.liberado).length})` : `Todos (${todos.length})`}
          </button>
        ))}
        {visiveis.length > 1 && (
          <BotaoCopiar texto={visiveis.slice(0, 20).map(textoDoDepoimento).join("\n\n")} rotulo={`Copiar ${Math.min(visiveis.length, 20)}`} className="ml-auto" />
        )}
      </div>
      {visiveis.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500">
          {todos.length ? "Nenhum liberado ainda: veja todos e peça autorização aos promotores." : "Nenhuma fala de promotor ou 5 estrelas com texto ainda."}
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {visiveis.slice(0, 20).map((d) => (
            <li key={`${d.origem}:${d.ref}`} className="rounded-lg border border-zinc-100 px-3 py-2">
              <p className="text-sm text-zinc-800 [overflow-wrap:anywhere]">“{d.fala}”</p>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                <span className="font-medium text-zinc-700">{d.autor}</span>
                <span>{d.origem === "nps" ? `NPS ${d.nota}` : "Google ★★★★★"}</span>
                <span className={`rounded px-1.5 py-px font-medium ${d.liberado ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>{d.uso}</span>
                {d.link && (
                  <a href={d.link} target="_blank" rel="noreferrer" className="text-violet-700 hover:underline">
                    ver no Google
                  </a>
                )}
                <BotaoCopiar texto={textoDoDepoimento(d)} className="ml-auto" />
              </div>
            </li>
          ))}
        </ul>
      )}
    </SurfaceCard>
  );
}
