import { revalidateTag } from "next/cache";

import {
  autenticar,
  responder,
  responderPreVoo,
  semSessao,
} from "@/lib/api/extensao";

import { CASES_TAG } from "@/lib/actions/tags";
import { getPrisma } from "@/lib/prisma";
import { MAXIMO_DE_CONCORRENTES } from "@/lib/models/segmento";
import { gravarLeituras, validarLeitura, type LeituraDoSegmento } from "@/lib/services/segmento.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A reputação das empresas parecidas, lida pela extensão nas listas
 * públicas do Reclame Aqui uma vez por dia (1.107). Ver
 * `segmento.service.ts`.
 */
export async function POST(request: Request) {
  const { usuario, demonstracao } = await autenticar(request);

  if (!usuario && !demonstracao) return semSessao(request);

  if (!usuario || usuario.papel === "LEITURA") {
    return responder(request, { erro: "Seu acesso é somente leitura." }, 403);
  }

  const prisma = getPrisma();
  if (!prisma) return responder(request, { erro: "Sem banco configurado." }, 503);

  let corpo: { leituras?: unknown } = {};
  try {
    corpo = (await request.json()) as { leituras?: unknown };
  } catch {
    return responder(request, { erro: "Corpo inválido." }, 400);
  }

  const leituras = (Array.isArray(corpo.leituras) ? corpo.leituras.slice(0, MAXIMO_DE_CONCORRENTES + 1) : [])
    .map(validarLeitura)
    .filter((l): l is LeituraDoSegmento => l !== null);

  const gravados = leituras.length ? await gravarLeituras(prisma, leituras) : 0;
  if (gravados) revalidateTag(CASES_TAG, "max");

  return responder(request, { gravados });
}

export function OPTIONS(request: Request) {
  return responderPreVoo(request);
}
