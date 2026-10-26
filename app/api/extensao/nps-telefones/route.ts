import {
  autenticar,
  responder,
  responderPreVoo,
  semSessao,
} from "@/lib/api/extensao";

import { getPrisma } from "@/lib/prisma";

import {
  gravarDoPortalCw,
  pendentesDeTelefone,
  validarLido,
} from "@/lib/services/telefoneDoPortal.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * O telefone do NPS pelo portal da Cardápio Web (26/10/2026).
 *
 * GET devolve os `company_id` a buscar; POST grava o que a extensão leu no
 * portal. Quem busca é a extensão, numa aba do portal, com a sessão de quem
 * está logado — o token do portal não passa por aqui. Ver
 * `telefoneDoPortal.service.ts`.
 */

const TETO = 60;

export async function GET(request: Request) {
  const { usuario, demonstracao } = await autenticar(request);
  if (!usuario && !demonstracao) return semSessao(request);

  const prisma = getPrisma();
  const podeGravar = Boolean(usuario && usuario.papel !== "LEITURA");
  if (!prisma || !podeGravar) return responder(request, { pedidos: [], podeGravar });

  return responder(request, { pedidos: await pendentesDeTelefone(prisma, new Date(), 40), podeGravar });
}

export async function POST(request: Request) {
  const { usuario, demonstracao } = await autenticar(request);
  if (!usuario && !demonstracao) return semSessao(request);
  if (!usuario || usuario.papel === "LEITURA") {
    return responder(request, { erro: "Seu acesso é somente leitura." }, 403);
  }

  const prisma = getPrisma();
  if (!prisma) return responder(request, { erro: "Sem banco configurado." }, 503);

  let corpo: { lidos?: unknown } = {};
  try {
    corpo = (await request.json()) as { lidos?: unknown };
  } catch {
    return responder(request, { erro: "Corpo inválido." }, 400);
  }

  const lidos = (Array.isArray(corpo.lidos) ? corpo.lidos : [])
    .slice(0, TETO)
    .map(validarLido)
    .filter((l): l is NonNullable<typeof l> => l !== null);

  const resultado = await gravarDoPortalCw(prisma, lidos);

  return responder(request, resultado);
}

export function OPTIONS(request: Request) {
  return responderPreVoo(request);
}
