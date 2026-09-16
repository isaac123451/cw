import "server-only";

import type { PrismaClient } from "@prisma/client";

import type { PlaybookStep } from "@/lib/models/playbook";

import {
  trechosDaDocumentacao,
  type TrechoDaDocumentacao,
} from "@/lib/models/documentacao";

/**
 * A documentação guardada, procurável — para o agente citar em vez de
 * inventar (Fase 9.1).
 *
 * Aqui só mora a ida ao banco. A busca em si é texto puro e vive em
 * `lib/models/documentacao.ts`: assim a conferência roda sem servidor e
 * nenhuma tela arrasta o Prisma para o navegador por usá-la.
 */

export type { TrechoDaDocumentacao };
export { trechosParaOPrompt } from "@/lib/models/documentacao";

/**
 * Os trechos da documentação que respondem a esta pergunta.
 *
 * Vazio quando nada casa — e vazio é uma resposta: é o que faz o agente
 * dizer "a documentação não cobre isso" em vez de preencher o buraco.
 */
export async function trechosParaAPergunta(
  prisma: PrismaClient,
  pergunta: string,
  limite = 3
): Promise<TrechoDaDocumentacao[]> {

  const documentos = await prisma.playbook.findMany({
    select: { slug: true, title: true, conteudo: true, steps: true, rules: true },
    take: 60,
  });

  return trechosDaDocumentacao(
    documentos.map((d) => ({
      slug: d.slug,
      title: d.title,
      conteudo: d.conteudo,
      steps: (d.steps ?? []) as unknown as PlaybookStep[],
      rules: d.rules ?? [],
    })),
    pergunta,
    limite
  );
}
