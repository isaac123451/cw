export interface Case {
  id: string;

  protocol: string;

  company: string;

  cnpj?: string;

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

  title: string;

  description: string;

  publicResponse?: string;

  score?: number;

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