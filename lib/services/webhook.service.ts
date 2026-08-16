import "server-only";

import { createHmac, randomBytes } from "node:crypto";

import { PrismaClient } from "@prisma/client";

/**
 * Os nomes dos eventos vivem em `lib/models/webhook.ts` porque a tela de
 * Integrações precisa deles e é client component — este módulo é
 * `server-only`.
 *
 * "Movimentação atrasada" ficou de fora de propósito: os dois eventos
 * atuais nascem de uma gravação (`saveCase`), mas atraso é um estado que
 * só se descobre comparando com o relógio — precisa de um job agendado
 * (cron) rodando sem ninguém com a tela aberta, e isso ainda não existe
 * aqui. Ver ROADMAP.md.
 */
import type { WebhookEvent } from "@/lib/models/webhook";

const TIMEOUT_MS = 10_000;

/** Só as últimas tentativas por webhook viram histórico — rastro, não auditoria. */
const HISTORICO_MAXIMO = 50;

export function generateSecret() {
  return randomBytes(24).toString("hex");
}

/**
 * Assina `timestamp.corpo` com HMAC-SHA256, no padrão que Stripe e
 * GitHub usam para webhook: o timestamp entra na assinatura para quem
 * recebe poder recusar reenvios fora de uma janela, não só validar a
 * chave.
 */
export function signPayload(
  secret: string,
  timestamp: number,
  rawBody: string
) {
  return createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
}

interface WebhookTarget {
  id: string;
  url: string;
  secret: string;
}

/** Envia e grava o resultado — usado tanto pelo disparo real quanto pelo teste manual. */
export async function deliverWebhook(
  prisma: PrismaClient,
  webhook: WebhookTarget,
  event: string,
  data: unknown,
  caseProtocol?: string
) {

  const timestamp = Math.floor(Date.now() / 1000);

  const body = JSON.stringify({
    evento: event,
    criadoEm: new Date().toISOString(),
    dados: data,
  });

  const signature = signPayload(
    webhook.secret,
    timestamp,
    body
  );

  let ok = false;
  let statusCode: number | null = null;
  let error: string | null = null;

  try {

    const res = await fetch(webhook.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-cw-event": event,
        "x-cw-signature": `t=${timestamp},v1=${signature}`,
      },
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    ok = res.ok;
    statusCode = res.status;

  } catch (err) {
    error =
      err instanceof Error
        ? err.message
        : "Falha desconhecida ao entregar o webhook.";
  }

  await prisma.webhookDelivery.create({
    data: {
      webhookId: webhook.id,
      event,
      ok,
      statusCode: statusCode ?? undefined,
      error: error ?? undefined,
      caseProtocol,
    },
  });

  const antigas = await prisma.webhookDelivery.findMany({
    where: { webhookId: webhook.id },
    orderBy: { createdAt: "desc" },
    skip: HISTORICO_MAXIMO,
    select: { id: true },
  });

  if (antigas.length > 0) {
    await prisma.webhookDelivery.deleteMany({
      where: {
        id: { in: antigas.map((item) => item.id) },
      },
    });
  }

  return ok;
}

/**
 * Ponto de entrada chamado pela gravação de caso. Não faz nada se não
 * houver webhook ativo inscrito no evento — é o caminho comum enquanto
 * ninguém configurou nada em Integrações.
 */
export async function dispatchWebhookEvent(
  prisma: PrismaClient,
  event: WebhookEvent,
  data: unknown,
  caseProtocol?: string
) {

  const webhook = await prisma.webhookConfig.findFirst({
    where: { active: true, events: { has: event } },
  });

  if (!webhook) return;

  await deliverWebhook(
    prisma,
    webhook,
    event,
    data,
    caseProtocol
  );
}
