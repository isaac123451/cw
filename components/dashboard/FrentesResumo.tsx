"use client";

import Link from "next/link";

import { useMemo } from "react";

import {
  ArrowUpRight,
  AtSign,
  Gauge,
  MessageSquareWarning,
} from "lucide-react";

import SurfaceCard from "@/components/shared/SurfaceCard";

import { useCases } from "@/lib/context/CaseContext";
import { useNps } from "@/lib/context/NpsContext";

import {
  isOpen,
  isReclameAqui,
  isSocial,
} from "@/lib/services/case.service";

import { ptBR } from "@/lib/services/reputation.service";

import { segmentOf } from "@/lib/models/nps";
import { isEncerrado } from "@/lib/models/nps";

/**
 * As três frentes lado a lado, no painel.
 *
 * O painel abria só com o Reclame Aqui — e o Isaac apontou: "os gráfico
 * estão focados somente no reclame aqui e tem outras 2 frentes que são
 * o nps e manychat (redes sociais)".
 *
 * A tentação seria somar tudo num gráfico só. Não serve: as três medem
 * coisas diferentes e em escalas diferentes — reclamação se conta,
 * atendimento de rede social se conta, e NPS é uma média de −100 a
 * +100. Somadas viram um número que não responde nada.
 *
 * O que responde é o retrato lado a lado: cada frente com o seu número
 * principal, o que está em aberto, e um caminho para dentro. É a
 * pergunta da manhã — onde está o trabalho hoje — e não uma tentativa
 * de reduzir três operações a um indicador.
 */
export default function FrentesResumo() {

  const { cases } = useCases();
  const { responses } = useNps();

  const frentes = useMemo(() => {

    const ra = cases.filter(isReclameAqui);
    const social = cases.filter(isSocial);

    /*
      O NPS do período todo, e não de uma janela.

      A nota do Reclame Aqui tem janela oficial de seis meses; o NPS
      não tem janela nenhuma — é a pesquisa contínua. Recortar aqui
      inventaria uma regra que o resto da aplicação não usa.
    */
    const respondidos = responses.filter(
      (r) => typeof r.score === "number"
    );

    const promotores = respondidos.filter(
      (r) => segmentOf(r.score).label === "Promotor"
    ).length;

    const detratores = respondidos.filter(
      (r) => segmentOf(r.score).label === "Detrator"
    ).length;

    const nps =
      respondidos.length === 0
        ? null
        : Math.round(
            ((promotores - detratores) /
              respondidos.length) *
              100
          );

    return [
      {
        id: "ra",
        nome: "Reclame Aqui",
        icone: MessageSquareWarning,
        href: "/reclame-aqui",
        principal: `${ra.length}`,
        rotulo: "reclamações na base",
        abertos: ra.filter(isOpen).length,
        aberturaRotulo: "em aberto",
      },
      {
        id: "social",
        nome: "Redes Sociais",
        icone: AtSign,
        href: "/redes-sociais",
        principal: `${social.length}`,
        rotulo: "atendimentos na base",
        abertos: social.filter(isOpen).length,
        aberturaRotulo: "em aberto",
      },
      {
        id: "nps",
        nome: "NPS",
        icone: Gauge,
        href: "/nps",
        principal:
          nps === null ? "—" : ptBR(nps),
        rotulo: `de ${respondidos.length} resposta(s)`,
        abertos: responses.filter(
          (r) => !isEncerrado(r.status)
        ).length,
        aberturaRotulo: "em tratativa",
      },
    ];
  }, [cases, responses]);

  return (
    <SurfaceCard
      title="As três frentes"
      description="Onde está o trabalho hoje. Cada uma mede uma coisa diferente — por isso ficam lado a lado, e não somadas."
    >

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">

        {frentes.map((f) => {

          const Icone = f.icone;

          return (
            <Link
              key={f.id}
              href={f.href}
              className="group flex flex-col rounded-xl border border-zinc-200/80 p-4 transition-colors hover:border-violet-200 hover:bg-violet-50/30"
            >

              <div className="flex items-center justify-between gap-2">

                <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  <Icone
                    size={14}
                    className="text-violet-600"
                  />
                  {f.nome}
                </span>

                <ArrowUpRight
                  size={14}
                  className="shrink-0 text-zinc-300 transition-colors group-hover:text-violet-600"
                />

              </div>

              <p className="mt-3 text-2xl font-semibold tabular-nums text-zinc-900">
                {f.principal}
              </p>

              <p className="text-xs text-zinc-500">
                {f.rotulo}
              </p>

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
          );
        })}

      </div>

    </SurfaceCard>
  );
}
