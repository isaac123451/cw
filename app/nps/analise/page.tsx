"use client";

import Link from "next/link";

import { useMemo, useState } from "react";

import {
  ArrowLeft,
  CircleAlert,
  Gauge,
  HeartHandshake,
  MessageSquareText,
  Timer,
} from "lucide-react";

import MainLayout from "@/components/layout/MainLayout";

import PageHeading from "@/components/shared/PageHeading";
import StatTile from "@/components/shared/StatTile";
import SurfaceCard from "@/components/shared/SurfaceCard";
import BarList from "@/components/shared/BarList";

import NpsTrendChart from "@/components/nps/NpsTrendChart";

import { useNps } from "@/lib/context/NpsContext";

import { ptBR } from "@/lib/services/reputation.service";

import {
  isEncerrado,
  NpsSegment,
  SEGMENTS,
  segmentOf,
} from "@/lib/models/nps";

import {
  byKind,
  byMood,
  byRootCause,
  bySegment,
  recuperacao,
  slaState,
  summarize,
  trendByMonth,
} from "@/lib/services/nps.service";

/** Janelas que a tela oferece, em meses. */
const JANELAS = [
  { meses: 3, label: "3 meses" },
  { meses: 6, label: "6 meses" },
  { meses: 12, label: "12 meses" },
  { meses: 0, label: "Tudo" },
];

/**
 * A análise do NPS.
 *
 * A tela do `/nps` responde "o que fazer agora" — é fila de trabalho.
 * Esta responde outra pergunta, a da reunião: **está melhorando?** E, se
 * não está, por causa de quê.
 *
 * Três leituras, nesta ordem, porque é a ordem em que a conversa
 * acontece:
 *
 * 1. **A tendência.** A nota de um mês sozinha não diz nada; a série
 *    diz. E o volume vai junto, porque um NPS que sobe com um terço das
 *    respostas do mês anterior não subiu — mudou de amostra.
 * 2. **A causa raiz.** É o que transforma "estamos com 42" em uma
 *    decisão: onde investir para parar de perder cliente.
 * 3. **A régua de humor.** O único indicador que mede se o atendimento
 *    moveu a agulha — a nota do NPS é de antes e não se reescreve.
 *
 * **A conta é a mesma da outra tela.** `summarize`, `bySegment` e
 * `byRootCause` são as funções que o `/nps` já usa; recalcular aqui por
 * fora seria a segunda conta em paralelo, que é como duas telas passam a
 * mostrar números diferentes do mesmo mês.
 */
