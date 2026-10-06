"use client";

import { useEffect, useMemo, useState } from "react";

import { Award, CheckCircle2, CircleAlert, Globe } from "lucide-react";

import MainLayout from "@/components/layout/MainLayout";
import PageHeading from "@/components/shared/PageHeading";
import SurfaceCard from "@/components/shared/SurfaceCard";
import ModuleNav from "@/components/reclame-aqui/ModuleNav";
import EvolucaoDoIndice from "@/components/reclame-aqui/indice/EvolucaoDoIndice";
import ReguaDoIndice from "@/components/reclame-aqui/indice/ReguaDoIndice";

import { lerPainelDoPortal } from "@/lib/actions/painelDoPortal";
import { useScopedCases } from "@/lib/context/useScopedCases";
import { respondida } from "@/lib/models/case";
import { notaExata, retratoDoIndice, type PeriodoDoIndice, type RetratoDoIndice } from "@/lib/models/indiceRA";
import { bandOf, displayBand, hojeNaOperacao, inRange, ptBR, RA1000_BAND, RA1000_MINIMO_DE_AVALIACOES, RA1000_TARGETS } from "@/lib/services/reputation.service";
import type { PainelDoPortal } from "@/lib/services/painelDoPortal.service";
import { SELO_DO_PORTAL } from "@/lib/models/segmento";
import ComparacaoComSegmento from "@/components/reclame-aqui/indice/ComparacaoComSegmento";
import { pluralDe } from "@/lib/plural";

const br = (iso: string) => iso.split("-").reverse().join("/");

/**
 * O índice do Reclame Aqui (Fase 32, 1.75; refeito na 1.86).
 *
 * Três notas lado a lado — **no portal** (o painel oficial, lido pelo
 * vigia), **hoje** (a mesma janela, com o que já foi feito) e a
 * **prévia** (a janela da virada do mês) — e uma tabela única com os
 * indicadores das três contra a meta do selo. O portal não recalcula
 * todo dia: em 29/09 ele mostrava 8,8 com 9 sem resposta, e a conta com
 * as respostas já publicadas dava 8,86. As duas estão certas; a tela diz
 * qual é qual.
 */
