"use server";

import { updateTag } from "next/cache";

import { requireRole, tryRole } from "@/lib/auth/guard";
import type { Modulo } from "@/lib/auth/modules";
import { WORKSPACE_TAG } from "@/lib/actions/tags";

/** O módulo a que estas ações pertencem — ver lib/auth/modules.ts. */
const MODULO: Modulo = "reclame-aqui";

/**
 * Anotações de uma reclamação.
 *
 * **A mesma tabela que a extensão escreve** (`CaseComment`), e é esse o
 * ponto: anotar pelo painel do WhatsApp ou pela tela do caso tem de dar
 * no mesmo lugar, senão são dois históricos paralelos do mesmo
 * atendimento e nenhum deles conta a história inteira.
 *
 * Até 21/08/2026 a tela **não gravava nada**: as anotações viviam num
 * `useState`, sumiam no recarregamento, e as que a extensão gravava não
 * apareciam ali. Era a mesma família de defeito de Times, Metas e
 * Clientes — o valor aparece na tela e não existe no banco.
 */

export interface CaseNote {
  id: string;
  text: string;
  author: string;
  createdAt: string;
}

export async function listCaseNotes(
  protocol: string
): Promise<CaseNote[]> {

  const ctx = await tryRole("LEITURA", MODULO);

  if (!ctx || !protocol) return [];

  const linhas = await ctx.prisma.caseComment.findMany({
    where: { case: { protocol } },
    include: { author: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return linhas.map((item) => ({
    id: item.id,
    text: item.body,
    author: item.author?.name ?? "—",
    createdAt: item.createdAt.toISOString(),
  }));
}

/**
 * Grava uma anotação.
 *
 * Exige **AGENTE**: é registro da rotina, e a checagem mora aqui e não
 * na tela — esconder o botão não impede a chamada direta da action.
 *
 * O autor vem da sessão, nunca de parâmetro: quem anotou é fato do
 * servidor, e aceitar o nome de fora deixaria a tela dizer quem
 * trabalhou.
 */
export async function addCaseNote(
  protocol: string,
  body: string
): Promise<CaseNote | null> {

  const ctx = await requireRole("AGENTE", MODULO);

  if (!ctx) return null;

  const texto = body.trim();

  if (!protocol || !texto) return null;

  const caso = await ctx.prisma.case.findUnique({
    where: { protocol },
    select: { id: true },
  });

  if (!caso) return null;

  const criada = await ctx.prisma.caseComment.create({
    data: {
      caseId: caso.id,
      authorId: ctx.userId,
      body: texto.slice(0, 4000),
    },
    include: { author: { select: { name: true } } },
  });

  updateTag(WORKSPACE_TAG);

  return {
    id: criada.id,
    text: criada.body,
    author: criada.author?.name ?? "—",
    createdAt: criada.createdAt.toISOString(),
  };
}
