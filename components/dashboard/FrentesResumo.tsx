"use client";

import Link from "next/link";

import { useMemo } from "react";

import { ArrowUpRight } from "lucide-react";

import SurfaceCard from "@/components/shared/SurfaceCard";
import IconeDaFrente from "@/components/shared/IconeDaFrente";

import { useCases } from "@/lib/context/CaseContext";
import { useNps } from "@/lib/context/NpsContext";
import { useAvaliacoesGoogle } from "@/lib/context/useAvaliacoesGoogle";

import { isOpen, isReclameAqui, isSocial } from "@/lib/services/case.service";
import { ptBR } from "@/lib/services/reputation.service";

import { FRENTES_DA_OPERACAO, type FrenteId } from "@/lib/models/frentes";
import { isEncerrado, segmentOf } from "@/lib/models/nps";
import { indicadoresGoogle } from "@/lib/models/avaliacoesGoogle";

/**
 * As quatro frentes lado a lado, no painel.
 *
 * Começou com o Reclame Aqui; o Isaac apontou que "os gráficos estão
 * focados somente no reclame aqui", e vieram as redes e o NPS. Com o
 * Google na Fase 4, e o pedido de "as frentes todas unidas nos lugares
 * em que aparecem", são as quatro — na ordem de prioridade do documento
 * de acompanhamento do agente.
 *
 * Somar não serve: cada uma mede uma coisa, numa escala. Reclamação e
 * atendimento se contam, NPS vai de −100 a +100, o Google é nota de 1 a
 * 5. O que responde a pergunta da manhã — onde está o trabalho hoje — é
 * o retrato lado a lado, cada uma com o seu número e o que está aberto.
 */
export default function FrentesResumo() {

  const { cases } = useCases();
  const { responses } = useNps();
  const { avaliacoes } = useAvaliacoesGoogle();

  const porFrente = useMemo(() => {

    const ra = cases.filter(isReclameAqui);
    const social = cases.filter(isSocial);

    const promotores = responses.filter((r) => segmentOf(r.score).label === "Promotor").length;
    const detratores = responses.filter((r) => segmentOf(r.score).label === "Detrator").length;
    const nps = responses.length === 0 ? null : Math.round(((promotores - detratores) / responses.length) * 100);

    const google = indicadoresGoogle(avaliacoes);

    const numeros: Record<FrenteId, { principal: string; rotulo: string; abertos: number; aberturaRotulo: string }> = {
      "reclame-aqui": {
        principal: `${ra.length}`,
        rotulo: "reclamações na base",
        abertos: ra.filter(isOpen).length,
        aberturaRotulo: "em aberto",
      },
      redes: {
        principal: `${social.length}`,
        rotulo: "atendimentos na base",
        abertos: social.filter(isOpen).length,
        aberturaRotulo: "em aberto",
      },
      nps: {
        principal: nps === null ? "—" : ptBR(nps),
        rotulo: `de ${responses.length} resposta(s)`,
        abertos: responses.filter((r) => !isEncerrado(r.status)).length,
        aberturaRotulo: "em tratativa",
      },
      google: {
        principal: google.notaMedia === null ? "—" : google.notaMedia.toLocaleString("pt-BR"),
        rotulo: `nota média de ${google.total} avaliação(ões)`,
        abertos: avaliacoes.filter((a) => a.status === "aberta").length,
        aberturaRotulo: "abertas",
      },
    };

    return FRENTES_DA_OPERACAO.map((f) => ({ ...f, ...numeros[f.id] }));
  }, [cases, responses, avaliacoes]);

  return (
    <SurfaceCard
      title="As quatro frentes"
      description="Onde está o trabalho hoje, na ordem de prioridade do documento. Cada uma mede uma coisa — por isso ficam lado a lado, e não somadas."
    >

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">

        {porFrente.map((f) => (
          <Link
            key={f.id}
            href={f.href}
            title={f.dica}
            className="group flex flex-col rounded-xl border border-zinc-200/80 p-4 transition-colors hover:border-violet-200 hover:bg-violet-50/30"
          >

            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                <IconeDaFrente frente={f.id} size={14} />
                {f.nome}
              </span>
              <ArrowUpRight size={14} className="shrink-0 text-zinc-300 transition-colors group-hover:text-violet-600" />
            </div>

            <p className="mt-3 text-2xl font-semibold tabular-nums text-zinc-900">{f.principal}</p>
            <p className="text-xs text-zinc-500">{f.rotulo}</p>

            <p
              className={`mt-3 inline-flex w-fit items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                f.abertos > 0
                  ? "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-100"
                  : "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-100"
              }`}
            >
              {f.abertos} {f.aberturaRotulo}
            </p>

          </Link>
        ))}

      </div>

    </SurfaceCard>
  );
}
