"use server";

import { Case } from "@/lib/models/case";
import { mockCases } from "@/lib/data/mockCases";

import { getPrisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";

import {
  fetchCaseDescription,
  fetchCases,
  persistCase,
  removeCaseByProtocol,
} from "@/lib/services/case.repository";

/**
 * Gravação das reclamações, chamada direto pelas telas.
 *
 * São server actions e não rotas em `/api`: o middleware deixa `/api`
 * passar (a API pública tem autenticação por token), então um endpoint
 * de dados ali dentro nasceria sem proteção. Server action roda no
 * servidor com acesso ao cookie de sessão, que é o que vale aqui.
 *
 * O acesso ao Postgres em si fica em `case.repository` — aqui só mora a
 * autorização.
 */

/** Sem banco a aplicação roda aberta, em demonstração: nada a exigir. */
async function autorizado() {

  const prisma = getPrisma();

  if (!prisma) return null;

  const session = await getSession();

  if (!session) {
    throw new Error("Sessão expirada. Entre novamente.");
  }

  return prisma;
}

export async function listCases(): Promise<Case[]> {

  const prisma = getPrisma();

  // Modo demonstração: o dataset do repositório continua servindo.
  if (!prisma) return mockCases;

  return fetchCases(prisma);
}

/**
 * Relato completo de um caso.
 *
 * Fica fora da listagem por peso; a tela de detalhe busca ao abrir.
 */
export async function loadCaseDescription(
  protocol: string
): Promise<string> {

  const prisma = getPrisma();

  if (!prisma) {
    return (
      mockCases.find(
        (item) => item.protocol === protocol
      )?.description ?? ""
    );
  }

  return fetchCaseDescription(prisma, protocol);
}

export async function saveCase(
  item: Case,
  options?: { syncTags?: boolean }
) {

  const prisma = await autorizado();

  if (!prisma) return;

  await persistCase(prisma, item, options);
}

export async function deleteCase(protocol: string) {

  const prisma = await autorizado();

  if (!prisma) return;

  await removeCaseByProtocol(prisma, protocol);
}
