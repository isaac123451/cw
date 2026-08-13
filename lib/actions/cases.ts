"use server";

import { unstable_cache, updateTag } from "next/cache";

import { CASES_TAG } from "@/lib/actions/tags";

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

/**
 * Leitura das reclamações, com cache no servidor.
 *
 * A consulta custa 650 ms morna e 2,2 s fria contra o Supabase em São
 * Paulo — e roda a cada abertura da aplicação, porque é o contexto que
 * alimenta todas as telas. O cálculo das telas, em comparação, leva
 * menos de 3 ms: a espera era toda ida e volta de rede.
 *
 * O cache é invalidado por etiqueta em cada gravação, então ninguém vê
 * dado velho depois de editar. O tempo de vida existe só para o caso de
 * outra pessoa alterar algo por outra sessão.
 */
const lerDoBanco = unstable_cache(
  async () => {

    const prisma = getPrisma();

    if (!prisma) return null;

    return fetchCases(prisma);
  },
  ["casos-lista"],
  { tags: [CASES_TAG], revalidate: 60 }
);

export async function listCases(): Promise<Case[]> {

  // Modo demonstração: o dataset do repositório continua servindo.
  if (!getPrisma()) return mockCases;

  return (await lerDoBanco()) ?? mockCases;
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

  // `updateTag` e não `revalidateTag`: garante que a própria sessão que
  // gravou leia o valor novo na sequência, sem esperar o cache expirar.
  updateTag(CASES_TAG);
}

export async function deleteCase(protocol: string) {

  const prisma = await autorizado();

  if (!prisma) return;

  await removeCaseByProtocol(prisma, protocol);

  // `updateTag` e não `revalidateTag`: garante que a própria sessão que
  // gravou leia o valor novo na sequência, sem esperar o cache expirar.
  updateTag(CASES_TAG);
}
