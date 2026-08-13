import { Case } from "@/lib/models/case";
import { mockCases } from "@/lib/data/mockCases";

import { getPrisma } from "@/lib/prisma";

import {
  byChannel,
  Channel,
} from "@/lib/services/case.service";

import { fetchCases } from "@/lib/services/case.repository";

/**
 * Fonte de dados da API.
 *
 * Com `DATABASE_URL` configurado lê do banco — é o caminho de produção,
 * e é o que outro sistema da Cardápio Web consome. Sem banco, cai no
 * dataset do repositório, para a API continuar respondendo em
 * desenvolvimento e no modo demonstração.
 *
 * A troca vive aqui e só aqui: as rotas não sabem de onde veio.
 */
export async function getApiCases(
  channel?: Channel
): Promise<Case[]> {

  const prisma = getPrisma();

  if (!prisma) {
    return channel
      ? byChannel(mockCases, channel)
      : mockCases;
  }

  // Mesmo caminho que as telas usam — o mapeamento mora em um lugar só.
  const casos = await fetchCases(prisma);

  return channel ? byChannel(casos, channel) : casos;
}

/**
 * Caso como a API entrega.
 *
 * Sem e-mail e sem telefone: a base carrega dado de consumidor real, e
 * um endpoint de gestão não precisa de contato para responder "quantas
 * reclamações de Financeiro estouraram o prazo". Quem precisar falar com
 * o consumidor usa a tela, que tem o controle de acesso por sessão.
 */
export interface PublicCase {
  id: string;
  protocol: string;
  company: string;
  customer: string;
  city?: string;
  state?: string;
  source: string;
  category: string;
  subcategory?: string;
  priority: string;
  status: string;
  owner?: string;
  title: string;
  evaluated: boolean;
  score?: number;
  resolved: boolean;
  wouldDoBusiness: boolean;
  responseTime?: string;
  solutionTime?: string;
  answered: boolean;
  createdAt: string;
  updatedAt?: string;
  tags: string[];
}

export function toPublicCase(item: Case): PublicCase {
  return {
    id: item.id,
    protocol: item.protocol,
    company: item.company,
    customer: item.customer,
    city: item.city,
    state: item.state,
    source: item.source,
    category: item.category,
    subcategory: item.subcategory,
    priority: item.priority,
    status: item.status,
    owner: item.owner,
    title: item.title,
    evaluated: Boolean(item.evaluated),
    score: item.score,
    resolved: item.resolved,
    wouldDoBusiness: item.wouldDoBusiness,
    responseTime: item.responseTime,
    solutionTime: item.solutionTime,
    answered:
      (item.publicResponse ?? "").trim() !== "",
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    tags: item.tags ?? [],
  };
}
