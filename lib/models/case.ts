export interface Case {
  id: string;

  protocol: string;

  company: string;

  cnpj?: string;

  /**
   * Estabelecimento vinculado. O export do Reclame Aqui não traz essa
   * informação, então o vínculo é feito na tela — ver lib/models/establishment.ts.
   */
  establishmentId?: string;

  customer: string;

  email?: string;

  phone?: string;

  city?: string;

  state?: string;

  source: string;

  category: string;

  subcategory?: string;

  priority: "Crítica" | "Alta" | "Média" | "Baixa";

  status: string;

  owner?: string;

  department?: string;

  request?: string;

  churnRisk?: boolean;

  title: string;

  description: string;

  publicResponse?: string;

  score?: number;

  /** Consumidor avaliou o atendimento no Reclame Aqui. */
  evaluated?: boolean;

  resolved: boolean;

  wouldDoBusiness: boolean;

  responseTime?: string;

  solutionTime?: string;

  sla: string;

  createdAt: string;

  updatedAt?: string;

  lastInteraction?: string;

  tags?: string[];
}