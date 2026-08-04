import { WorkflowStatus } from "@/lib/models/workflow";

export const mockWorkflow: WorkflowStatus[] = [
  {
    id: "1",
    name: "Novo",
    color: "#6366F1",
    order: 1,
    active: true,
    limit: 999,
  },
  {
    id: "2",
    name: "Em Atendimento",
    color: "#F59E0B",
    order: 2,
    active: true,
    limit: 999,
  },
  {
    id: "3",
    name: "Aguardando Cliente",
    color: "#0EA5E9",
    order: 3,
    active: true,
    limit: 999,
  },
  {
    id: "4",
    name: "Resolvido",
    color: "#22C55E",
    order: 4,
    active: true,
    limit: 999,
  },
  {
    id: "5",
    name: "Fechado",
    color: "#71717A",
    order: 5,
    active: true,
    limit: 999,
  },
];