"use server";

import { can, requireRole } from "@/lib/auth/guard";

import {
  deliverWebhook,
  generateSecret,
} from "@/lib/services/webhook.service";

import { WebhookEvent } from "@/lib/models/webhook";

/**
 * Tela de Integrações, não bundle de `loadWorkspace`: é um registro só,
 * visitado raramente — não vale carregar em toda sessão como os outros
 * 12 contextos.
 */

/**
 * **ADMIN**, inclusive para ler.
 *
 * A configuração devolve o segredo de assinatura em texto puro — quem
 * o tem consegue forjar chamadas que o CW Engine aceitaria como
 * nossas. Não é informação para toda a operação.
 */
async function autorizado() {

  const ctx = await requireRole("ADMIN");

  return ctx?.prisma ?? null;
}

export async function getWebhookConfig() {

  const prisma = await autorizado();

  if (!prisma) return null;

  return prisma.webhookConfig.findFirst({
    orderBy: { createdAt: "asc" },
  });
}

/** A tela usa para decidir se mostra a página ou o aviso de acesso. */
export async function canManageIntegrations() {
  return can("ADMIN");
}

export async function getWebhookDeliveries(
  webhookId: string
) {

  const prisma = await autorizado();

  if (!prisma) return [];

  return prisma.webhookDelivery.findMany({
    where: { webhookId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
}

export async function saveWebhookConfig(input: {
  id?: string;
  url: string;
  active: boolean;
  events: WebhookEvent[];
}) {

  const prisma = await autorizado();

  if (!prisma) {
    throw new Error("Banco não configurado.");
  }

  if (input.id) {
    return prisma.webhookConfig.update({
      where: { id: input.id },
      data: {
        url: input.url,
        active: input.active,
        events: input.events,
      },
    });
  }

  return prisma.webhookConfig.create({
    data: {
      url: input.url,
      active: input.active,
      events: input.events,
      secret: generateSecret(),
    },
  });
}

export async function regenerateWebhookSecret(
  id: string
) {

  const prisma = await autorizado();

  if (!prisma) {
    throw new Error("Banco não configurado.");
  }

  return prisma.webhookConfig.update({
    where: { id },
    data: { secret: generateSecret() },
  });
}

export async function deleteWebhookConfig(id: string) {

  const prisma = await autorizado();

  if (!prisma) return;

  await prisma.webhookConfig.delete({ where: { id } });
}

export async function sendTestWebhook(id: string) {

  const prisma = await autorizado();

  if (!prisma) {
    return {
      ok: false,
      error: "Banco não configurado.",
    };
  }

  const webhook = await prisma.webhookConfig.findUnique({
    where: { id },
  });

  if (!webhook) {
    return { ok: false, error: "Webhook não encontrado." };
  }

  const ok = await deliverWebhook(prisma, webhook, "teste", {
    mensagem: "Disparo de teste do CW Reputação.",
  });

  return { ok };
}
