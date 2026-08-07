"use client";

import { useMemo } from "react";

import { useCases } from "@/lib/context/CaseContext";
import { groupBy } from "@/lib/services/case.service";

import SurfaceCard from "@/components/shared/SurfaceCard";
import BarList from "@/components/shared/BarList";

export default function CategoryDistribution() {

  const { cases } = useCases();

  const data = useMemo(
    () => groupBy(cases, "category"),
    [cases]
  );

  return (
    <SurfaceCard
      title="Principais causas"
      description="Categorias que mais geram reclamação."
    >
      <BarList data={data} limit={7} />
    </SurfaceCard>
  );
}
