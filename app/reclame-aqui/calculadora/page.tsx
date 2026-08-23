"use client";

import { useMemo, useState } from "react";

import {
  ArrowDown,
  ArrowUp,
  Calculator,
  Eraser,
  Info,
  Plus,
  Target,
  Trash2,
} from "lucide-react";

import MainLayout from "@/components/layout/MainLayout";

import PageHeading from "@/components/shared/PageHeading";
import SurfaceCard from "@/components/shared/SurfaceCard";

import ModuleNav from "@/components/reclame-aqui/ModuleNav";
import DisregardedNotice from "@/components/reclame-aqui/DisregardedNotice";
import PeriodPicker from "@/components/reclame-aqui/calculadora/PeriodPicker";
import ScoreScale from "@/components/reclame-aqui/calculadora/ScoreScale";

import { useScopedCases } from "@/lib/context/useScopedCases";

import {
  emptyRemoval,
  emptySimulation,
  evaluationsToReach,
  getRange,
  getRawCounts,
  inRange,
  PeriodKey,
  PeriodMode,
  pendingAnswers,
  pendingEvaluations,
  PROMOTER_SCORE,
  ptBR,
  RA1000_BAND,
  RemovedComplaint,
  resolveIndicators,
  ScoreComponent,
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

/**
 * O modo avançado é uma frente de cada vez, não um formulário longo com
 * tudo junto — o Isaac pediu para o foco voltar a "adicionar avaliações".
 */
type AdvancedMode = "avaliacoes" | "reclamacoes" | "remocao";

const numberField =
  "h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm tabular-nums outline-none transition-colors focus:border-violet-400";

export default function CalculadoraPage() {

  const { cases } = useScopedCases("reclame-aqui");

  const [period, setPeriod] = useState<PeriodKey>("6m");
  const [mode, setMode] = useState<PeriodMode>("vigente");

  const [kind, setKind] = useState<Kind>("simplificada");

  const [advMode, setAdvMode] =
    useState<AdvancedMode>("avaliacoes");

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
   * Quantas reclamações do período ainda podem ser avaliadas.
   *
   * Precisa aparecer na tela: o cálculo passou a respeitar esse teto, e
   * um campo que trava sem dizer por quê é pior do que um campo que
   * aceita bobagem. Com o número à vista, "digitei 200 e a nota parou"
   * vira "só existem 51 para avaliar".
   */
  const tetoDeAvaliacoes = useMemo(
    () => pendingEvaluations(base),
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

  function formatComponent(
    item?: ScoreComponent
  ) {
    if (!item || item.base === 0) return "—";
    return item.unit === "%"
      ? `${ptBR(item.value)}%`
      : ptBR(item.value, 2);
  }

  function setField(
    field:
      | "answerPending"
      | "addAnswered"
      | "addUnanswered"
      | "removeComplaints",
    value: number
  ) {
    setInput((prev) => ({
      ...prev,
      [field]: Math.max(0, value || 0),
    }));
  }

  function addRemoval() {
    setInput((prev) => ({
      ...prev,
      removed: [
        ...prev.removed,
        emptyRemoval(crypto.randomUUID()),
      ],
    }));
  }

  function removeRemoval(id: string) {
    setInput((prev) => ({
      ...prev,
      removed: prev.removed.filter(
        (item) => item.id !== id
      ),
    }));
  }

  function patchRemoval(
    id: string,
    patch: Partial<RemovedComplaint>
  ) {
    setInput((prev) => ({
      ...prev,
      removed: prev.removed.map((item) =>
        item.id === id ? { ...item, ...patch } : item
      ),
    }));
  }

  /** `null` devolve o campo ao palpite pelas notas. */
  function setIndicator(
    field: "resolved" | "wouldReturn",
    value: number | null
  ) {
    setInput((prev) => ({
      ...prev,
      [field]:
        value === null ? null : Math.max(0, value || 0),
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

  const indicadores = resolveIndicators(input);

  const pendentes = pendingAnswers(base);

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

                  <dl className="grid grid-cols-4 gap-2.5">

                    {[
                      ["Reclamações", base.received, false],
                      ["Respondidas", base.answered, false],
                      ["Sem resposta", pendentes, pendentes > 0],
                      ["Avaliadas", base.evaluated, false],
                    ].map(([label, value, alerta]) => (

                      <div
                        key={String(label)}
                        className={`rounded-xl px-3 py-2.5 ${alerta ? "bg-amber-50 ring-1 ring-inset ring-amber-100" : "bg-zinc-50"}`}
                      >

                        <dt className={`text-[10px] font-semibold uppercase tracking-wide ${alerta ? "text-amber-600" : "text-zinc-400"}`}>
                          {label}
                        </dt>

                        <dd className={`mt-0.5 text-lg font-semibold tabular-nums ${alerta ? "text-amber-700" : "text-zinc-900"}`}>
                          {value}
                        </dd>

                      </div>

                    ))}

                  </dl>

                </SurfaceCard>

                <SurfaceCard
                  title="2. O que simular"
                  description="Uma frente por vez — cada uma soma sobre o ponto de partida."
                >

                  <div className="flex items-center rounded-xl border border-zinc-200 p-1">

                    {(
                      [
                        ["avaliacoes", "Avaliações"],
                        ["reclamacoes", "Reclamações"],
                        ["remocao", "Remoção"],
                      ] as [AdvancedMode, string][]
                    ).map(([id, label]) => (

                      <button
                        key={id}
                        onClick={() => setAdvMode(id)}
                        className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                          advMode === id
                            ? "bg-violet-700 text-white"
                            : "text-zinc-600 hover:bg-zinc-100"
                        }`}
                      >
                        {label}
                      </button>

                    ))}

                  </div>

                </SurfaceCard>

                {advMode === "avaliacoes" && (

                  <SurfaceCard
                    title="3. Notas de avaliação"
                    description="Quantas novas avaliações por nota. Nota 7 ou mais conta como resolvida e favorável — mesmo critério de promotor."
                    action={
                      <span
                        className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-medium ${
                          avaliacoesDistribuidas >
                          tetoDeAvaliacoes
                            ? "bg-amber-50 text-amber-700"
                            : "bg-zinc-50 text-zinc-600"
                        }`}
                      >
                        Total: {avaliacoesDistribuidas} de{" "}
                        {tetoDeAvaliacoes}
                      </span>
                    }
                  >

                  {/*
                    O teto é regra do Reclame Aqui, não limite nosso:
                    quem avalia é o consumidor que abriu a reclamação,
                    então não há avaliação sem caso para avaliar.
                  */}
                  <p className="mb-4 text-xs text-zinc-500">
                    {tetoDeAvaliacoes === 0 ? (
                      <>
                        Todas as {base.received} reclamações
                        do período já foram avaliadas — só
                        reclamações novas trazem avaliações
                        novas.
                      </>
                    ) : (
                      <>
                        <strong className="font-semibold text-zinc-700">
                          {tetoDeAvaliacoes}
                        </strong>{" "}
                        reclamações do período ainda estão
                        sem avaliação. Acima disso o cenário
                        não sobe, porque cada avaliação
                        pertence a uma reclamação.
                      </>
                    )}
                  </p>

                  {avaliacoesDistribuidas >
                    tetoDeAvaliacoes && (
                    <p className="mb-4 rounded-xl bg-amber-50 px-3 py-2.5 text-xs text-amber-700 ring-1 ring-inset ring-amber-100">
                      As{" "}
                      {avaliacoesDistribuidas -
                        tetoDeAvaliacoes}{" "}
                      avaliações acima do teto estão sendo
                      ignoradas no resultado. Para simular
                      mais, adicione reclamações novas na
                      etapa 2.
                    </p>
                  )}

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
                              className={`mt-1 h-10 w-full rounded-lg border px-2 text-sm tabular-nums outline-none transition-colors focus:border-violet-400 ${score >= 7 ? "border-emerald-200" : "border-zinc-200"}`}
                            />

                          </div>

                        )
                      )}

                    </div>

                    {avaliacoesDistribuidas > 0 && (

                      <div className="mt-5 space-y-4 border-t border-zinc-100 pt-4">

                        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                          Destas {avaliacoesDistribuidas} avaliações
                        </p>

                        {(
                          [
                            ["resolved", "Índice de solução", "resolvidas"],
                            ["wouldReturn", "Voltaria a fazer negócio", "voltariam"],
                          ] as [
                            "resolved" | "wouldReturn",
                            string,
                            string
                          ][]
                        ).map(([field, label, sufixo]) => {

                          const valor = indicadores[field];

                          const automatico = input[field] === null;

                          return (
                            <div key={field}>

                              <div className="flex items-center justify-between gap-2">

                                <label className="text-xs font-medium text-zinc-600">
                                  {label}
                                </label>

                                {!automatico && (
                                  <button
                                    onClick={() => setIndicator(field, null)}
                                    className="text-[11px] font-medium text-violet-600 hover:underline"
                                  >
                                    Usar as notas
                                  </button>
                                )}

                              </div>

                              <div className="mt-1.5 flex items-center gap-2.5">

                                <input
                                  type="number"
                                  min={0}
                                  max={avaliacoesDistribuidas}
                                  value={valor}
                                  onChange={(e) =>
                                    setIndicator(
                                      field,
                                      Number(e.target.value)
                                    )
                                  }
                                  className={`${numberField} max-w-[110px]`}
                                />

                                <span className="text-xs text-zinc-500">
                                  {sufixo} · {avaliacoesDistribuidas - valor} não
                                </span>

                                {automatico && (
                                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                                    pelas notas
                                  </span>
                                )}

                              </div>

                            </div>
                          );
                        })}

                        <p className="flex items-start gap-2 text-xs leading-relaxed text-zinc-400">
                          <Info size={13} className="mt-0.5 shrink-0" />
                          Sem mexer, nota {PROMOTER_SCORE} ou mais entra como resolvida e favorável. Editar um dos campos fixa o valor.
                        </p>

                      </div>

                    )}

                  </SurfaceCard>

                )}

                {advMode === "reclamacoes" && (

                  <>
                    <SurfaceCard
                      title="3. Responder as pendentes"
                      description="Reclamações que já estão na base sem resposta pública. Responder todas leva o índice de resposta a 100%."
                    >

                      {pendentes === 0 ? (

                        <p className="rounded-xl bg-emerald-50 px-4 py-3.5 text-sm font-medium text-emerald-800 ring-1 ring-inset ring-emerald-100">
                          Nenhuma reclamação sem resposta neste período.
                        </p>

                      ) : (

                        <>
                          <div className="flex items-center gap-3">

                            <input
                              type="number"
                              min={0}
                              max={pendentes}
                              value={input.answerPending}
                              onChange={(e) =>
                                setField(
                                  "answerPending",
                                  Math.min(
                                    Math.max(
                                      Number(
                                        e.target.value
                                      ) || 0,
                                      0
                                    ),
                                    pendentes
                                  )
                                )
                              }
                              className={`${numberField} max-w-[120px]`}
                            />

                            <button
                              onClick={() =>
                                setField(
                                  "answerPending",
                                  pendentes
                                )
                              }
                              className="rounded-xl border border-violet-200 px-3.5 py-2 text-sm font-medium text-violet-700 transition-colors hover:bg-violet-50"
                            >
                              Responder todas ({pendentes})
                            </button>

                          </div>

                          <p className="mt-2.5 text-xs text-zinc-500">
                            {pendentes} sem resposta hoje · índice atual {ptBR(current.responseIndex)}% → simulado {ptBR(simulated.responseIndex)}%
                          </p>
                        </>

                      )}

                    </SurfaceCard>

                    <SurfaceCard
                      title="4. Reclamações novas"
                      description="Reclamações que ainda vão chegar. Entram somando na base."
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
                                Math.max(
                                  Number(e.target.value) ||
                                    0,
                                  0
                                )
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
                                Math.max(
                                  Number(e.target.value) ||
                                    0,
                                  0
                                )
                              )
                            }
                            className={`${numberField} mt-1.5`}
                          />
                        </div>

                      </div>

                    </SurfaceCard>
                  </>

                )}

                {advMode === "remocao" && (

                  <SurfaceCard
                    title="3. Reclamações removidas"
                    description="Moderadas ou excluídas pelo portal. Descreva cada uma — a remoção leva embora a resposta, a avaliação e a nota junto."
                    action={
                      <button
                        onClick={addRemoval}
                        className="flex shrink-0 items-center gap-2 rounded-xl border border-violet-200 px-3.5 py-2 text-sm font-medium text-violet-700 transition-colors hover:bg-violet-50"
                      >
                        <Plus size={15} />
                        Adicionar
                      </button>
                    }
                  >

                    {input.removed.length === 0 ? (

                      <p className="py-6 text-center text-sm text-zinc-400">
                        Nenhuma remoção no cenário. Base do período: {base.received} reclamações.
                      </p>

                    ) : (

                      <div className="space-y-3">

                        {input.removed.map((item, index) => (

                          <div
                            key={item.id}
                            className="rounded-xl border border-zinc-200 p-3.5"
                          >

                            <div className="flex items-center justify-between gap-2">

                              <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                                Reclamação {index + 1}
                              </span>

                              <button
                                onClick={() => removeRemoval(item.id)}
                                aria-label="Tirar do cenário"
                                className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                              >
                                <Trash2 size={15} />
                              </button>

                            </div>

                            <div className="mt-3 space-y-2.5">

                              <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-700">
                                <input
                                  type="checkbox"
                                  checked={item.answered}
                                  onChange={(e) =>
                                    patchRemoval(item.id, {
                                      answered: e.target.checked,
                                    })
                                  }
                                  className="h-4 w-4 accent-violet-600"
                                />
                                Estava respondida
                              </label>

                              <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-700">
                                <input
                                  type="checkbox"
                                  checked={item.evaluated}
                                  onChange={(e) =>
                                    patchRemoval(item.id, {
                                      evaluated: e.target.checked,
                                    })
                                  }
                                  className="h-4 w-4 accent-violet-600"
                                />
                                Tinha avaliação do consumidor
                              </label>

                              {item.evaluated && (

                                <div className="space-y-2.5 border-l-2 border-zinc-100 pl-3.5">

                                  <div className="flex items-center gap-2.5">

                                    <label className="text-sm text-zinc-600">
                                      Nota
                                    </label>

                                    <select
                                      value={item.score}
                                      onChange={(e) =>
                                        patchRemoval(item.id, {
                                          score: Number(e.target.value),
                                        })
                                      }
                                      className="h-10 rounded-xl border border-zinc-200 px-3 text-sm tabular-nums outline-none transition-colors focus:border-violet-400"
                                    >
                                      {Array.from({ length: 11 }, (_, i) => i).map((n) => (
                                        <option key={n} value={n}>
                                          {n}
                                        </option>
                                      ))}
                                    </select>

                                  </div>

                                  <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-700">
                                    <input
                                      type="checkbox"
                                      checked={item.resolved}
                                      onChange={(e) =>
                                        patchRemoval(item.id, {
                                          resolved: e.target.checked,
                                        })
                                      }
                                      className="h-4 w-4 accent-violet-600"
                                    />
                                    Contava como resolvida
                                  </label>

                                  <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-700">
                                    <input
                                      type="checkbox"
                                      checked={item.wouldReturn}
                                      onChange={(e) =>
                                        patchRemoval(item.id, {
                                          wouldReturn: e.target.checked,
                                        })
                                      }
                                      className="h-4 w-4 accent-violet-600"
                                    />
                                    Voltaria a fazer negócio
                                  </label>

                                </div>

                              )}

                            </div>

                          </div>

                        ))}

                        <p className="text-xs text-zinc-400">
                          {input.removed.length} de {base.received} reclamações do período.
                        </p>

                      </div>

                    )}

                  </SurfaceCard>

                )}

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
                        {target.reason ===
                        "sem-avaliacoes" ? (
                          <>
                            Mesmo avaliando nota 10 as{" "}
                            {target.ceiling} reclamações que
                            ainda não têm avaliação, a nota
                            chega a{" "}
                            {ptBR(target.projected, 1)} — não
                            à meta. O caminho é o índice de
                            resposta e a moderação das notas
                            baixas.
                          </>
                        ) : (
                          <>
                            A meta não é alcançável apenas com
                            avaliações neste período — é
                            preciso elevar o índice de
                            resposta também.
                          </>
                        )}
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

                  const antes = current.breakdown.find(
                    (b) => b.key === item.key
                  );

                  const diff = antes
                    ? Math.round(
                        (item.value - antes.value) * 10
                      ) / 10
                    : 0;

                  return (
                    <div
                      key={item.key}
                      className="flex items-center justify-between gap-3 rounded-xl border border-zinc-100 px-4 py-3"
                    >

                      <span className="min-w-0 text-sm font-medium text-zinc-700">
                        {item.label}
                      </span>

                      <span className="flex shrink-0 items-center gap-2.5">

                        <span className="text-sm tabular-nums text-zinc-400">
                          {formatComponent(antes)}
                        </span>

                        <span className="text-xs text-zinc-300">
                          →
                        </span>

                        <span className="text-sm font-semibold tabular-nums text-zinc-800">
                          {formatComponent(item)}
                        </span>

                        {diff !== 0 && (
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
