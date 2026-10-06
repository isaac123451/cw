"use client";

import Link from "next/link";

import { respondida } from "@/lib/models/case";
import { useRouter } from "next/navigation";

import { useMemo } from "react";

import {
  CheckCircle2,
  CircleAlert,
  Inbox,
  Timer,
} from "lucide-react";

import { useScopedCases } from "@/lib/context/useScopedCases";
import { isOpen, naSituacao, seteDiasAtras } from "@/lib/services/case.service";
import { useGoals } from "@/lib/context/GoalsContext";
import { parseElapsedText } from "@/lib/services/case.mapper";
import { usePainelDoPortal } from "@/lib/hooks/usePainelDoPortal";

import StatTile from "@/components/shared/StatTile";

import {
  bandOf,
  displayBand,
  formatElapsed,
  formatRange,
  getRange,
  getReputation,
  inRange,
  ptBR,
  RA1000_BAND,
  RA1000_TARGETS,
  textoSobre,
} from "@/lib/services/reputation.service";

export default function MetricsBar() {

  const { cases, setFilter, loading } = useScopedCases("reclame-aqui");
  const router = useRouter();
  const { goals } = useGoals();

  /** Janela oficial de 6 meses — a mesma que define a nota pública. */
  const range = useMemo(() => getRange("6m"), []);

  const noPeriodo = useMemo(
    () =>
      cases.filter((item) =>
        inRange(item, range.start, range.end)
      ),
    [cases, range]
  );

  const reputacao = useMemo(
    () => getReputation(noPeriodo),
    [noPeriodo]
  );

  /*
    A nota que o portal mostra (1.86). O painel do Reclame Aqui não é
    recalculado todo dia: em 29/09 ele dizia 8,8 e a conta daqui, com as
    respostas já publicadas, 8,9. O destaque é o oficial; a conta vai
    embaixo, como "com o que já foi feito".
  */
  const painel = usePainelDoPortal().SIX_MONTHS;
  const oficial = painel && painel.fim === range.end && painel.nota != null ? painel : undefined;

  const band = oficial
    ? oficial.selo === "RA1000" ? RA1000_BAND : bandOf(oficial.nota as number)
    : displayBand(reputacao);

  const abertos = cases.filter(isOpen).length;

  /* As abertas sem resposta pública — a mesma regra do filtro e do número do menu (1.121). */
  const semRespostaAbertas = useMemo(() => {
    const corte = seteDiasAtras();
    return cases.filter((c) => naSituacao(c, "sem-resposta", corte)).length;
  }, [cases]);

  /**
   * A espera típica e a pior, das reclamações respondidas na janela.
   *
   * A mesma conta da distribuição em `/reclame-aqui/graficos` — se as
   * duas telas dessem mediana diferente, nenhuma delas valeria. Aqui
   * só as duas pontas cabem; o resto está lá.
   */
  const espera = useMemo(() => {

    const minutos = noPeriodo
      .filter(
        (item) => respondida(item)
      )
      .map((item) => parseElapsedText(item.responseTime))
      .filter((valor): valor is number => valor !== null)
      .sort((a, b) => a - b);

    return {
      mediana:
        minutos.length > 0
          ? minutos[Math.floor(minutos.length / 2)]
          : null,
      pior:
        minutos.length > 0
          ? minutos[minutos.length - 1]
          : null,
    };

  }, [noPeriodo]);

  /* Sem o número do portal e com a base chegando, a nota não é "0/10" (out/2026). */
  const semNota = loading && !oficial;

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">

      {/* Nota de reputação em destaque */}

      <Link
        href="/reclame-aqui/indice"
        title={
          oficial
            ? `Nota do painel do Reclame Aqui (${formatRange(range.start, range.end)}). Com as respostas e avaliações que já existem, a conta dá ${ptBR(reputacao.raScore)} — o portal atualiza com atraso. Clique para ver o índice.`
            : `Nota calculada sobre ${formatRange(range.start, range.end)} — clique para ver o detalhamento.`
        }
        className="group relative overflow-hidden rounded-xl border border-zinc-200/80 bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-colors hover:border-zinc-300"
      >

        <span
          aria-hidden
          className="absolute inset-y-0 left-0 w-[3px]"
          style={{ background: semNota ? "transparent" : band.color }}
        />

        <div className="flex items-start justify-between gap-3">

          <p className="text-xs font-medium text-zinc-500">
            Reputação
          </p>

          {!semNota && <span
            className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{
              background: band.color,
              color: textoSobre(band.color),
            }}
          >
            {band.label}
          </span>}

        </div>

        <p className="mt-1.5 text-[26px] font-semibold leading-none tracking-tight tabular-nums text-zinc-900">
          {semNota ? (
            <span aria-label="Carregando" className="inline-block h-[26px] w-14 animate-pulse rounded-md bg-zinc-100 align-top" />
          ) : (
            ptBR(oficial ? (oficial.nota as number) : reputacao.raScore)
          )}
          <span className="ml-1 text-base font-normal text-zinc-400">
            /10
          </span>
        </p>

        <p className="mt-2 text-xs text-zinc-400">
          {oficial
            ? Math.abs(reputacao.raScore - (oficial.nota as number)) >= 0.05
              ? `no portal · com o feito, ${ptBR(reputacao.raScore)}`
              : "no portal · 6 meses fechados"
            : "últimos 6 meses fechados"}
        </p>

      </Link>

      {/* Clicável (1.121): o "sem resposta" do rodapé abre a lista delas. */}
      <StatTile
        carregando={loading}
        label="Reclamações"
        description="Total recebido na janela de 6 meses que define a nota pública. Clique para ver as abertas sem resposta pública."
        value={reputacao.received}
        hint={semRespostaAbertas > 0 ? `${semRespostaAbertas} sem resposta pública · ver quais` : "todas respondidas"}
        icon={CircleAlert}
        tone="danger"
        onClick={semRespostaAbertas > 0 ? () => setFilter("situacao", "sem-resposta") : undefined}
      />

      {/*
        A meta vem do cadastro, não de um 90 escrito aqui.

        O Isaac: "quando eu selecionar uma meta, ela precisa ser
        atribuída a tudo que se relaciona a meta". Este cartão dizia
        "meta de 90%" fixo, e quem tivesse ajustado a meta para 92% em
        Analytics via dois números diferentes para a mesma coisa em duas
        telas — e a fixa era a que abria primeiro.

        O rodapé diz quando a meta é sua e não a do portal: sem isso,
        alcançar 91% com meta ajustada para 92% pareceria fracasso
        diante de um critério que o Reclame Aqui já daria por cumprido.
      */}
      <StatTile
        carregando={loading}
        label="Índice de resposta"
        description="Percentual respondido publicamente: 20% da nota, e o único item que depende só de nós."
        value={`${ptBR(reputacao.responseIndex)}%`}
        hint={
          goals.resposta === RA1000_TARGETS.resposta
            ? `meta de ${ptBR(goals.resposta)}%`
            : `meta de ${ptBR(goals.resposta)}% · ajustada por você (RA1000 pede ${ptBR(RA1000_TARGETS.resposta)}%)`
        }
        icon={CheckCircle2}
        tone={
          reputacao.responseIndex >= goals.resposta
            ? "success"
            : "warning"
        }
      />

      {/*
        A espera **típica**, e não a média.

        O Isaac: "é importante que você adicione as métricas para
        mostrar e não 'tempo de resposta'". O que estava aqui era a
        média, e a média mente neste dado: medida na base, ela dá 21
        dias enquanto a mediana é 10 e a pior levou 170. Alguns casos
        muito longos puxam o número, e quem lê "21 dias" imagina que os
        casos se parecem uns com os outros.

        A mediana responde "quanto o consumidor típico esperou". O pior
        caso vai no rodapé porque é ele que gera avaliação baixa, e a
        média some — ela não respondia pergunta nenhuma que estas duas
        não respondam melhor.
      */}
      <StatTile
        carregando={loading}
        label="Espera do consumidor"
        description="Metade das reclamações foi respondida em menos que isto. A mediana, e não a média: alguns casos muito longos distorcem a média sem representar a experiência da maioria."
        value={
          espera.mediana === null
            ? "—"
            : formatElapsed(espera.mediana)
        }
        hint={
          espera.pior === null
            ? "sem tempo registrado"
            : `mediana · pior: ${formatElapsed(espera.pior)}`
        }
        icon={Timer}
        onClick={() =>
          router.push("/reclame-aqui/graficos")
        }
        tone={
          espera.mediana === null
            ? "info"
            : espera.mediana <= 1440
              ? "success"
              : espera.mediana <= 10080
                ? "warning"
                : "danger"
        }
      />

      <StatTile
        carregando={loading}
        label="Na fila"
        description="Casos que ainda dependem de ação da operação, de qualquer período."
        value={abertos}
        hint={`de ${cases.length} no total`}
        icon={Inbox}
        tone="primary"
      />

    </div>
  );
}
