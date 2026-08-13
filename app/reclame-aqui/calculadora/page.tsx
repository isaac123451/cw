"use client";

import { useMemo, useState } from "react";

import {
  ArrowDown,
  ArrowUp,
  Calculator,
  Eraser,
  Info,
  Target,
} from "lucide-react";

import MainLayout from "@/components/layout/MainLayout";

import PageHeading from "@/components/shared/PageHeading";
import SurfaceCard from "@/components/shared/SurfaceCard";
import Tooltip from "@/components/shared/Tooltip";

import ModuleNav from "@/components/reclame-aqui/ModuleNav";
import DisregardedNotice from "@/components/reclame-aqui/DisregardedNotice";
import PeriodPicker from "@/components/reclame-aqui/calculadora/PeriodPicker";
import ScoreScale from "@/components/reclame-aqui/calculadora/ScoreScale";

import { useScopedCases } from "@/lib/context/useScopedCases";

import {
  emptySimulation,
  evaluationsToReach,
  getRange,
  getRawCounts,
  inRange,
  PeriodKey,
  PeriodMode,
  ptBR,
  RA1000_BAND,
  scoreBands,
  scoreFrom,
  simulate,
  SimulationInput,
  totalRatings,
} from "@/lib/services/reputation.service";

const periodLabels: Record<string, string> = {
  "6m": "6 meses",
  "12m": "12 meses",
};

type Kind = "simplificada" | "avancada";

const numberField =
  "h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm tabular-nums outline-none transition-colors focus:border-violet-400";

