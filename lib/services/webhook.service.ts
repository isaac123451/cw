import "server-only";

import { createHmac, randomBytes } from "node:crypto";

import { PrismaClient } from "@prisma/client";

/**
 * Os nomes dos eventos vivem em `lib/models/webhook.ts` porque a tela de
 * Integrações precisa deles e é client component — este módulo é
 * `server-only`.
 *
 * "Movimentação atrasada" é diferente dos outros dois: eles nascem de
 * uma gravação (`saveCase`), enquanto atraso é um estado que só se
 * descobre comparando com o relógio — não há gravação nenhuma no
 * instante em que ele acontece. Quem o dispara é a rotina agendada, em
 * `app/api/cron/route.ts`.
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
  caseProtocol?: string,
  /**
   * O corpo exato de uma tentativa anterior.
   *
   * O reenvio da rotina agendada manda o mesmo corpo, e não um novo:
   * uma mensagem reenviada com dados de agora não é a mesma mensagem,
   * e quem recebe não teria como notar a diferença.
   */
  corpoAnterior?: string,
  /** Em que tentativa estamos, para o histórico dizer. */
  attempts = 1
) {

  const timestamp = Math.floor(Date.now() / 1000);

  const body =
    corpoAnterior ??
    JSON.stringify({
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

      /**
       * O corpo fica guardado **só quando falha**.
       *
       * É o que a rotina agendada precisa para reenviar: remontar a
       * mensagem a partir do caso entregaria um retrato diferente do
       * que a primeira tentativa prometeu, porque o caso já mudou.
       *
       * Na entrega bem-sucedida não se guarda nada — seria uma segunda
       * cópia da base dentro da tabela de log.
       */
      payload: ok ? undefined : body,
      attempts,
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
