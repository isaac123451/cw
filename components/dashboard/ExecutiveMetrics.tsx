"use client";

import { useMemo } from "react";

import {
  AlertTriangle,
  CheckCircle2,
  Inbox,
  Star,
  TriangleAlert,
} from "lucide-react";

import { useCases } from "@/lib/context/CaseContext";
import { getMetrics } from "@/lib/services/case.service";

import StatTile from "@/components/shared/StatTile";

export default function ExecutiveMetrics() {

  const { cases } = useCases();

  const metrics = useMemo(
    () => getMetrics(cases),
    [cases]
  );

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">

      <StatTile
        label="Em aberto"
        description="Casos que ainda não foram encerrados: Novo, Em Atendimento ou Aguardando Cliente."
        value={metrics.open}
        hint={`de ${metrics.total} no total`}
        icon={Inbox}
        tone="info"
      />

      <StatTile
        label="Casos críticos"
        description="Reclamações com prioridade Crítica que seguem sem solução."
        value={metrics.critical}
        hint="prioridade máxima"
        icon={AlertTriangle}
        tone="danger"
      />

      <StatTile
        label="Risco de churn"
        description="Casos sinalizados com risco de cancelamento do contrato."
        value={metrics.churnRisk}
        hint="clientes em risco"
        icon={TriangleAlert}
        tone="warning"
      />

      <StatTile
        label="Índice de solução"
        description="Percentual de consumidores que confirmaram a solução. Conta só quem avaliou."
        value={`${metrics.solutionRate}%`}
        icon={CheckCircle2}
        tone="success"
        trend={{
          value: `${metrics.resolved} resolvidos`,
          positive: true,
        }}
      />

      <StatTile
        label="Nota média"
        description="Média das notas dadas pelo consumidor, de 0 a 10."
        value={metrics.averageScore.toFixed(1)}
        hint="avaliação do consumidor"
        icon={Star}
        tone="primary"
      />

    </div>
  );
}