export default function IndicePage() {

  const { cases } = useScopedCases("reclame-aqui");
  const [periodo, setPeriodo] = useState<PeriodoDoIndice>("6m");
  const [paineis, setPaineis] = useState<Record<string, PainelDoPortal>>({});

  useEffect(() => {
    let vivo = true;
    lerPainelDoPortal().then((r) => {
      if (vivo && r.ok) setPaineis(r.atuais);
    });
    return () => {
      vivo = false;
    };
  }, []);

  const hoje = hojeNaOperacao();
  const atual = useMemo(() => retratoDoIndice(cases, periodo, "vigente"), [cases, periodo]);
  const previa = useMemo(() => retratoDoIndice(cases, periodo, "proximo"), [cases, periodo]);

  /* A avaliação desconsiderada conta em "avaliadas" no portal, mas fica fora da nota. */
  const desconsideradas = useMemo(
    () => cases.filter((c) => inRange(c, atual.inicio, atual.fim) && c.evaluated && c.scoreDisregarded).length,
    [cases, atual.inicio, atual.fim]
  );
  const desconsideradasPrevia = useMemo(
    () => cases.filter((c) => inRange(c, previa.inicio, previa.fim) && c.evaluated && c.scoreDisregarded).length,
    [cases, previa.inicio, previa.fim]
  );

  const painel = paineis[periodo === "6m" ? "SIX_MONTHS" : "TWELVE_MONTHS"];
  /* Só compara se o painel é da mesma janela que a conta daqui. */
  const painelDaJanela = painel && painel.fim === atual.fim ? painel : undefined;

  const semRespostaAgora = useMemo(
    () => cases.filter((c) => inRange(c, atual.inicio, atual.fim) && !respondida(c)).length,
    [cases, atual.inicio, atual.fim]
  );

  return (
    <MainLayout>
      <div className="space-y-5">

        <PageHeading
          eyebrow="Reclame Aqui"
          title="Índice"
          description="A nota que o portal mostra, a mesma conta com o que já foi feito, e a que vem na virada do mês."
        />

        <ModuleNav />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-xl bg-zinc-100 p-1" role="tablist" aria-label="Período">
            {(["6m", "12m"] as const).map((p) => (
              <button
                key={p}
                type="button"
                role="tab"
                aria-selected={periodo === p}
                onClick={() => setPeriodo(p)}
                className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
                  periodo === p ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-800"
                }`}
              >
                {p === "6m" ? "6 meses" : "12 meses"}
              </button>
            ))}
          </div>
          <p className="flex items-center gap-1.5 text-xs text-zinc-500">
            <Globe size={13} />
            {painel?.lidoEm
              ? `Painel do portal lido em ${new Date(painel.lidoEm).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`
              : "O painel do portal chega na próxima leitura da extensão"}
          </p>
        </div>

        {/* As três notas. */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {painelDaJanela ? (
            <Nota
              titulo="No portal"
              janela={`${br(painelDaJanela.inicio)} a ${br(painelDaJanela.fim)}`}
              nota={painelDaJanela.nota ?? 0}
              exata={null}
              faixa={SELO_DO_PORTAL[painelDaJanela.selo] ?? painelDaJanela.selo}
              selo={painelDaJanela.selo === "RA1000"}
              rodape="O número que o consumidor vê."
            />
          ) : (
            <Nota titulo="No portal" janela="—" nota={null} exata={null} faixa="" selo={false} rodape="Aparece depois da próxima leitura do Reclame Aqui pela extensão." />
          )}
          <Nota
            titulo="Hoje"
            janela={`${br(atual.inicio)} a ${br(atual.fim)}`}
            nota={atual.resumo.raScore}
            exata={atual.resumo.raScoreExato}
            faixa={displayBand(atual.resumo).label}
            selo={atual.selo}
            delta={painelDaJanela?.nota != null ? atual.resumo.raScoreExato - painelDaJanela.nota : undefined}
            deltaRotulo="sobre o portal"
            rodape="A mesma janela, com as respostas e avaliações que já existem."
          />
          <Nota
            titulo="Prévia"
            janela={`${br(previa.inicio)} a ${br(previa.fim)}`}
            nota={previa.resumo.raScore}
            exata={previa.resumo.raScoreExato}
            faixa={displayBand(previa.resumo).label}
            selo={previa.selo}
            delta={previa.resumo.raScoreExato - atual.resumo.raScoreExato}
            deltaRotulo="sobre hoje"
            rodape="A janela que o portal assume na virada do mês."
          />
        </div>

        {painelDaJanela && painelDaJanela.aguardando != null && painelDaJanela.aguardando > semRespostaAgora && (
          <p className="rounded-xl bg-zinc-50 px-4 py-2.5 text-sm text-zinc-600 ring-1 ring-inset ring-zinc-200">
            O portal ainda conta <b className="tabular-nums">{painelDaJanela.aguardando}</b> sem resposta nesta janela; aqui já são{" "}
            <b className="tabular-nums">{semRespostaAgora}</b>. O painel do Reclame Aqui é atualizado com atraso — a diferença entra na próxima atualização dele.
          </p>
        )}

        {/* Os indicadores das três, contra a meta. */}
        <SurfaceCard
          title="Indicadores"
          hint="O selo RA1000 pede nota 8 ou mais, as quatro metas e 50 avaliações no período. Avaliação desconsiderada conta em avaliadas, mas fica fora da nota — como no portal."
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-zinc-400">
                  <th className="py-2 pr-3 font-semibold">Indicador</th>
                  <th className="px-3 py-2 text-right font-semibold">No portal</th>
                  <th className="px-3 py-2 text-right font-semibold">Hoje</th>
                  <th className="px-3 py-2 text-right font-semibold">Prévia</th>
                  <th className="py-2 pl-3 text-right font-semibold">Meta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 tabular-nums">
                <Linha
                  rotulo="Respondidas"
                  portal={painelDaJanela?.resposta != null ? `${ptBR(painelDaJanela.resposta)}%` : "—"}
                  portalOk={painelDaJanela?.resposta != null ? painelDaJanela.resposta >= RA1000_TARGETS.resposta : undefined}
                  hoje={`${ptBR(atual.resumo.responseIndex)}%`}
                  hojeOk={atual.resumo.responseIndex >= RA1000_TARGETS.resposta}
                  previa={`${ptBR(previa.resumo.responseIndex)}%`}
                  previaOk={previa.resumo.responseIndex >= RA1000_TARGETS.resposta}
                  meta={`${RA1000_TARGETS.resposta}%`}
                />
                <Linha
                  rotulo="Nota do consumidor"
                  portal={painelDaJanela?.notaConsumidor != null ? ptBR(painelDaJanela.notaConsumidor, 2) : "—"}
                  portalOk={painelDaJanela?.notaConsumidor != null ? painelDaJanela.notaConsumidor >= RA1000_TARGETS.consumidor : undefined}
                  hoje={ptBR(atual.resumo.consumerScore, 2)}
                  hojeOk={atual.resumo.consumerScore >= RA1000_TARGETS.consumidor}
                  previa={ptBR(previa.resumo.consumerScore, 2)}
                  previaOk={previa.resumo.consumerScore >= RA1000_TARGETS.consumidor}
                  meta={String(RA1000_TARGETS.consumidor)}
                />
                <Linha
                  rotulo="Solução"
                  portal={painelDaJanela?.solucao != null ? `${ptBR(painelDaJanela.solucao)}%` : "—"}
                  portalOk={painelDaJanela?.solucao != null ? painelDaJanela.solucao >= RA1000_TARGETS.solucao : undefined}
                  hoje={`${ptBR(atual.resumo.solutionIndex)}%`}
                  hojeOk={atual.resumo.solutionIndex >= RA1000_TARGETS.solucao}
                  previa={`${ptBR(previa.resumo.solutionIndex)}%`}
                  previaOk={previa.resumo.solutionIndex >= RA1000_TARGETS.solucao}
                  meta={`${RA1000_TARGETS.solucao}%`}
                />
                <Linha
                  rotulo="Voltaria a fazer negócio"
                  portal={painelDaJanela?.voltaria != null ? `${ptBR(painelDaJanela.voltaria)}%` : "—"}
                  portalOk={painelDaJanela?.voltaria != null ? painelDaJanela.voltaria >= RA1000_TARGETS["novos-negocios"] : undefined}
                  hoje={`${ptBR(atual.resumo.wouldReturnIndex)}%`}
                  hojeOk={atual.resumo.wouldReturnIndex >= RA1000_TARGETS["novos-negocios"]}
                  previa={`${ptBR(previa.resumo.wouldReturnIndex)}%`}
                  previaOk={previa.resumo.wouldReturnIndex >= RA1000_TARGETS["novos-negocios"]}
                  meta={`${RA1000_TARGETS["novos-negocios"]}%`}
                />
                <Linha
                  rotulo="Avaliadas"
                  portal={painelDaJanela?.avaliadas != null ? String(painelDaJanela.avaliadas) : "—"}
                  portalOk={painelDaJanela?.avaliadas != null ? painelDaJanela.avaliadas >= RA1000_MINIMO_DE_AVALIACOES : undefined}
                  hoje={String(atual.resumo.evaluated + desconsideradas)}
                  hojeOk={atual.resumo.evaluated >= RA1000_MINIMO_DE_AVALIACOES}
                  previa={String(previa.resumo.evaluated + desconsideradasPrevia)}
                  previaOk={previa.resumo.evaluated >= RA1000_MINIMO_DE_AVALIACOES}
                  meta={`${RA1000_MINIMO_DE_AVALIACOES}+`}
                />
                <Linha
                  rotulo="Recebidas"
                  portal={painelDaJanela?.recebidas != null ? String(painelDaJanela.recebidas) : "—"}
                  hoje={String(atual.resumo.received)}
                  previa={String(previa.resumo.received)}
                  meta=""
                />
                <Linha
                  rotulo="Sem resposta"
                  portal={painelDaJanela?.aguardando != null ? String(painelDaJanela.aguardando) : "—"}
                  hoje={String(atual.resumo.received - atual.resumo.answered)}
                  previa={String(previa.resumo.received - previa.resumo.answered)}
                  meta=""
                />
                {painelDaJanela?.tempoMedio && (
                  <Linha rotulo="Tempo médio de resposta" portal={painelDaJanela.tempoMedio} hoje="" previa="" meta="" />
                )}
              </tbody>
            </table>
          </div>
          {desconsideradas > 0 && (
            <p className="mt-2 text-xs text-zinc-500">
              {desconsideradas} avaliação desconsiderada nesta janela: conta em avaliadas, fica fora da nota e das porcentagens.
            </p>
          )}
        </SurfaceCard>

        <SurfaceCard
          title="Até o RA1000"
          description="Onde as notas estão entre as faixas e o que falta para a prévia manter o selo."
        >
          <ReguaDoIndice atual={atual.resumo.raScoreExato} previa={previa.resumo.raScoreExato} />
          <OQueFalta retrato={previa} />
        </SurfaceCard>

        <SurfaceCard
          title="Evolução"
          description="A nota no fim de cada dia, ciclo ou mês, com o que se sabia naquele dia — e quanto as respostas e as avaliações de cada período somaram à prévia. A avaliação conta no dia em que foi feita; a janela segue a regra do portal (a reclamação aberta nela)."
        >
          <EvolucaoDoIndice casos={cases} periodo={periodo} hoje={hoje} />
        </SurfaceCard>

        <ComparacaoComSegmento />

      </div>
    </MainLayout>
  );
}

function Nota({
  titulo,
  janela,
  nota,
  exata,
  faixa,
  selo,
  delta,
  deltaRotulo,
  rodape,
}: {
  titulo: string;
  janela: string;
  nota: number | null;
  exata: number | null;
  faixa: string;
  selo: boolean;
  delta?: number;
  deltaRotulo?: string;
  rodape: string;
}) {
  const cor = selo ? RA1000_BAND.color : nota === null ? "#a1a1aa" : bandOf(nota).color;
  return (
    <section className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{titulo}</p>
          <p className="text-xs tabular-nums text-zinc-500">{janela}</p>
        </div>
        {faixa && (
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ color: cor, boxShadow: `inset 0 0 0 1px ${cor}66` }}>
            {selo && <Award size={12} />}
            {faixa}
          </span>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-2">
        <span className="text-3xl font-semibold tabular-nums text-zinc-900">{nota === null ? "—" : ptBR(nota)}</span>
        {exata !== null && (
          <span className="font-mono text-xs tabular-nums text-zinc-500" title="A nota exata, sem arredondar">
            {notaExata(exata)}
          </span>
        )}
      </div>
      {delta !== undefined && Math.abs(delta) >= 0.000005 && (
        <p className={`text-xs font-medium tabular-nums ${delta > 0 ? "text-emerald-700" : "text-rose-700"}`}>
          {delta > 0 ? "+" : "−"}
          {notaExata(Math.abs(delta))} {deltaRotulo}
        </p>
      )}
      <p className="mt-2 text-xs text-zinc-500">{rodape}</p>
    </section>
  );
}

function Celula({ texto, ok }: { texto: string; ok?: boolean }) {
  return (
    <td className="px-3 py-2 text-right">
      <span className="inline-flex items-center justify-end gap-1">
        {texto}
        {ok === true && <CheckCircle2 size={13} className="text-emerald-600" />}
        {ok === false && <CircleAlert size={13} className="text-amber-600" />}
      </span>
    </td>
  );
}

function Linha({
  rotulo,
  portal,
  portalOk,
  hoje,
  hojeOk,
  previa,
  previaOk,
  meta,
}: {
  rotulo: string;
  portal: string;
  portalOk?: boolean;
  hoje: string;
  hojeOk?: boolean;
  previa: string;
  previaOk?: boolean;
  meta: string;
}) {
  return (
    <tr>
      <td className="py-2 pr-3 text-zinc-700">{rotulo}</td>
      <Celula texto={portal} ok={portalOk} />
      <Celula texto={hoje} ok={hojeOk} />
      <Celula texto={previa} ok={previaOk} />
      <td className="py-2 pl-3 text-right text-zinc-400">{meta}</td>
    </tr>
  );
}

function OQueFalta({ retrato }: { retrato: RetratoDoIndice }) {
  const { falta, resumo: s } = retrato;
  const itens: { texto: string; ok: boolean }[] = [
    {
      ok: falta.respostas === 0,
      texto: falta.respostas === 0 ? `Resposta em ${ptBR(s.responseIndex)}%: meta cumprida.` : `Responder mais ${falta.respostas} ${pluralDe(falta.respostas, "reclamação", "reclamações")} no portal: ${ptBR(s.responseIndex)}% → 90%.`,
    },
    {
      ok: falta.avaliacoesMinimas === 0,
      texto: falta.avaliacoesMinimas === 0 ? `${s.evaluated} avaliações: acima do mínimo de ${RA1000_MINIMO_DE_AVALIACOES}.` : `Mais ${falta.avaliacoesMinimas} ${pluralDe(falta.avaliacoesMinimas, "avaliação", "avaliações")} para o mínimo de ${RA1000_MINIMO_DE_AVALIACOES}.`,
    },
    {
      ok: falta.avaliacoesIdeais.needed === 0 && falta.avaliacoesIdeais.reachable,
      texto:
        falta.avaliacoesIdeais.needed === 0 && falta.avaliacoesIdeais.reachable
          ? "Nota do consumidor, solução e voltaria: metas cumpridas."
          : falta.avaliacoesIdeais.reachable
            ? `Mais ${falta.avaliacoesIdeais.needed} ${pluralDe(falta.avaliacoesIdeais.needed, "avaliação", "avaliações")} nota 10, resolvidas e "voltaria" levam a nota do consumidor, a solução e o voltaria às metas.`
            : falta.avaliacoesIdeais.reason === "sem-avaliacoes"
              ? "As reclamações sem avaliação do período não bastam para as metas de avaliação — só o tempo traz mais."
              : "Mesmo com todas nota 10, as metas de avaliação não fecham neste período.",
    },
  ];

  return (
    <ul className="mt-4 space-y-1.5">
      {itens.map((i) => (
        <li key={i.texto} className="flex items-start gap-2 text-sm text-zinc-700">
          {i.ok ? <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-600" /> : <CircleAlert size={15} className="mt-0.5 shrink-0 text-amber-600" />}
          {i.texto}
        </li>
      ))}
    </ul>
  );
}
