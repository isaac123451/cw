"use server";

import { after } from "next/server";
import { unstable_cache, updateTag } from "next/cache";

import { CASES_TAG } from "@/lib/actions/tags";

import { Case } from "@/lib/models/case";

import { getPrisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/guard";
import type { Modulo } from "@/lib/auth/modules";

import {
  fetchCaseDescription,
  fetchCaseDossier,
  fetchCases,
  persistCase,
  removeCaseByProtocol,
} from "@/lib/services/case.repository";

import { toPublicCase } from "@/lib/api/source";
import { dispatchWebhookEvent } from "@/lib/services/webhook.service";

/** O módulo a que estas ações pertencem — ver lib/auth/modules.ts. */
const MODULO: Modulo = "reclame-aqui";

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

/**
 * Sem banco a aplicação roda aberta, em demonstração: nada a exigir.
 *
 * Com banco, gravar reclamação exige **pelo menos AGENTE** — conta de
 * leitura não altera a operação. A checagem mora aqui e não na tela:
 * esconder o botão não impede a chamada direta da server action.
 */
async function autorizado() {

  const ctx = await requireRole("AGENTE", MODULO);

  return ctx?.prisma ?? null;
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

  /**
   * **Sem banco, nenhuma reclamação — nunca dado inventado.**
   *
   * Até 23/08/2026 estas duas linhas eram
   * `if (!getPrisma()) return mockCases` e
   * `return (await lerDoBanco()) ?? mockCases`. A segunda é a grave: o
   * `??` disparava quando a **leitura falhava**, não só quando não
   * havia banco. Uma queda de conexão com o Supabase — coisa de
   * segundos, que acontece — fazia a plataforma inteira exibir 334
   * reclamações inventadas, com nomes de consumidores que não existem,
   * indistinguíveis das reais. Ninguém teria como perceber.
   *
   * Lista vazia é uma resposta ruim; lista falsa é uma resposta
   * perigosa. A tela vazia diz "não consegui carregar"; a tela cheia de
   * ficção diz "aqui está a sua operação".
   */
  return (await lerDoBanco()) ?? [];
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

  if (!prisma) return "";

  return fetchCaseDescription(prisma, protocol);
}

/**
 * O dossiê guardado deste caso.
 *
 * Consulta própria porque o dossiê não é campo editável: trazê-lo
 * junto com o relato obrigaria a empurrá-lo pelo rascunho da tela, e a
 * barra "Salvar" apareceria só de abrir o caso. Ver o comentário em
 * `fetchCaseDossier`.
 */
export async function loadDossie(protocol: string) {

  const prisma = getPrisma();

  if (!prisma) return null;

  return fetchCaseDossier(prisma, protocol);
}

export async function saveCase(
  item: Case,
  options?: { syncTags?: boolean }
) {

  const prisma = await autorizado();

  if (!prisma) return;

  /**
   * Lido antes de gravar só para saber se o caso é novo e se acabou de
   * ganhar avaliação — é o que distingue `caso.criado` de
   * `caso.avaliado` para quem escuta o webhook. Uma movimentação no
   * Kanban (`syncTags: false`) não bate em nenhum dos dois casos, então
   * não dispara nada extra no caminho mais frequente do quadro.
   */
  const anterior = await prisma.case.findUnique({
    where: { protocol: item.protocol },
    select: { evaluated: true },
  });

  await persistCase(prisma, item, options);

  // `updateTag` e não `revalidateTag`: garante que a própria sessão que
  // gravou leia o valor novo na sequência, sem esperar o cache expirar.
  updateTag(CASES_TAG);

  const evento = !anterior
    ? ("caso.criado" as const)
    : !anterior.evaluated && item.evaluated
    ? ("caso.avaliado" as const)
    : null;

  if (evento) {
    // `after`: dispara sem atrasar a resposta da gravação, mas sem
    // arriscar a função serverless encerrar antes do fetch terminar.
    after(() =>
      dispatchWebhookEvent(
        prisma,
        evento,
        toPublicCase(item),
        item.protocol
      )
    );
  }
}

export async function deleteCase(protocol: string) {

  const prisma = await autorizado();

  if (!prisma) return;

  await removeCaseByProtocol(prisma, protocol);

  // `updateTag` e não `revalidateTag`: garante que a própria sessão que
  // gravou leia o valor novo na sequência, sem esperar o cache expirar.
  updateTag(CASES_TAG);
}

/**
 * Apaga o dossiê guardado num caso.
 *
 * Precisa de ação própria porque `toCaseColumns` **não** escreve o
 * campo, e isso é deliberado: quem grava o dossiê é a rota da extensão,
 * que carimba autor e data junto. Se a tela o incluísse no caminho
 * normal de gravação, toda edição do caso o apagaria — a tela não o
 * carrega na lista para reenviar, e um campo ausente no formulário
 * viraria `null` no banco.
 *
 * Existe porque o dossiê envelhece. Ele é um retrato do caso no dia em
 * que foi montado; depois de três movimentações descreve um caso que já
 * não existe, e um texto desatualizado com cara de resumo oficial é
 * pior do que nenhum. Apagar é barato: monta-se outro pela extensão em
 * quinze segundos.
 */
export async function limparDossie(protocol: string) {

  const prisma = await autorizado();

  if (!prisma) return;

  await prisma.case.update({
    where: { protocol },
    data: {
      dossier: null,
      dossierAt: null,
      dossierBy: null,
    },
  });

  updateTag(CASES_TAG);
}
