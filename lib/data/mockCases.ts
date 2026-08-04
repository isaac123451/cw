import { Case } from "@/lib/models/case";

export const mockCases: Case[] = [
  {
    id: "1",

    protocol: "RA-20260001",

    company: "Pizzaria Itália",

    cnpj: "12.345.678/0001-99",

    customer: "João Pedro",

    email: "joao@email.com",

    phone: "(11)99999-9999",

    city: "São Paulo",

    state: "SP",

    source: "Reclame Aqui",

    category: "Entrega",

    subcategory: "Atraso",

    priority: "Alta",

    status: "Novo",

    owner: "Carlos",

    title: "Pedido não chegou",

    description:
      "Realizei um pedido às 20h e até agora não recebi nenhuma atualização.",

    publicResponse: "",

    score: 2,

    resolved: false,

    wouldDoBusiness: false,

    responseTime: "-",

    solutionTime: "-",

    sla: "2h",

    createdAt: "2026-07-30",

    updatedAt: "2026-07-30",

    lastInteraction: "Hoje",

    tags: ["Entrega", "Urgente"],
  },

  {
    id: "2",

    protocol: "RA-20260002",

    company: "Burger Prime",

    cnpj: "23.222.444/0001-22",

    customer: "Maria Fernanda",

    city: "Curitiba",

    state: "PR",

    source: "Reclame Aqui",

    category: "Financeiro",

    subcategory: "Cobrança",

    priority: "Crítica",

    status: "Em Atendimento",

    owner: "Carlos",

    title: "Cobrança em duplicidade",

    description:
      "Meu cartão foi debitado duas vezes pelo mesmo pedido.",

    publicResponse: "",

    score: 1,

    resolved: false,

    wouldDoBusiness: false,

    responseTime: "15min",

    solutionTime: "-",

    sla: "1h",

    createdAt: "2026-07-29",

    updatedAt: "2026-07-30",

    lastInteraction: "Hoje",

    tags: ["Financeiro"],
  },

  {
    id: "3",

    protocol: "RA-20260003",

    company: "Sushi House",

    cnpj: "55.444.333/0001-11",

    customer: "Ana Paula",

    city: "Campinas",

    state: "SP",

    source: "Reclame Aqui",

    category: "Produto",

    subcategory: "Qualidade",

    priority: "Média",

    status: "Resolvido",

    owner: "Carlos",

    title: "Produto chegou estragado",

    description:
      "O sashimi chegou com odor forte e impróprio para consumo.",

    publicResponse:
      "Pedimos desculpas pelo ocorrido. O reembolso foi realizado.",

    score: 8,

    resolved: true,

    wouldDoBusiness: true,

    responseTime: "20min",

    solutionTime: "3h",

    sla: "Concluído",

    createdAt: "2026-07-28",

    updatedAt: "2026-07-29",

    lastInteraction: "Ontem",

    tags: ["Produto"],
  },
];