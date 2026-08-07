import {
  JourneyEntry,
  JourneyStage,
  JourneyTopic,
} from "@/lib/models/journey";

export const mockJourneyStages: JourneyStage[] = [
  {
    id: "js-1",
    name: "Primeiro contato",
    color: "#6366F1",
    description:
      "Cliente abriu a primeira ocorrência com a operação.",
    order: 1,
    active: true,
  },
  {
    id: "js-2",
    name: "Em acompanhamento",
    color: "#F59E0B",
    description:
      "Tratativa em andamento, relacionamento ativo.",
    order: 2,
    active: true,
  },
  {
    id: "js-3",
    name: "Em risco",
    color: "#EF4444",
    description:
      "Sinais de insatisfação ou pedido de cancelamento.",
    order: 3,
    active: true,
  },
  {
    id: "js-4",
    name: "Recuperado",
    color: "#22C55E",
    description:
      "Cliente reconquistado após tratativa bem-sucedida.",
    order: 4,
    active: true,
  },
  {
    id: "js-5",
    name: "Promotor",
    color: "#7C3AED",
    description:
      "Avalia bem e voltaria a fazer negócio.",
    order: 5,
    active: true,
  },
];

export const mockJourneyTopics: JourneyTopic[] = [
  {
    id: "jt-1",
    name: "Pontos críticos",
    icon: "alert",
    color: "#EF4444",
    order: 1,
  },
  {
    id: "jt-2",
    name: "Oportunidades",
    icon: "target",
    color: "#22C55E",
    order: 2,
  },
  {
    id: "jt-3",
    name: "Combinados com o cliente",
    icon: "handshake",
    color: "#0EA5E9",
    order: 3,
  },
  {
    id: "jt-4",
    name: "Histórico de contato",
    icon: "phone",
    color: "#7C3AED",
    order: 4,
  },
];

export const mockJourneyEntries: JourneyEntry[] = [
  {
    id: "je-1",
    company: "Burger Prime",
    topicId: "jt-1",
    text: "Cobrança duplicada aconteceu duas vezes no mesmo trimestre — falha recorrente do faturamento.",
    author: "Carlos",
    createdAt: "2026-07-28",
  },
  {
    id: "je-2",
    company: "Burger Prime",
    topicId: "jt-3",
    text: "Combinado estorno em até 5 dias úteis e acompanhamento semanal até normalizar.",
    author: "Carlos",
    createdAt: "2026-07-29",
  },
  {
    id: "je-3",
    company: "Cantina do Chef",
    topicId: "jt-1",
    text: "Instabilidade no horário de pico gerou perda de vendas no fim de semana.",
    author: "Juliana",
    createdAt: "2026-08-01",
  },
  {
    id: "je-4",
    company: "Cantina do Chef",
    topicId: "jt-2",
    text: "Interessado no módulo de relatórios avançados quando a estabilidade normalizar.",
    author: "Juliana",
    createdAt: "2026-08-03",
  },
  {
    id: "je-5",
    company: "Grill & Cia",
    topicId: "jt-4",
    text: "Contato por telefone: cliente aceitou reavaliar o cancelamento após proposta de plano menor.",
    author: "Juliana",
    createdAt: "2026-08-04",
  },
];
