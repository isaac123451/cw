import { Establishment } from "@/lib/models/establishment";

/**
 * Exemplos de partida — o export do Reclame Aqui não traz estabelecimento,
 * então esta base é preenchida pela operação. São os três registros que já
 * existiam em mockCompanies, agora com os campos do cadastro real.
 *
 * Podem ser editados ou excluídos direto na tela.
 */
export const mockEstablishments: Establishment[] = [
  {
    id: "est-1",
    slug: "pizzaria-italia",
    name: "Pizzaria Itália",
    document: "00.000.000/0001-00",
    segment: "Pizzaria",
    city: "Goiânia",
    state: "GO",
    plan: "Premium",
    status: "Ativo",
    mrr: 349,
    owner: "Operação",
    startedAt: "2024-03-11",
    notes:
      "Exemplo de cadastro. Substitua pelos estabelecimentos reais da base.",
  },
  {
    id: "est-2",
    slug: "burger-prime",
    name: "Burger Prime",
    document: "11.111.111/0001-11",
    segment: "Hamburgueria",
    city: "Brasília",
    state: "DF",
    plan: "Essencial",
    status: "Em risco",
    mrr: 189,
    owner: "Operação",
    startedAt: "2025-01-20",
    notes:
      "Exemplo de cadastro. Substitua pelos estabelecimentos reais da base.",
  },
  {
    id: "est-3",
    slug: "sushi-house",
    name: "Sushi House",
    document: "22.222.222/0001-22",
    segment: "Japonês",
    city: "São Paulo",
    state: "SP",
    plan: "Enterprise",
    status: "Ativo",
    mrr: 890,
    owner: "Operação",
    startedAt: "2023-08-02",
    notes:
      "Exemplo de cadastro. Substitua pelos estabelecimentos reais da base.",
  },
];
