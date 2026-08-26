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
      {/*
        Cada barra leva à fila filtrada por aquela categoria.

        O número responde "quantas"; a pergunta seguinte é sempre
        "quais", e antes ela custava atravessar a aplicação e remontar
        o filtro à mão.
      */}
      <BarList
        data={data}
        limit={7}
        hrefDe={(categoria) =>
          `/reclame-aqui?categoria=${encodeURIComponent(categoria)}`
        }
      />
    </SurfaceCard>
  );
}
