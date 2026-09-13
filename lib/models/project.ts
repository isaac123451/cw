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

  /** De onde nasceu sozinho — "nps:<id>" para a revisão de um Erro Processual. */
  origem?: string;
}
