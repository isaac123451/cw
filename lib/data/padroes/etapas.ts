import { WorkflowStatus } from "@/lib/models/workflow";

/**
 * Etapas fiéis ao ciclo do Reclame Aqui. "Aguardando avaliação" é o
 * estado de quem já foi respondido e espera o retorno do consumidor —
 * não é atendimento em andamento.
 */
export const ETAPAS_DO_QUADRO: WorkflowStatus[] = [
  {
    id: "1",
    name: "Novo",
    color: "#EF4444",
    order: 1,
    active: true,
    limit: 15,
  },
  {
    id: "2",
    name: "Aguardando nossa réplica",
    color: "#F59E0B",
    order: 2,
    active: true,
    limit: 10,
  },
  {
    id: "3",
    name: "Aguardando avaliação",
    color: "#0EA5E9",
    order: 3,
    active: true,
    limit: 0,
  },
  {
    id: "4",
    name: "Resolvido",
    color: "#22C55E",
    order: 4,
    active: true,
    limit: 0,
  },
  {
    id: "5",
    name: "Não resolvido",
    color: "#71717A",
    order: 5,
    active: true,
    limit: 0,
  },
];
