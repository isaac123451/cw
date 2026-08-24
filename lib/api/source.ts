import { Case } from "@/lib/models/case";

import { getPrisma } from "@/lib/prisma";

import {
  byChannel,
  Channel,
} from "@/lib/services/case.service";

import { fetchCases } from "@/lib/services/case.repository";

/**
 * Fonte de dados da API.
 *
 * Lê do banco, e só do banco. A troca vive aqui e só aqui: as rotas não
 * sabem de onde veio.
 *
 * **Sem banco, devolve vazio.** Havia um retorno de dados de
 * demonstração aqui, e este é o pior lugar possível para isso: quem
 * consome esta API é o **CW Engine**, outro sistema, que não tem como
 * saber que os dados são inventados. Ele integraria 334 reclamações de
 * consumidores que não existem e as trataria como operação real.
 *
 * Uma resposta vazia é um problema visível — some indicador, alguém
 * pergunta. Uma resposta com ficção é um problema invisível, e
 * invisível é o que não se conserta.
 */
export async function getApiCases(
  channel?: Channel
): Promise<Case[]> {

  const prisma = getPrisma();

  if (!prisma) return [];

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
