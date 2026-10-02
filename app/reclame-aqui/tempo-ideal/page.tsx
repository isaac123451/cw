"use client";

import { useMemo, useState } from "react";

import Link from "next/link";

import { CheckCircle2, CircleAlert, OctagonAlert, Timer } from "lucide-react";

import MainLayout from "@/components/layout/MainLayout";
import PageHeading from "@/components/shared/PageHeading";
import SurfaceCard from "@/components/shared/SurfaceCard";
import ModuleNav from "@/components/reclame-aqui/ModuleNav";

import { useScopedCases } from "@/lib/context/useScopedCases";
import {
  CORTES_DO_TETO,
  estudoDoTempo,
  folgaDaJanela,
  MATURIDADE_DA_RESPOSTA,
  MINIMO_DO_TETO,
  MINIMO_POR_FAIXA,
  type Desfecho,
  type FaixaComDesfecho,
  type Folga,
  type PeriodoDoEstudo,
  type Zona,
} from "@/lib/models/tempoIdeal";
import { getRange, hojeNaOperacao, ptBR, RA1000_TARGETS } from "@/lib/services/reputation.service";

const br = (iso: string) => iso.split("-").reverse().join("/");
const dias = (n: number) => `${n} ${n === 1 ? "dia" : "dias"}`;
/** A nota sempre com duas casas, para as linhas se compararem de olho. */
const nota = (n: number) => n.toFixed(2).replace(".", ",");

type Tom = "ideal" | "atencao" | "teto" | "prazo";

const TOM: Record<Tom, { rotulo: string; classe: string; Icone: typeof CheckCircle2 }> = {
  ideal: { rotulo: "Ideal", classe: "text-emerald-700", Icone: CheckCircle2 },
  atencao: { rotulo: "Atenção", classe: "text-amber-700", Icone: CircleAlert },
  teto: { rotulo: "Passou do teto", classe: "text-rose-700", Icone: OctagonAlert },
  prazo: { rotulo: "Prazo", classe: "text-violet-700", Icone: Timer },
};

/**
 * O tempo ideal e o teto de uma reclamação (1.130).
 *
 * "Um cálculo que eu entenda qual é o tempo ideal para finalizar um caso
 * do reclame aqui e o teto máximo" — com o índice de resposta sem cair de
 * 90%. A conta é de `lib/models/tempoIdeal.ts`, provada contra o banco no
 * `check:tempo-ideal`; esta tela só mostra, e cada número muda quando as
 * reclamações mudam.
 */
