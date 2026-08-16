"use server";

import { updateTag } from "next/cache";

import { PrismaClient } from "@prisma/client";

import { requireRole, tryRole } from "@/lib/auth/guard";
import { WORKSPACE_TAG } from "@/lib/actions/tags";

import { NpsResponseView } from "@/lib/models/nps";
import { ProjectStage } from "@/lib/models/project";

import { prazoPrimeiroContato } from "@/lib/services/nps.service";

/**
 * Registro e tratativa do NPS.
 *
 * Gravar exige **AGENTE**: é operação da rotina, não configuração. A
 * checagem mora aqui e não na tela — esconder o botão não impede a
 * chamada direta da server action.
 */

function dia(value?: Date | null) {
  return value ? value.toISOString() : undefined;
}

export interface NpsDraft {
  id?: string;
  score: number;
  comment: string;
  respondedAt: string;
  customer: string;
  email?: string;
  phone?: string;
  company?: string;
  establishmentId?: string;
  kind?: string;
  rootCause?: string;
  owner?: string;
}

export async function listNpsResponses(): Promise<
  NpsResponseView[]
> {

  // Leitura: o provider monta no layout raiz e roda em `/login` também.
  const ctx = await tryRole("LEITURA");

  if (!ctx) return [];

  const linhas = await ctx.prisma.npsResponse.findMany({
    include: {
      owner: { select: { name: true } },
      attempts: { orderBy: { createdAt: "asc" } },
    },
    orderBy: { respondedAt: "desc" },
  });

  return linhas.map((r) => ({
    id: r.id,
    score: r.score,
    comment: r.comment,
    respondedAt: r.respondedAt.toISOString(),
    customer: r.customer,
    email: r.email ?? undefined,
    phone: r.phone ?? undefined,
    company: r.company ?? undefined,
    establishmentId: r.establishmentId ?? undefined,
    kind: r.kind ?? undefined,
    rootCause: r.rootCause ?? undefined,
    status: r.status,
    owner: r.owner?.name ?? undefined,
    firstContactDueAt:
      r.firstContactDueAt.toISOString(),
    firstContactAt: dia(r.firstContactAt),
    confirmedAt: dia(r.confirmedAt),
    closedAt: dia(r.closedAt),
    outcome: r.outcome ?? undefined,
    reviewAsked: r.reviewAsked,
    testimonialAsked: r.testimonialAsked,
    referralAsked: r.referralAsked,
    attempts: r.attempts.map((a) => ({
      id: a.id,
      channel: a.channel,
      note: a.note,
      actor: a.actor,
      createdAt: a.createdAt.toISOString(),
    })),
  }));
}

export async function saveNpsResponse(
  input: NpsDraft
) {

  const ctx = await requireRole("AGENTE");

  if (!ctx) return null;

  const respondedAt = new Date(input.respondedAt);

  const ownerId = input.owner
    ? (
        await ctx.prisma.user.findFirst({
          where: { name: input.owner },
          select: { id: true },
        })
      )?.id ?? null
    : null;

  const dados = {
    score: input.score,
    comment: input.comment,
    respondedAt,
    customer: input.customer,
    email: input.email || null,
    phone: input.phone || null,
    company: input.company || null,
    establishmentId: input.establishmentId || null,
    kind: input.kind || null,
    rootCause: input.rootCause || null,
    ownerId,
  };

  if (input.id) {

    /**
     * O prazo **não** é recalculado na edição: ele foi congelado no
     * registro. Reclassificar o tipo depois não pode reescrever o
     * compromisso que já estava valendo.
     */
    await ctx.prisma.npsResponse.update({
      where: { id: input.id },
      data: dados,
    });

    updateTag(WORKSPACE_TAG);

    return input.id;
  }

  const criado = await ctx.prisma.npsResponse.create({
    data: {
      ...dados,
      firstContactDueAt: prazoPrimeiroContato(
        respondedAt,
        input.score,
        input.kind
      ),
    },
    select: { id: true },
  });

  await gerarRevisaoDeProcesso(
    ctx.prisma,
    input,
    criado.id
  );

  updateTag(WORKSPACE_TAG);

  return criado.id;
}

