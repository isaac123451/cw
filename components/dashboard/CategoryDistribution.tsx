"use client";

import { useMemo } from "react";

import { useCases } from "@/lib/context/CaseContext";
import { casosDoRotulo, groupBy, isReclameAqui } from "@/lib/services/case.service";

import SurfaceCard from "@/components/shared/SurfaceCard";
import BarList from "@/components/shared/BarList";
import { abrirJanelaDeCasos } from "@/components/shared/JanelaDeCasos";

export default function CategoryDistribution() {

  const { cases: todos } = useCases();

  /*
    Só o Reclame Aqui (03/11/2026): os 146 atendimentos das Redes não têm
    categoria e apareciam no topo como "Não classificado", 27% das "causas".
  */
  const cases = useMemo(() => todos.filter(isReclameAqui), [todos]);

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
        Cada barra abre os casos daquela categoria na mini janela (21/10/2026).

        O número responde "quantas"; a pergunta seguinte é sempre
        "quais", e antes ela custava atravessar a aplicação e remontar
        o filtro à mão.
      */}
      <BarList
        data={data}
        limit={7}
        aoClicar={(categoria) => abrirJanelaDeCasos({ titulo: categoria, descricao: "Ocorrências desta categoria.", casos: casosDoRotulo(cases, "category", categoria) })}
      />
    </SurfaceCard>
  );
}