export default function TempoIdealPage() {

  const { cases, loading } = useScopedCases("reclame-aqui");
  const [periodo, setPeriodo] = useState<PeriodoDoEstudo>("12m");
  const hoje = hojeNaOperacao();

  const estudo = useMemo(() => estudoDoTempo(cases, hoje, periodo), [cases, hoje, periodo]);
  const folgas = useMemo(() => {
    const vigente = getRange("6m", "vigente");
    const proxima = getRange("6m", "proximo");
    return {
      hoje: folgaDaJanela(cases, vigente.start, vigente.end),
      previa: folgaDaJanela(cases, proxima.start, proxima.end),
    };
  }, [cases]);

  const { finalizacao: fin, avaliacao, resposta } = estudo;
  const zonaIdeal = fin.ideal !== null ? fin.zonas[0] : undefined;
  const zonaDepoisDoTeto = fin.teto !== null ? fin.zonas[fin.zonas.length - 1] : undefined;
  const sim = resposta.simulacao;

  const tomDaFaixa = (f: FaixaComDesfecho): Tom | null => {
    if (f.casos === 0) return null;
    if (fin.ideal !== null && f.ate !== null && f.ate <= fin.ideal) return "ideal";
    if (fin.teto !== null && f.de > fin.teto) return "teto";
    return "atencao";
  };

  return (
    <MainLayout>
      <div className="space-y-5">

        <PageHeading
          eyebrow="Reclame Aqui"
          title="Tempo ideal"
          description="Quanto tempo uma reclamação pode levar, medido nas reclamações da própria Cardápio Web: o ideal para finalizar, o teto e o prazo de resposta que segura os 90%."
        />

        <ModuleNav />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-xl bg-zinc-100 p-1" role="tablist" aria-label="Período do estudo">
            {(["12m", "tudo"] as const).map((p) => (
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
                {p === "12m" ? "Últimos 12 meses" : "Toda a base"}
              </button>
            ))}
          </div>
          <p className="text-xs text-zinc-500">
            {loading
              ? "Carregando as reclamações…"
              : `${fin.amostra} avaliadas ${estudo.desde ? `abertas desde ${br(estudo.desde)}` : "desde o início da base"} · dias corridos`}
          </p>
        </div>

        {periodo === "tudo" && (
          <p className="rounded-xl bg-zinc-50 px-4 py-2.5 text-sm text-zinc-600 ring-1 ring-inset ring-zinc-200">
            A base inteira inclui 2024, quando a operação era outra. Para decidir o prazo de hoje, valem os últimos 12 meses.
          </p>
        )}

        {/* As três respostas. */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Destaque
            titulo="Ideal para finalizar"
            valor={fin.ideal !== null ? `até ${dias(fin.ideal)}` : "—"}
            linha={zonaIdeal ? resumoDoDesfecho(zonaIdeal.desfecho) : "Nenhuma faixa bate as três metas do selo desde o primeiro dia."}
            rodape={zonaIdeal ? `${zonaIdeal.desfecho.avaliadas} avaliadas finalizaram nesse prazo (${ptBR(zonaIdeal.parte)}%). Da abertura até a avaliação do consumidor.` : ""}
            tom="ideal"
          />
          <Destaque
            titulo="Teto"
            valor={fin.teto !== null ? dias(fin.teto) : "—"}
            linha={zonaDepoisDoTeto ? `Depois disso: ${resumoDoDesfecho(zonaDepoisDoTeto.desfecho)}` : "Nenhum corte em que tudo depois dele fique abaixo das metas."}
            rodape={zonaDepoisDoTeto ? `Abaixo das três metas do RA1000. ${zonaDepoisDoTeto.desfecho.avaliadas} avaliadas passaram do teto (${ptBR(zonaDepoisDoTeto.parte)}%).` : ""}
            tom="teto"
          />
          <Destaque
            titulo="Responder em até"
            valor={sim.prazo !== null ? dias(sim.prazo) : "—"}
            linha={
              sim.prazo !== null
                ? `O maior prazo que manteria a resposta em 90% em todos os dias de ${br(sim.inicio)} a ${br(sim.fim)}.`
                : "Nem respondendo em 1 dia a janela ficaria em 90% em todos os dias."
            }
            rodape={
              sim.piorComUmDiaAMais
                ? `Com ${dias((sim.prazo ?? 0) + 1)}, cairia para ${ptBR(sim.piorComUmDiaAMais.indice)}% em ${br(sim.piorComUmDiaAMais.dia)} — sempre na virada do mês.`
                : ""
            }
            tom="prazo"
          />
        </div>

        {/* A folga de agora. */}
        <SurfaceCard
          title="Resposta: a folga de agora"
          description="Quantas reclamações ainda podem ficar sem resposta pública sem o índice cair de 90% — na janela que o portal mostra e na que ele assume na virada do mês."
          action={
            <Link href="/reclame-aqui?situacao=sem-resposta" className="text-sm font-medium text-violet-700 hover:underline">
              Ver as sem resposta
            </Link>
          }
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <LinhaDaFolga titulo="Janela de hoje" folga={folgas.hoje} />
            <LinhaDaFolga titulo="Prévia (a da virada do mês)" folga={folgas.previa} previa />
          </div>
        </SurfaceCard>

        {/* Finalizar. */}
        <SurfaceCard
          title="Finalizar: da abertura à avaliação"
          description={
            fin.mediana !== null && fin.p80 !== null
              ? `Metade das avaliadas finaliza em até ${dias(Math.round(fin.mediana))}; 80%, em até ${dias(Math.round(fin.p80))}. Cada faixa contra as metas do selo: nota ${RA1000_TARGETS.consumidor}, solução ${RA1000_TARGETS.solucao}%, voltaria ${RA1000_TARGETS["novos-negocios"]}%.`
              : "Ainda sem avaliações com data neste período."
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-zinc-400">
                  <th className="py-2 pr-3 font-semibold">Finalizou em</th>
                  <th className="px-3 py-2 text-right font-semibold">Avaliadas</th>
                  <th className="px-3 py-2 text-right font-semibold">Nota</th>
                  <th className="px-3 py-2 text-right font-semibold">Solução</th>
                  <th className="px-3 py-2 text-right font-semibold">Voltaria</th>
                  <th className="py-2 pl-3 text-right font-semibold">Zona</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 tabular-nums">
                {fin.faixas.map((f) => (
                  <LinhaDeFaixa key={f.rotulo} faixa={f} tom={tomDaFaixa(f)} />
                ))}
              </tbody>
            </table>
          </div>
          {fin.zonas.length > 0 && <Zonas zonas={fin.zonas} ideal={fin.ideal} teto={fin.teto} />}
        </SurfaceCard>

        {/* Pedir a avaliação. */}
        <SurfaceCard
          title="Pedir a avaliação: da resposta à avaliação"
          description={
            avaliacao.amostra > 0
              ? `Quanto das ${avaliacao.amostra} avaliações chegou até N dias depois da resposta pública.`
              : "Ainda sem avaliações com a data da resposta neste período."
          }
        >
          {avaliacao.amostra > 0 && (
            <>
              <ul className="space-y-1.5">
                {avaliacao.acumulado.map((a) => (
                  <li key={a.dias} className="grid grid-cols-[110px_1fr_56px] items-center gap-3 text-sm">
                    <span className="text-zinc-600">{a.dias === 0 ? "no mesmo dia" : `até ${dias(a.dias)}`}</span>
                    <span className="h-2 rounded-full bg-zinc-100" aria-hidden>
                      <span className="block h-2 rounded-full bg-violet-600" style={{ width: `${a.parte}%` }} />
                    </span>
                    <span className="text-right tabular-nums text-zinc-800">{ptBR(a.parte)}%</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-sm text-zinc-600">
                {leituraDaAvaliacao(avaliacao.acumulado, avaliacao.depoisDe30)}
              </p>
            </>
          )}
        </SurfaceCard>

        {/* Responder. */}
        <SurfaceCard
          title="Responder: da abertura à resposta pública"
          description={
            resposta.mediana !== null && resposta.p80 !== null
              ? `Metade das reclamações foi respondida em até ${dias(Math.round(resposta.mediana))}; 80%, em até ${dias(Math.round(resposta.p80))}. A taxa de avaliação só conta respostas de ${MATURIDADE_DA_RESPOSTA} dias ou mais — as recentes ainda não tiveram tempo.`
              : "Ainda sem respostas com data neste período."
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-zinc-400">
                  <th className="py-2 pr-3 font-semibold">Respondida em</th>
                  <th className="px-3 py-2 text-right font-semibold">Respondidas</th>
                  <th className="px-3 py-2 text-right font-semibold">Viraram avaliação</th>
                  <th className="px-3 py-2 text-right font-semibold">Nota</th>
                  <th className="px-3 py-2 text-right font-semibold">Solução</th>
                  <th className="py-2 pl-3 text-right font-semibold">Voltaria</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 tabular-nums">
                {resposta.faixas.map((f) => (
                  <tr key={f.rotulo} className={f.decide ? "" : "text-zinc-400"}>
                    <td className="py-2 pr-3 text-zinc-700">{f.rotulo}</td>
                    <td className="px-3 py-2 text-right">{f.casos}</td>
                    <td className="px-3 py-2 text-right">{f.taxaDeAvaliacao != null ? `${ptBR(f.taxaDeAvaliacao)}%` : "—"}</td>
                    <Metrica valor={f.desfecho.nota} ok={f.desfecho.metas?.nota} formato="nota" />
                    <Metrica valor={f.desfecho.solucao} ok={f.desfecho.metas?.solucao} formato="pct" />
                    <Metrica valor={f.desfecho.voltaria} ok={f.desfecho.metas?.voltaria} formato="pct" ultima />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SurfaceCard>

        <details className="rounded-xl border border-zinc-200/80 bg-white px-5 py-4 text-sm text-zinc-600 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <summary className="cursor-pointer font-medium text-zinc-800">Como o cálculo é feito</summary>
          <div className="mt-3 space-y-2">
            <p>
              <b className="text-zinc-800">Ideal.</b> As avaliadas são divididas por quantos dias levaram da abertura até a avaliação. Começando do primeiro dia, cada faixa precisa bater as três metas de avaliação do selo RA1000 (nota {RA1000_TARGETS.consumidor}, solução {RA1000_TARGETS.solucao}% e voltaria {RA1000_TARGETS["novos-negocios"]}%). A primeira faixa que falha encerra o ideal. Faixa com menos de {MINIMO_POR_FAIXA} avaliadas aparece em cinza e não decide.
            </p>
            <p>
              <b className="text-zinc-800">Teto.</b> O primeiro corte ({CORTES_DO_TETO.join(", ")} dias) a partir do qual tudo o que finaliza depois fica abaixo das três metas ao mesmo tempo, com pelo menos {MINIMO_DO_TETO} avaliadas. Dali em diante, cada avaliação puxa para baixo a nota, a solução e o voltaria.
            </p>
            <p>
              <b className="text-zinc-800">Responder em até.</b> Simulação com as reclamações que chegaram de verdade: se toda reclamação fosse respondida nesse prazo, o índice de resposta da janela de 6 meses ficaria em 90% em todos os dias dos últimos 12 meses. O pior dia é sempre o 1º do mês, quando a janela passa a incluir o mês que acabou de fechar, com as últimas reclamações dele ainda sem resposta.
            </p>
            <p>
              <b className="text-zinc-800">Folga.</b> O índice arredondado como o portal mostra (89,96% aparece como 90,0%). Cada reclamação nova da prévia aumenta o permitido em um décimo — e, se ficar sem resposta, ocupa um inteiro.
            </p>
            <p>
              <b className="text-zinc-800">Leitura.</b> É correlação, não causa: caso difícil demora mais e avalia pior. O que a tabela mostra é a partir de quando a nota cai, e por isso vale como prazo de trabalho. A avaliação desconsiderada pelo Reclame Aqui fica fora, como na nota do portal.
            </p>
          </div>
        </details>

      </div>
    </MainLayout>
  );
}

function resumoDoDesfecho(d: Desfecho) {
  if (d.nota === null) return "sem avaliação";
  return `nota ${nota(d.nota)} · ${ptBR(d.solucao ?? 0)}% resolvidas · ${ptBR(d.voltaria ?? 0)}% voltariam`;
}

function leituraDaAvaliacao(acumulado: { dias: number; parte: number }[], depoisDe30: number | null) {
  const em = (n: number) => acumulado.find((a) => a.dias === n)?.parte ?? 0;
  const partes = [
    `${ptBR(em(1))}% avaliam até 1 dia depois da resposta e ${ptBR(em(7))}% até 7 dias.`,
    depoisDe30 !== null ? `Depois de 30 dias chegam só ${ptBR(depoisDe30)}%.` : "",
    em(1) >= 50 ? "Metade avalia até o dia seguinte à resposta: o 1º lembrete da documentação, 2 dias depois, chega quando metade já avaliou." : "",
  ];
  return partes.filter(Boolean).join(" ");
}

function Destaque({ titulo, valor, linha, rodape, tom }: { titulo: string; valor: string; linha: string; rodape: string; tom: Tom }) {
  const t = TOM[tom];
  return (
    <section className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <p className={`flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide ${t.classe}`}>
        <t.Icone size={13} />
        {titulo}
      </p>
      <p className="mt-2 text-3xl font-semibold tabular-nums text-zinc-900">{valor}</p>
      <p className="mt-1 text-sm text-zinc-700">{linha}</p>
      {rodape && <p className="mt-2 text-xs text-zinc-500">{rodape}</p>}
    </section>
  );
}

function LinhaDaFolga({ titulo, folga, previa = false }: { titulo: string; folga: Folga; previa?: boolean }) {
  const indice = folga.recebidas ? Math.round((folga.respondidas / folga.recebidas) * 1000) / 10 : 0;
  const tom: Tom = folga.folga > 0 ? "ideal" : folga.folga === 0 ? "atencao" : "teto";
  const t = TOM[tom];
  const frase =
    folga.folga > 0
      ? `Ainda cabem ${folga.folga} sem resposta.`
      : folga.folga === 0
        ? "Folga zero: a próxima que ficar sem resposta leva o índice para baixo de 90%."
        : `Responder ${-folga.folga} ${previa ? `até ${br(folga.fim)}` : "agora"} para voltar a 90%.`;
  return (
    <div className="rounded-xl bg-zinc-50 p-3 ring-1 ring-inset ring-zinc-200">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-zinc-800">{titulo}</p>
        <p className="text-xs tabular-nums text-zinc-500">
          {br(folga.inicio)} a {br(folga.fim)}
        </p>
      </div>
      <p className="mt-1 text-sm tabular-nums text-zinc-700">
        {folga.recebidas} recebidas · {folga.semResposta} sem resposta · {ptBR(indice)}% respondidas · máximo de {folga.maximoSemResposta} sem resposta
      </p>
      <p className={`mt-1.5 flex items-start gap-1.5 text-sm font-medium ${t.classe}`}>
        <t.Icone size={15} className="mt-0.5 shrink-0" />
        {frase}
      </p>
    </div>
  );
}

function Metrica({ valor, ok, formato, ultima = false }: { valor: number | null; ok?: boolean; formato: "nota" | "pct"; ultima?: boolean }) {
  return (
    <td className={`${ultima ? "py-2 pl-3" : "px-3 py-2"} text-right`}>
      {valor === null ? (
        "—"
      ) : (
        <span className="inline-flex items-center justify-end gap-1">
          {formato === "nota" ? nota(valor) : `${ptBR(valor)}%`}
          {ok === true && <CheckCircle2 size={13} className="text-emerald-600" aria-label="bate a meta" />}
          {ok === false && <CircleAlert size={13} className="text-amber-600" aria-label="abaixo da meta" />}
        </span>
      )}
    </td>
  );
}

function LinhaDeFaixa({ faixa: f, tom }: { faixa: FaixaComDesfecho; tom: Tom | null }) {
  const t = tom ? TOM[tom] : null;
  return (
    <tr className={f.decide ? "" : "text-zinc-400"}>
      <td className="py-2 pr-3 text-zinc-700">{f.rotulo}</td>
      <td className="px-3 py-2 text-right">{f.casos}</td>
      <Metrica valor={f.desfecho.nota} ok={f.decide ? f.desfecho.metas?.nota : undefined} formato="nota" />
      <Metrica valor={f.desfecho.solucao} ok={f.decide ? f.desfecho.metas?.solucao : undefined} formato="pct" />
      <Metrica valor={f.desfecho.voltaria} ok={f.decide ? f.desfecho.metas?.voltaria : undefined} formato="pct" />
      <td className="py-2 pl-3 text-right">
        {t ? (
          <span className={`inline-flex items-center gap-1 text-xs font-medium ${t.classe}`}>
            <t.Icone size={13} />
            {t.rotulo}
          </span>
        ) : (
          "—"
        )}
      </td>
    </tr>
  );
}

function Zonas({ zonas, ideal, teto }: { zonas: Zona[]; ideal: number | null; teto: number | null }) {
  const tomDe = (z: Zona): Tom => (ideal !== null && z.ate !== null && z.ate <= ideal ? "ideal" : teto !== null && z.de > teto ? "teto" : "atencao");
  return (
    <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-3">
      {zonas.map((z) => {
        const t = TOM[tomDe(z)];
        return (
          <div key={z.rotulo} className="rounded-xl bg-zinc-50 p-3 ring-1 ring-inset ring-zinc-200">
            <p className={`flex items-center gap-1.5 text-xs font-semibold ${t.classe}`}>
              <t.Icone size={13} />
              {t.rotulo} · {z.rotulo}
            </p>
            <p className="mt-1 text-sm text-zinc-700">{resumoDoDesfecho(z.desfecho)}</p>
            <p className="mt-0.5 text-xs tabular-nums text-zinc-500">
              {z.desfecho.avaliadas} avaliadas · {ptBR(z.parte)}% do total
            </p>
          </div>
        );
      })}
    </div>
  );
}
