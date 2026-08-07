"use client";

import { useMemo } from "react";

import { useCases } from "@/lib/context/CaseContext";
import { groupBy } from "@/lib/services/case.service";

import SurfaceCard from "@/components/shared/SurfaceCard";
import BarList from "@/components/shared/BarList";

export default function CasesBySourceChart() {

  const { cases } = useCases();

  const data = useMemo(
    () => groupBy(cases, "source"),
    [cases]
  );

  return (
    <SurfaceCard
      title="Casos por origem"
      description="De onde a operação está recebendo demanda."
    >
      <BarList data={data} color="#0EA5E9" />
    </SurfaceCard>
  );
}
