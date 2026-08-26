"use client";

import Link from "next/link";
import { useMemo } from "react";

import {
  ArrowRight,
  Inbox,
  MessageSquareWarning,
  Timer,
  TriangleAlert,
} from "lucide-react";

import MainLayout from "@/components/layout/MainLayout";

import PageHeading from "@/components/shared/PageHeading";
import StatTile from "@/components/shared/StatTile";
import SurfaceCard from "@/components/shared/SurfaceCard";

import ReputationHero from "@/components/dashboard/ReputationHero";
import TodayAgenda from "@/components/dashboard/TodayAgenda";
import ImpactSummary from "@/components/dashboard/ImpactSummary";
import MonthlyEvolution from "@/components/dashboard/MonthlyEvolution";
import CriticalCases from "@/components/dashboard/CriticalCases";
import CategoryDistribution from "@/components/dashboard/CategoryDistribution";

import { useCases } from "@/lib/context/CaseContext";
import { useSession } from "@/lib/context/SessionContext";

import { isOpen, isReclameAqui } from "@/lib/services/case.service";
import { hojeNaOperacao } from "@/lib/services/reputation.service";
import FrentesResumo from "@/components/dashboard/FrentesResumo";

/** Atalhos para onde a operação realmente age. */
const atalhos = [
  {
    label: "Fila do Reclame Aqui",
    href: "/reclame-aqui",
    hint: "Quadro e lista das reclamações",
  },
  {
    label: "Analytics de reputação",
    href: "/reclame-aqui/analytics",
    hint: "Nota, indicadores e diagnóstico",
  },
  {
    label: "Calculadora",
    href: "/reclame-aqui/calculadora",
    hint: "Simule o efeito de novas avaliações",
  },
];

export default function DashboardPage() {

  const { cases } = useCases();
  const session = useSession();

  const metrics = useMemo(() => {

    const abertos = cases.filter(isOpen);

    const semResposta = cases.filter(
      (item) =>
        isReclameAqui(item) &&
        (item.publicResponse ?? "").trim() === ""
    );

    // Sem resposta há mais de 7 dias — o que derruba a nota.
    const limite = new Date(
      `${hojeNaOperacao()}T00:00:00Z`
    );
    limite.setUTCDate(limite.getUTCDate() - 7);
    const corte = limite.toISOString().slice(0, 10);

    return {
      abertos: abertos.length,
      semResposta: semResposta.length,
      vencidos: semResposta.filter(
        (item) => item.createdAt < corte
      ).length,
      churn: cases.filter((item) => item.churnRisk)
        .length,
    };

  }, [cases]);

  const primeiroNome =
    session?.name?.split(" ")[0] ?? "";

  return (
    <MainLayout>

      <div className="space-y-6">

        <PageHeading
          eyebrow="Visão geral"
          title={
            primeiroNome
              ? `Bom trabalho, ${primeiroNome}`
              : "Dashboard executivo"
          }
          description="A reputação da Cardápio Web e o que a operação precisa resolver hoje."
        />

        <ReputationHero />

        {/*
          O aviso que faltava.

          O bloco acima é a janela oficial de 6 meses — é ela que define
          a nota pública. Os quatro cartões abaixo são a base inteira,
          porque uma reclamação de 2024 sem resposta continua sem
          resposta e continua sendo trabalho.

          Os dois estão certos e mediam coisas diferentes, mas nada na
          tela dizia isso: a nota mostrava 6 sem resposta e o cartão
          logo abaixo mostrava 13. Dois números para a mesma pergunta,
          um do lado do outro, é como alguém perde a confiança na tela
          inteira.
        */}
        <p className="-mb-1 text-xs text-zinc-500">
          Acima, a janela oficial de 6 meses — a que define
          a nota pública. Abaixo, <strong className="font-semibold text-zinc-700">toda a base</strong>:
          reclamação antiga sem resposta continua sendo
          trabalho, mesmo fora da janela.
        </p>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

          <StatTile
            label="Sem resposta pública"
            description="Reclamações que ainda não foram respondidas no portal. É o que mais pesa na nota."
            value={metrics.semResposta}
            hint="em toda a base"
            icon={MessageSquareWarning}
            tone={
              metrics.semResposta > 0
                ? "danger"
                : "success"
            }
          />

          <StatTile
            label="Vencidas há +7 dias"
            description="Sem resposta há mais de uma semana — prioridade máxima."
            value={metrics.vencidos}
            hint="em toda a base"
            icon={Timer}
            tone={
              metrics.vencidos > 0 ? "warning" : "success"
            }
          />

          <StatTile
            label="Na fila da operação"
            description="Casos que dependem de alguma ação do time."
            value={metrics.abertos}
            hint="em toda a base"
            icon={Inbox}
            tone="info"
          />

          <StatTile
            label="Risco de cancelamento"
            description="Clientes que avaliaram mal e não voltariam a fazer negócio."
            value={metrics.churn}
            hint="em toda a base"
            icon={TriangleAlert}
            tone="primary"
          />

        </div>

        {/*
          As três frentes, antes de qualquer gráfico.

          O painel abria direto na nota do Reclame Aqui, e o resto da
          operação — NPS e redes sociais — não aparecia em lugar nenhum.
          Este cartão responde "onde está o trabalho hoje" antes de
          entrar no detalhe de uma frente só.
        */}
        <FrentesResumo />

        <div className="grid min-w-0 gap-5 sm:gap-6 xl:grid-cols-3">

          <div className="min-w-0 xl:col-span-2">
            <MonthlyEvolution />
          </div>

          <TodayAgenda />

        </div>

        <div className="grid min-w-0 gap-5 sm:gap-6 xl:grid-cols-3">

          <div className="min-w-0 xl:col-span-2">
            <CriticalCases />
          </div>

          <ImpactSummary />

        </div>

        <div className="grid min-w-0 gap-5 sm:gap-6 lg:grid-cols-3">

          <div className="min-w-0 lg:col-span-2">
            <CategoryDistribution />
          </div>

          <SurfaceCard
            title="Atalhos"
            description="Onde a operação age no dia a dia."
            bodyClassName="p-2"
          >

            <ul className="space-y-1">

              {atalhos.map((item) => (

                <li key={item.href}>

                  <Link
                    href={item.href}
                    className="group flex items-center gap-3 rounded-xl px-3.5 py-3 transition-colors hover:bg-violet-50/60"
                  >

                    <span className="min-w-0 flex-1">

                      <span className="block truncate text-sm font-medium text-zinc-800">
                        {item.label}
                      </span>

                      <span className="block truncate text-xs text-zinc-500">
                        {item.hint}
                      </span>

                    </span>

                    <ArrowRight
                      size={15}
                      className="shrink-0 text-zinc-300 transition-colors group-hover:text-violet-600"
                    />

                  </Link>

                </li>

              ))}

            </ul>

          </SurfaceCard>

        </div>

      </div>

    </MainLayout>
  );
}
