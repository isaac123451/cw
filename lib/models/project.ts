export type ProjectStage =
  | "Ideia"
  | "Planejado"
  | "Em andamento"
  | "Concluído";

export interface Project {
  id: string;

  title: string;

  description: string;

  stage: ProjectStage;

  owner: string;

  impact: "Alto" | "Médio" | "Baixo";

  progress: number;

  updatedAt: string;

  tags: string[];
}
