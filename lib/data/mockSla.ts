import { ANY_CATEGORY, SlaRule } from "@/lib/models/sla";

/**
 * Regras de partida, baseadas nas categorias que mais aparecem na base
 * real. Podem ser editadas e excluídas na tela de Processos.
 */
export const mockSlaRules: SlaRule[] = [
  {
    id: "sla-padrao",
    category: ANY_CATEGORY,
    responseHours: 48,
    solutionHours: 120,
    team: "Reputação",
    note: "Vale para qualquer caso sem regra mais específica.",
    active: true,
  },
  {
    id: "sla-critica",
    category: ANY_CATEGORY,
    priority: "Crítica",
    responseHours: 4,
    solutionHours: 24,
    team: "Reputação",
    note: "Prioridade crítica encurta o prazo em qualquer categoria.",
    active: true,
  },
  {
    id: "sla-financeiro",
    category: "Financeiro",
    responseHours: 24,
    solutionHours: 72,
    team: "Financeiro",
    note: "Cobrança e estorno envolvem dinheiro do cliente — prazo curto.",
    active: true,
  },
  {
    id: "sla-cancelamento",
    category: "Cancelamento",
    responseHours: 8,
    solutionHours: 48,
    team: "Retenção",
    note: "Janela de retenção: quanto mais rápido, maior a chance de reverter.",
    active: true,
  },
  {
    id: "sla-sistema",
    category: "Sistema",
    responseHours: 12,
    solutionHours: 72,
    team: "Tecnologia",
    note: "Indisponibilidade e erro travam a operação do estabelecimento.",
    active: true,
  },
  {
    id: "sla-atendimento",
    category: "Atendimento",
    responseHours: 24,
    solutionHours: 96,
    team: "Suporte",
    active: true,
  },
];
