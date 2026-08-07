export interface ProcessStep {
  name: string;
  owner: string;
}

export interface OperationProcess {
  id: string;

  name: string;

  description: string;

  area: string;

  owner: string;

  sla: string;

  status: "Ativo" | "Em revisão" | "Rascunho";

  updatedAt: string;

  steps: ProcessStep[];
}
