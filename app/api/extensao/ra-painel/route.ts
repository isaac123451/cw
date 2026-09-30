import { revalidateTag } from "next/cache";

import {
  autenticar,
  responder,
  responderPreVoo,
  semSessao,
} from "@/lib/api/extensao";

import { CASES_TAG } from "@/lib/actions/tags";
import { getPrisma } from "@/lib/prisma";
import { gravarPaineis, validarPainel } from "@/lib/services/painelDoPortal.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * O painel oficial do Reclame Aqui, lido pelo vigia na lista do portal
 * (1.86). Ver `painelDoPortal.service.ts`.
 */
export async function POST(request: Request) {
  const { usuario, demonstracao } = await autenticar(request);

  if (!usuario && !demonstracao) return semSessao(request);

  if (!usuario || usuario.papel === "LEITURA") {
    return responder(request, { erro: "Seu acesso é somente leitura." }, 403);
  }

  const prisma = getPrisma();
  if (!prisma) return responder(request, { erro: "Sem banco configurado." }, 503);

  let corpo: { paineis?: unknown } = {};
  try {
    corpo = (await request.json()) as { paineis?: unknown };
  } catch {
    return responder(request, { erro: "Corpo inválido." }, 400);
  }

  const paineis = (Array.isArray(corpo.paineis) ? corpo.paineis.slice(0, 12) : [])
    .map(validarPainel)
    .filter((p): p is NonNullable<typeof p> => p !== null);

  const gravados = paineis.length ? await gravarPaineis(prisma, paineis) : 0;
  if (gravados) revalidateTag(CASES_TAG, "max");

  return responder(request, { gravados });
}

export function OPTIONS(request: Request) {
  return responderPreVoo(request);
}