export default function NpsAnalisePage() {

  const { responses, loading } = useNps();

  const [meses, setMeses] = useState(12);

  const [segmento, setSegmento] = useState<
    NpsSegment | ""
  >("");

  /**
   * O recorte da janela, aplicado uma vez.
   *
   * Todos os números da tela saem daqui — inclusive a tendência. Uma
   * tendência de 12 meses ao lado de indicadores de 3 seria a forma
   * mais fácil de alguém ler o gráfico e concluir a coisa errada.
   */
  const noPeriodo = useMemo(() => {

    const base =
      meses === 0
        ? responses
        : responses.filter((item) => {

            const limite = new Date();

            limite.setMonth(limite.getMonth() - meses);

            return (
              Date.parse(item.respondedAt) >=
              limite.getTime()
            );
          });

    return segmento
      ? base.filter(
          (item) =>
            segmentOf(item.score).label === segmento
        )
      : base;

  }, [responses, meses, segmento]);

  const resumo = useMemo(
    () => summarize(noPeriodo),
    [noPeriodo]
  );

  const tendencia = useMemo(
    () => trendByMonth(noPeriodo, meses === 0 ? 24 : meses),
    [noPeriodo, meses]
  );

  const segmentos = useMemo(
    () => bySegment(noPeriodo),
    [noPeriodo]
  );

  const causas = useMemo(
    () => byRootCause(noPeriodo),
    [noPeriodo]
  );

  const tipos = useMemo(
    () => byKind(noPeriodo),
    [noPeriodo]
  );

  const humores = useMemo(
    () => byMood(noPeriodo),
    [noPeriodo]
  );

  const recuperados = useMemo(
    () => recuperacao(noPeriodo),
    [noPeriodo]
  );

  /**
   * Quantas trouxeram texto.
   *
   * É o número que decide se a análise de causa raiz vale alguma coisa:
   * a pesquisa vem com a maioria das respostas sem uma palavra escrita,
   * e é no comentário que a causa mora.
   */
  const comComentario = noPeriodo.filter(
    (item) => item.comment.trim() !== ""
  ).length;

  /** A variação contra o mês anterior — a leitura da reunião. */
  const variacao =
    tendencia.length >= 2
      ? tendencia[tendencia.length - 1].score -
        tendencia[tendencia.length - 2].score
      : null;

  const semCausa = noPeriodo.filter(
    (item) =>
      item.comment.trim() !== "" && !item.rootCause
  ).length;

  return (
    <MainLayout>

      <div className="space-y-6">

        <PageHeading
          eyebrow="Inteligência"
          title="Análise do NPS"
          description="A tela do NPS responde o que fazer agora. Esta responde se está melhorando — e por causa de quê."
        >
          <div className="flex flex-wrap items-center gap-2">

            <div className="flex items-center gap-0.5 rounded-lg bg-zinc-100 p-0.5">
              {JANELAS.map((j) => (
                <button
                  key={j.meses}
                  onClick={() => setMeses(j.meses)}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${meses === j.meses ? "bg-white text-violet-700 shadow-sm" : "text-zinc-600 hover:text-zinc-800"}`}
                >
                  {j.label}
                </button>
              ))}
            </div>

            <Link
              href="/nps"
              className="flex items-center gap-2 rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:border-violet-300 hover:text-violet-700"
            >
              <ArrowLeft size={15} />
              Voltar ao quadro
            </Link>

          </div>
        </PageHeading>

        {loading ? (

          <p className="py-16 text-center text-sm text-zinc-400">
            Carregando...
          </p>

        ) : (

          <>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

              <StatTile
                label="NPS do período"
                description="Percentual de promotores menos o de detratores, sobre o recorte escolhido."
                value={resumo.score}
                hint={
                  variacao === null
                    ? `${resumo.total} resposta(s)`
                    : `${variacao > 0 ? "+" : ""}${variacao} contra o mês anterior`
                }
                icon={Gauge}
                tone="primary"
                trend={
                  variacao === null || variacao === 0
                    ? undefined
                    : {
                        value: `${variacao > 0 ? "+" : ""}${variacao}`,
                        positive: variacao > 0,
                      }
                }
              />

              <StatTile
                label="Com comentário"
                description="Só quem escreveu alguma coisa sustenta análise de causa raiz. O resto é nota."
                value={comComentario}
                hint={
                  resumo.total === 0
                    ? "sem respostas no período"
                    : `${Math.round((comComentario / resumo.total) * 100)}% das respostas`
                }
                icon={MessageSquareText}
                tone="info"
              />

              <StatTile
                label="Recuperação"
                description="Quem saiu do contato satisfeito ou encantado, entre os que tiveram pós-contato registrado. É o único número que diz se o atendimento moveu a agulha."
                value={`${recuperados.percent}%`}
                hint={`${recuperados.recuperados} de ${recuperados.comRegistro} com registro`}
                icon={HeartHandshake}
                tone="success"
              />

              <StatTile
                label="Fora do prazo"
                description="Sem primeiro contato dentro do SLA do segmento."
                value={
                  noPeriodo.filter(
                    (item) =>
                      slaState(item) === "estourado"
                  ).length
                }
                hint={`${noPeriodo.filter((i) => !isEncerrado(i.status)).length} em aberto`}
                icon={Timer}
                tone="warning"
              />

            </div>

            <SurfaceCard
              title="Tendência"
              description="A nota de um mês sozinha não diz nada; a série diz."
              hint="A escala é fixa de −100 a 100 de propósito: uma escala apertada ao redor dos valores faz três pontos de variação parecerem um despencar."
              action={
                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                  {SEGMENTS.map((s) => {

                    const ativo = segmento === s.label;

                    return (
                      <button
                        key={s.label}
                        onClick={() =>
                          setSegmento(
                            ativo ? "" : s.label
                          )
                        }
                        title={s.hint}
                        style={
                          ativo
                            ? {
                                color: s.color,
                                borderColor: s.color,
                                background: `${s.color}14`,
                              }
                            : undefined
                        }
                        className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${ativo ? "font-semibold" : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"}`}
                      >
                        <span
                          className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle"
                          style={{ background: s.color }}
                        />
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              }
            >

              <NpsTrendChart dados={tendencia} />

              {/*
                O volume ao lado da nota.

                Um NPS que sobe com um terço das respostas do mês
                anterior não subiu — mudou de amostra. Sem esta linha o
                gráfico convida exatamente a essa leitura.
              */}
              <div className="mt-4 overflow-x-auto">

                <table className="min-w-full text-sm">

                  <thead>
                    <tr className="border-b border-zinc-100">
                      {[
                        "Mês",
                        "NPS",
                        "Média",
                        "Respostas",
                        "Com comentário",
                        "Detratores",
                      ].map((h) => (
                        <th
                          key={h}
                          className="whitespace-nowrap px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-zinc-50">
                    {[...tendencia]
                      .reverse()
                      .map((ponto) => (
                        <tr key={ponto.chave}>
                          <td className="whitespace-nowrap px-3 py-2 font-medium text-zinc-700">
                            {ponto.rotulo}
                          </td>
                          <td className="px-3 py-2 font-semibold tabular-nums text-zinc-900">
                            {ponto.score}
                          </td>
                          <td className="px-3 py-2 tabular-nums text-zinc-600">
                            {String(ponto.media).replace(
                              ".",
                              ","
                            )}
                          </td>
                          <td className="px-3 py-2 tabular-nums text-zinc-600">
                            {ponto.total}
                          </td>
                          <td className="px-3 py-2 tabular-nums text-zinc-600">
                            {ponto.comentarios}
                          </td>
                          <td className="px-3 py-2 tabular-nums text-rose-600">
                            {ponto.detratores}
                          </td>
                        </tr>
                      ))}
                  </tbody>

                </table>

                {tendencia.length === 0 && (
                  <p className="py-6 text-center text-sm text-zinc-400">
                    Nenhuma resposta neste recorte.
                  </p>
                )}

              </div>

            </SurfaceCard>

            <div className="grid gap-4 lg:grid-cols-2">

              <SurfaceCard
                title="Causa raiz"
                description="Onde investir para parar de perder cliente."
                hint="Só conta quem foi classificado. Comentário sem causa marcada não entra em lugar nenhum — é por isso que o aviso abaixo existe."
              >

                <BarList data={causas} limit={8} />

                {semCausa > 0 && (
                  <p className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs text-amber-800 ring-1 ring-inset ring-amber-100">
                    <CircleAlert
                      size={14}
                      className="mt-0.5 shrink-0"
                    />
                    <span>
                      <strong className="font-semibold">
                        {semCausa} resposta(s) com
                        comentário e sem causa raiz.
                      </strong>{" "}
                      Elas não aparecem neste gráfico — e
                      são justamente as que teriam algo a
                      dizer.{" "}
                      <Link
                        href="/nps"
                        className="font-medium underline underline-offset-2"
                      >
                        Classificar no quadro
                      </Link>
                      .
                    </span>
                  </p>
                )}

              </SurfaceCard>

              <SurfaceCard
                title="Tipo de tratativa"
                description="O que mais chega — e quanto ainda está sem classificar."
              >
                <BarList
                  data={tipos}
                  limit={8}
                  color="#0EA5E9"
                />
              </SurfaceCard>

            </div>

            <div className="grid gap-4 lg:grid-cols-2">

              <SurfaceCard
                title="Distribuição por segmento"
                description="Como as respostas se dividem entre as três faixas."
              >
                <div className="space-y-2.5">
                  {segmentos.map((s) => (
                    <div key={s.label}>

                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="font-medium text-zinc-700">
                          {s.label}
                        </span>
                        <span className="tabular-nums text-zinc-500">
                          {s.value} · {ptBR(s.percent)}%
                        </span>
                      </div>

                      <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${s.percent}%`,
                            background: s.color,
                          }}
                        />
                      </div>

                    </div>
                  ))}
                </div>
              </SurfaceCard>

              <SurfaceCard
                title="Régua de humor"
                description="Como o cliente ficou depois do contato."
                hint="A nota do NPS é de antes e não pode ser reescrita — é ela que compõe o indicador. A régua mede outra coisa: se a operação conseguiu fazer alguma coisa a respeito."
              >

                {recuperados.comRegistro === 0 ? (

                  <p className="py-6 text-center text-sm text-zinc-400">
                    Nenhum pós-contato registrado neste
                    recorte.
                  </p>

                ) : (

                  <div className="space-y-2.5">
                    {humores.map((h) => (
                      <div key={h.label}>

                        <div className="mb-1 flex items-center justify-between text-xs">
                          <span className="font-medium text-zinc-700">
                            {h.label}
                          </span>
                          <span className="tabular-nums text-zinc-500">
                            {h.value} · {ptBR(h.percent)}%
                          </span>
                        </div>

                        <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${h.percent}%`,
                              background: h.color,
                            }}
                          />
                        </div>

                      </div>
                    ))}

                    <p className="pt-1 text-xs text-zinc-500">
                      Sobre {recuperados.comRegistro}{" "}
                      resposta(s) com pós-contato
                      registrado — e não sobre a base
                      inteira: dividir por todas
                      transformaria um indicador de
                      recuperação num de cobertura.
                    </p>

                  </div>

                )}

              </SurfaceCard>

            </div>

          </>

        )}

      </div>

    </MainLayout>
  );
}
