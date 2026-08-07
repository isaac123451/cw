"use client";

import { useMemo } from "react";

import { useCases } from "@/lib/context/CaseContext";
import { getMonthlyTrend } from "@/lib/services/case.service";

import SurfaceCard from "@/components/shared/SurfaceCard";
import TrendChart from "@/components/shared/TrendChart";

export default function MonthlyEvolution() {

  const { cases } = useCases();

  const data = useMemo(
    () => getMonthlyTrend(cases),
    [cases]
  );

  return (
    <SurfaceCard
      title="Evolução mensal"
      description="Reclamações recebidas x resolvidas ao longo do tempo."
    >
      <TrendChart data={data} />
    </SurfaceCard>
  );
}
