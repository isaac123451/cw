import {
  autenticar,
  responder,
  responderPreVoo,
  semSessao,
} from "@/lib/api/extensao";

import { validarConversas } from "@/lib/models/esperaNoWhatsapp";
import { getPrisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Conversas sem resposta (1.108): o retrato da lista do WhatsApp de quem
 * está com a extensão aberta, a cada minuto. Só nome ou número, minutos
 * e as etiquetas que o CW deu — ver `lib/models/esperaNoWhatsapp.ts`.
 * Troca o retrato inteiro: lista vazia é "ninguém esperando agora".
 */
export async function POST(request: Request) {
  const { usuario, demonstracao } = await autenticar(request);

  if (!usuario && !demonstracao) return semSessao(request);
  if (!usuario) return responder(request, { gravados: 0 });

  const prisma = getPrisma();
  if (!prisma) return responder(request, { erro: "Sem banco configurado." }, 503);

  let corpo: { conversas?: unknown } = {};
  try {
    corpo = (await request.json()) as { conversas?: unknown };
  } catch {
    return responder(request, { erro: "Corpo inválido." }, 400);
  }

  const conversas = validarConversas(corpo.conversas);
  const agora = new Date();

  await prisma.esperaNoWhatsapp.upsert({
    where: { userId: usuario.id },
    create: { userId: usuario.id, conversas: conversas as object[], lidoEm: agora },
    update: { conversas: conversas as object[], lidoEm: agora },
  });

  return responder(request, { gravados: conversas.length });
}

export function OPTIONS(request: Request) {
  return responderPreVoo(request);
}
