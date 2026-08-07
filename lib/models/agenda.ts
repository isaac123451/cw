export type TaskType =
  | "Follow-up"
  | "Cobrança interna"
  | "Solicitação de avaliação"
  | "Pendência"
  | "Recorrente";

export interface AgendaTask {
  id: string;

  title: string;

  type: TaskType;

  owner: string;

  dueDate: string;

  time?: string;

  priority: "Alta" | "Média" | "Baixa";

  done: boolean;

  relatedCase?: string;

  relatedCompany?: string;
}
