"use client";

import Link from "next/link";
import { SpeedInsights } from "@vercel/speed-insights/next"
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
import { REFERENCE_DATE } from "@/lib/services/reputation.service";

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
      `${REFERENCE_DATE}T00:00:00Z`
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

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

          <StatTile
            label="Sem resposta pública"
            description="Reclamações que ainda não foram respondidas no portal. É o que mais pesa na nota."
            value={metrics.semResposta}
            hint="impacto direto na nota"
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
            hint="prioridade máxima"
            icon={Timer}
            tone={
              metrics.vencidos > 0 ? "warning" : "success"
            }
          />

          <StatTile
            label="Na fila da operação"
            description="Casos que dependem de alguma ação do time."
            value={metrics.abertos}
            hint="dependem do time"
            icon={Inbox}
            tone="info"
          />

          <StatTile
            label="Risco de cancelamento"
            description="Clientes que avaliaram mal e não voltariam a fazer negócio."
            value={metrics.churn}
            hint="clientes em risco"
            icon={TriangleAlert}
            tone="primary"
          />

        </div>

        <div className="grid gap-6 xl:grid-cols-3">

          <div className="xl:col-span-2">
            <MonthlyEvolution />
          </div>

          <TodayAgenda />

        </div>

        <div className="grid gap-6 xl:grid-cols-3">

          <div className="xl:col-span-2">
            <CriticalCases />
          </div>

          <ImpactSummary />

        </div>

        <div className="grid gap-6 lg:grid-cols-3">

          <div className="lg:col-span-2">
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