/**
 * Erro Processual gera revisão de processo automaticamente.
 *
 * É exigência do guia: falha de processo tem de virar correção na
 * origem, senão o mesmo erro reaparece com outro cliente. Entra como
 * item em Projetos e Melhorias, que é onde a operação já acompanha esse
 * tipo de trabalho.
 */
async function gerarRevisaoDeProcesso(
  prisma: PrismaClient,
  input: NpsDraft,
  npsId: string
) {

  if (input.kind !== "Erro Processual") return;

  await prisma.project.create({
    data: {
      title: `Revisão de processo — ${input.customer}`,
      description: `Aberto automaticamente por um NPS classificado como Erro Processual (nota ${input.score}).\n\nRelato do cliente: ${input.comment || "(sem comentário)"}\n\nRegistro NPS: ${npsId}`,
      /**
       * Precisa ser um estágio que o quadro de Projetos conhece
       * (`ProjectStage`), senão o item nasce sem coluna e fica
       * invisível — mesmo defeito que "Nova reclamação" já teve no
       * Kanban.
       */
      stage: "Ideia" satisfies ProjectStage,
      owner: input.owner ?? "",
      impact: "Alto",
      tags: ["NPS", "Erro Processual"],
    },
  });
}

export async function registerNpsAttempt(input: {
  responseId: string;
  channel: string;
  note: string;
  actor: string;
}) {

  const ctx = await requireRole("AGENTE");

  if (!ctx) return;

  await ctx.prisma.npsAttempt.create({
    data: {
      responseId: input.responseId,
      channel: input.channel,
      note: input.note,
      actor: input.actor,
    },
  });

  /**
   * A primeira tentativa **é** o primeiro contato: sem isso o SLA
   * ficaria estourado para sempre mesmo com a operação tendo ligado.
   */
  await ctx.prisma.npsResponse.updateMany({
    where: {
      id: input.responseId,
      firstContactAt: null,
    },
    data: {
      firstContactAt: new Date(),
      status: "Em tratativa",
    },
  });

  updateTag(WORKSPACE_TAG);
}

export async function setNpsStatus(
  id: string,
  status: string,
  outcome?: string
) {

  const ctx = await requireRole("AGENTE");

  if (!ctx) return;

  const encerrando = status.startsWith("[Encerrado]");

  await ctx.prisma.npsResponse.update({
    where: { id },
    data: {
      status,
      outcome: outcome ?? (encerrando ? status : null),
      closedAt: encerrando ? new Date() : null,
    },
  });

  updateTag(WORKSPACE_TAG);
}

/** Registra a confirmação do cliente de que a questão foi resolvida. */
export async function confirmNpsResolution(
  id: string,
  confirmado: boolean
) {

  const ctx = await requireRole("AGENTE");

  if (!ctx) return;

  await ctx.prisma.npsResponse.update({
    where: { id },
    data: {
      confirmedAt: confirmado ? new Date() : null,
    },
  });

  updateTag(WORKSPACE_TAG);
}

/** Marcações do pós-elogio: review pública, depoimento, indicação. */
export async function setNpsAdvocacy(
  id: string,
  campo: "review" | "testimonial" | "referral",
  valor: boolean
) {

  const ctx = await requireRole("AGENTE");

  if (!ctx) return;

  const coluna = {
    review: "reviewAsked",
    testimonial: "testimonialAsked",
    referral: "referralAsked",
  }[campo];

  await ctx.prisma.npsResponse.update({
    where: { id },
    data: { [coluna]: valor },
  });

  updateTag(WORKSPACE_TAG);
}

export async function deleteNpsResponse(id: string) {

  // Apagar resposta de pesquisa altera indicador: é ato de ADMIN.
  const ctx = await requireRole("ADMIN");

  if (!ctx) return;

  await ctx.prisma.npsResponse.delete({ where: { id } });

  updateTag(WORKSPACE_TAG);
}

/** Aplica o encerramento automático por falta de retorno. */
export async function closeAbandonedNps(ids: string[]) {

  const ctx = await requireRole("AGENTE");

  if (!ctx || ids.length === 0) return 0;

  const r = await ctx.prisma.npsResponse.updateMany({
    where: { id: { in: ids } },
    data: {
      status: "[Encerrado] Sem Retorno",
      outcome: "[Encerrado] Sem Retorno",
      closedAt: new Date(),
    },
  });

  updateTag(WORKSPACE_TAG);

  return r.count;
}