export default function CalculadoraPage() {

  const { cases } = useScopedCases("reclame-aqui");

  const [period, setPeriod] = useState<PeriodKey>("6m");
  const [mode, setMode] = useState<PeriodMode>("vigente");

  const [kind, setKind] = useState<Kind>("simplificada");

  const [input, setInput] =
    useState<SimulationInput>(emptySimulation);

  const [goal, setGoal] = useState<string>("Ótimo");

  const range = useMemo(
    () => getRange(period, mode),
    [period, mode]
  );

  const doPeriodo = useMemo(
    () =>
      cases.filter((item) =>
        inRange(item, range.start, range.end)
      ),
    [cases, range]
  );

  const base = useMemo(
    () => getRawCounts(doPeriodo),
    [doPeriodo]
  );

  const current = useMemo(
    () => scoreFrom(base),
    [base]
  );

  /**
   * O cenário sempre parte da base real do período.
   *
   * Antes havia um modo "utilizar dados atuais" que escondia todos os
   * campos — dava para ver a nota atual **ou** montar um cenário, nunca
   * os dois. Agora os dados atuais são o ponto de partida e o que se
   * digita entra por cima; com tudo zerado, o resultado é a nota atual.
   */
  const simulated = useMemo(
    () => scoreFrom(simulate(base, input)),
    [base, input]
  );

  /** RA1000 aparece como objetivo, embora não seja faixa de nota. */
  const objetivos = useMemo(
    () => [RA1000_BAND, ...[...scoreBands].reverse()],
    []
  );

  const target = useMemo(() => {

    const selo = goal === RA1000_BAND.label;

    const band =
      objetivos.find((item) => item.label === goal) ??
      RA1000_BAND;

    return evaluationsToReach(base, band, selo);

  }, [base, goal, objetivos]);

  const delta =
    Math.round(
      (simulated.raScore - current.raScore) * 10
    ) / 10;

  function setField(
    field: keyof SimulationInput,
    value: number
  ) {
    setInput((prev) => ({
      ...prev,
      [field]: Math.max(0, value || 0),
    }));
  }

  function setRating(score: number, value: number) {
    setInput((prev) => ({
      ...prev,
      ratings: {
        ...prev.ratings,
        [score]: Math.max(0, value || 0),
      },
    }));
  }

  const avaliacoesDistribuidas = totalRatings(
    input.ratings
  );

  const indicadoresOk =
    input.wouldReturn + input.wouldNotReturn ===
      avaliacoesDistribuidas &&
    input.resolved + input.notResolved ===
      avaliacoesDistribuidas;

  return (
    <MainLayout>

      <div className="space-y-5">

        <PageHeading
          eyebrow="Reclame Aqui"
          title="Calculadora de reputação"
          description="Simule o efeito de novas reclamações e avaliações sobre a nota — inclusive no período que ainda vai começar."
        />

        <ModuleNav />

        <PeriodPicker
          period={period}
          mode={mode}
          range={range}
          periods={["6m", "12m"]}
          labels={periodLabels}
          onPeriod={setPeriod}
          onMode={setMode}
        />

        <DisregardedNotice cases={doPeriodo} />

        <div className="grid gap-5 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">

          {/* Entrada */}

          <div className="space-y-5">

            <SurfaceCard
              title="Tipo de calculadora"
              description="Comece pelo objetivo ou monte o cenário item a item."
            >

              <div className="flex items-center rounded-xl border border-zinc-200 p-1">

                {(
                  [
                    ["simplificada", "Simplificada"],
                    ["avancada", "Avançada"],
                  ] as [Kind, string][]
                ).map(([id, label]) => (

                  <button
                    key={id}
                    onClick={() => setKind(id)}
                    className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      kind === id
                        ? "bg-violet-700 text-white"
                        : "text-zinc-600 hover:bg-zinc-100"
                    }`}
                  >
                    {label}
                  </button>

                ))}

              </div>

            </SurfaceCard>

            {kind === "simplificada" ? (

              <SurfaceCard
                title="Defina o objetivo"
                description="Selecione a reputação que a empresa quer alcançar."
              >

                <div className="grid grid-cols-2 gap-2">

                  {objetivos.map((band) => (

                      <button
                        key={band.label}
                        onClick={() => setGoal(band.label)}
                        className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ring-1 ring-inset ${
                          goal === band.label
                            ? "bg-violet-50 text-violet-800 ring-violet-300"
                            : "text-zinc-600 ring-zinc-200 hover:bg-zinc-50"
                        }`}
                      >

                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ background: band.color }}
                        />

                        {band.label}

                    </button>

                  ))}

                </div>

              </SurfaceCard>

            ) : (

              <>
                <SurfaceCard
                  title="1. Ponto de partida"
                  description="O cenário começa nos dados reais do período. Com tudo zerado, o resultado é a nota atual."
                >

                  <dl className="grid grid-cols-3 gap-3">

                    {[
                      ["Reclamações", base.received],
                      ["Respondidas", base.answered],
                      ["Avaliadas", base.evaluated],
                    ].map(([label, value]) => (

                      <div
                        key={label}
                        className="rounded-xl bg-zinc-50 px-3 py-2.5"
                      >

                        <dt className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                          {label}
                        </dt>

                        <dd className="mt-0.5 text-lg font-semibold tabular-nums text-zinc-900">
                          {value}
                        </dd>

                      </div>

                    ))}

                  </dl>

                </SurfaceCard>

                <SurfaceCard
                  title="2. Reclamações a mais"
                  description="Distribua entre respondidas e não respondidas."
                >

                      <div className="grid grid-cols-2 gap-3">

                        <div>
                          <label className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                            Respondidas
                          </label>

                          <input
                            type="number"
                            min={0}
                            value={input.addAnswered}
                            onChange={(e) =>
                              setField(
                                "addAnswered",
                                Number(e.target.value)
                              )
                            }
                            className={`${numberField} mt-1.5`}
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                            Não respondidas
                          </label>

                          <input
                            type="number"
                            min={0}
                            value={input.addUnanswered}
                            onChange={(e) =>
                              setField(
                                "addUnanswered",
                                Number(e.target.value)
                              )
                            }
                            className={`${numberField} mt-1.5`}
                          />
                        </div>

                      </div>

                    </SurfaceCard>

                    <SurfaceCard
                      title="3. Notas de avaliação"
                      description="Quantas novas avaliações por nota."
                      action={
                        <span className="shrink-0 rounded-xl bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-600">
                          Total: {avaliacoesDistribuidas}
                        </span>
                      }
                    >

                      <div className="grid grid-cols-4 gap-2">

                        {Array.from({ length: 11 }, (_, i) => i).map(
                          (score) => (

                            <div key={score}>

                              <label className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                                Nota {score}
                              </label>

                              <input
                                type="number"
                                min={0}
                                value={input.ratings[score] ?? 0}
                                onChange={(e) =>
                                  setRating(
                                    score,
                                    Number(e.target.value)
                                  )
                                }
                                className="mt-1 h-10 w-full rounded-lg border border-zinc-200 px-2 text-sm tabular-nums outline-none transition-colors focus:border-violet-400"
                              />

                            </div>

                          )
                        )}

                      </div>

                    </SurfaceCard>

                    <SurfaceCard
                      title="4. Indicadores de reputação"
                      description="Distribua exatamente o total de avaliações informado."
                    >

                      <div className="space-y-4">

                        <div>

                          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                            Voltaria a fazer negócio
                            <Tooltip label="A soma precisa bater com o total de avaliações.">
                              <Info size={11} className="text-zinc-300" />
                            </Tooltip>
                          </p>

                          <div className="grid grid-cols-2 gap-3">

                            <input
                              type="number"
                              min={0}
                              value={input.wouldReturn}
                              onChange={(e) =>
                                setField(
                                  "wouldReturn",
                                  Number(e.target.value)
                                )
                              }
                              placeholder="Voltariam"
                              className={numberField}
                            />

                            <input
                              type="number"
                              min={0}
                              value={input.wouldNotReturn}
                              onChange={(e) =>
                                setField(
                                  "wouldNotReturn",
                                  Number(e.target.value)
                                )
                              }
                              placeholder="Não voltariam"
                              className={numberField}
                            />

                          </div>

                        </div>

                        <div>

                          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                            Índice de solução
                          </p>

                          <div className="grid grid-cols-2 gap-3">

                            <input
                              type="number"
                              min={0}
                              value={input.resolved}
                              onChange={(e) =>
                                setField(
                                  "resolved",
                                  Number(e.target.value)
                                )
                              }
                              placeholder="Resolvidas"
                              className={numberField}
                            />

                            <input
                              type="number"
                              min={0}
                              value={input.notResolved}
                              onChange={(e) =>
                                setField(
                                  "notResolved",
                                  Number(e.target.value)
                                )
                              }
                              placeholder="Não resolvidas"
                              className={numberField}
                            />

                          </div>

                        </div>

                        {avaliacoesDistribuidas > 0 &&
                          !indicadoresOk && (

                            <p className="rounded-xl bg-amber-50 px-3 py-2.5 text-xs text-amber-700 ring-1 ring-inset ring-amber-100">
                              A distribuição precisa somar{" "}
                              {avaliacoesDistribuidas} em cada
                              indicador para o cenário ficar
                              consistente.
                            </p>

                          )}

                      </div>

                    </SurfaceCard>

                <SurfaceCard
                  title="5. Reclamações removidas"
                  description="Moderadas ou excluídas pelo portal — saem da base do período."
                >

                  <input
                    type="number"
                    min={0}
                    max={base.received}
                    value={input.removeComplaints}
                    onChange={(e) =>
                      setField(
                        "removeComplaints",
                        Number(e.target.value)
                      )
                    }
                    className={numberField}
                  />

                  <p className="mt-2 text-xs text-zinc-400">
                    Base do período: {base.received} reclamações.
                  </p>

                </SurfaceCard>

                <button
                  onClick={() => setInput(emptySimulation)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white py-2.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-50"
                >
                  <Eraser size={15} />
                  Limpar dados
                </button>
              </>

            )}

          </div>

          {/* Resultado */}

          <div className="space-y-5">

            <SurfaceCard
              title={
                kind === "simplificada"
                  ? "Reputação simulada"
                  : "Resultado do cenário"
              }
              description="Posição da nota nas faixas públicas do Reclame Aqui."
              action={
                <span className="flex shrink-0 items-center gap-1.5 rounded-xl bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-600">
                  <Calculator size={13} />
                  base de {base.received}
                </span>
              }
            >

              <ScoreScale
                current={current.raScore}
                simulated={
                  kind === "simplificada"
                    ? target.projected
                    : simulated.raScore
                }
              />

              {kind === "avancada" && (

                <div className="mt-6 grid gap-3 sm:grid-cols-3">

                  {[
                    {
                      label: "Nota atual",
                      value: ptBR(current.raScore),
                      tone: "text-zinc-900",
                    },
                    {
                      label: "Nota simulada",
                      value: ptBR(simulated.raScore),
                      tone: "text-violet-700",
                    },
                    {
                      label: "Variação",
                      value: `${delta >= 0 ? "+" : "-"}${ptBR(
                        Math.abs(delta)
                      )}`,
                      tone:
                        delta >= 0
                          ? "text-emerald-600"
                          : "text-rose-600",
                    },
                  ].map((item) => (

                    <div
                      key={item.label}
                      className="rounded-xl bg-zinc-50 px-4 py-3"
                    >

                      <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                        {item.label}
                      </p>

                      <p
                        className={`mt-1 text-2xl font-semibold tabular-nums ${item.tone}`}
                      >
                        {item.value}
                      </p>

                    </div>

                  ))}

                </div>

              )}

            </SurfaceCard>

            {kind === "simplificada" && (

              <SurfaceCard
                title="Avaliações necessárias"
                description={`Quantas avaliações positivas faltam para alcançar "${goal}".`}
              >

                {target.needed === 0 ? (

                  <p className="rounded-xl bg-emerald-50 px-4 py-4 text-sm font-medium text-emerald-800 ring-1 ring-inset ring-emerald-100">
                    A nota do período já está em{" "}
                    {ptBR(current.raScore)} — objetivo alcançado.
                  </p>

                ) : (

                  <>
                    <div className="flex items-center gap-4 rounded-xl bg-violet-50/60 p-5 ring-1 ring-inset ring-violet-100">

                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-violet-700 ring-1 ring-inset ring-violet-100">
                        <Target size={22} />
                      </span>

                      <div>

                        <p className="text-3xl font-semibold tabular-nums text-zinc-900">
                          {target.reachable
                            ? target.needed
                            : `${target.needed}+`}
                        </p>

                        <p className="text-sm text-zinc-600">
                          avaliações nota 10, resolvidas e
                          favoráveis
                        </p>

                      </div>

                    </div>

                    {!target.reachable && (
                      <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2.5 text-xs text-amber-700 ring-1 ring-inset ring-amber-100">
                        A meta não é alcançável apenas com
                        avaliações neste período — é preciso
                        elevar o índice de resposta também.
                      </p>
                    )}
                  </>

                )}

              </SurfaceCard>

            )}

            <SurfaceCard
              title="Detalhamento"
              description="O que muda em cada indicador no cenário simulado."
            >

              <div className="space-y-3">

                {simulated.breakdown.map((item) => {

                  const antes =
                    current.breakdown.find(
                      (b) => b.key === item.key
                    )?.value ?? 0;

                  const diff =
                    Math.round((item.value - antes) * 10) / 10;

                  return (
                    <div
                      key={item.key}
                      className="flex items-center justify-between gap-3 rounded-xl border border-zinc-100 px-4 py-3"
                    >

                      <span className="min-w-0 text-sm font-medium text-zinc-700">
                        {item.label}
                      </span>

                      <span className="flex shrink-0 items-center gap-3">

                        <span className="text-sm tabular-nums text-zinc-500">
                          {item.base === 0
                            ? "—"
                            : item.unit === "%"
                            ? `${ptBR(item.value)}%`
                            : ptBR(item.value, 2)}
                        </span>

                        {Math.abs(diff) > 0.05 && (
                          <span
                            className={`flex items-center gap-0.5 text-xs font-semibold tabular-nums ${
                              diff > 0
                                ? "text-emerald-600"
                                : "text-rose-600"
                            }`}
                          >
                            {diff > 0 ? (
                              <ArrowUp size={11} />
                            ) : (
                              <ArrowDown size={11} />
                            )}
                            {ptBR(Math.abs(diff))}
                          </span>
                        )}

                      </span>

                    </div>
                  );
                })}

              </div>

              <p className="mt-4 flex items-start gap-2 border-t border-zinc-100 pt-3.5 text-xs leading-relaxed text-zinc-400">
                <Info size={13} className="mt-0.5 shrink-0" />
                Indicador sem base no período fica de fora do
                cálculo e tem o peso redistribuído.
              </p>

            </SurfaceCard>

          </div>

        </div>

      </div>

    </MainLayout>
  );
}
