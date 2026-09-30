export type TaskType =
  | "Follow-up"
  | "Cobrança interna"
  | "Solicitação de avaliação"
  | "Pendência"
  | "Recorrente"
  /** Compromisso com hora marcada — o que vai para a Agenda do Google (1.98). */
  | "Reunião";

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

  /** A frente (1.98); vazia é geral. */
  frente?: "reclame-aqui" | "redes" | "nps" | "google";
}
