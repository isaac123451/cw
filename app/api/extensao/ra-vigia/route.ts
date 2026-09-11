import { revalidateTag } from "next/cache";

import {
  autenticar,
  responder,
  responderPreVoo,
  semSessao,
} from "@/lib/api/extensao";

import { CASES_TAG } from "@/lib/actions/tags";
import { getPrisma } from "@/lib/prisma";

import {
  EMPRESA_NO_PORTAL,
  gravarDoPortal,
  pendentesDoPortal,
  TETO_POR_VOLTA,
  validarReclamacao,
} from "@/lib/services/raPortal.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * O vigia do Reclame Aqui, do lado do servidor.
 *
 * A extensão confere a lista pública da Cardápio Web de tempos em
 * tempos, abre a página das reclamações que faltam e manda para cá o
 * que leu. **Quem decide o que grava é esta rota** — ver
 * `raPortal.service.ts`, onde estão as travas.
 *
 * GET devolve o que a extensão deve buscar além das novas: as
 * reclamações que a planilha deixou sem texto. POST grava.
 */

export async function GET(request: Request) {
  const { usuario, demonstracao } = await autenticar(request);

  if (!usuario && !demonstracao) {
    return semSessao(request);
  }

  const prisma = getPrisma();

  if (!prisma) {
    return responder(request, {
      empresa: EMPRESA_NO_PORTAL,
      pendentes: [],
      podeGravar: false,
    });
  }

  return responder(request, {
    empresa: EMPRESA_NO_PORTAL,
    pendentes: await pendentesDoPortal(prisma),

    /*
      Leitura não grava — e sabe disso antes de gastar a volta.

      Sem este campo, a extensão de quem só tem leitura buscaria as
      páginas do portal toda vez para ouvir um 403 no fim.
    */
    podeGravar: Boolean(usuario && usuario.papel !== "LEITURA"),
  });
}

export async function POST(request: Request) {
  const { usuario, demonstracao } = await autenticar(request);

  if (!usuario && !demonstracao) {
    return semSessao(request);
  }

  if (!usuario || usuario.papel === "LEITURA") {
    return responder(
      request,
      { erro: "Seu acesso é somente leitura — o vigia não grava por você." },
      403
    );
  }

  const prisma = getPrisma();

  if (!prisma) {
    return responder(
      request,
      { erro: "Sem banco configurado — não há onde gravar." },
      503
    );
  }

  let corpo: { reclamacoes?: unknown } = {};

  try {
    corpo = (await request.json()) as { reclamacoes?: unknown };
  } catch {
    return responder(request, { erro: "Corpo inválido." }, 400);
  }

  const brutas = Array.isArray(corpo.reclamacoes)
    ? corpo.reclamacoes.slice(0, TETO_POR_VOLTA)
    : [];

  const validas = brutas
    .map(validarReclamacao)
    .filter((r): r is NonNullable<typeof r> => r !== null);

  /* A mesma reclamação duas vezes no corpo vira uma. */
  const unicas = [
    ...new Map(validas.map((r) => [r.codigo, r])).values(),
  ];

  const resultado = await gravarDoPortal(prisma, unicas);

  if (
    resultado.criadas.length > 0 ||
    resultado.completadas.length > 0
  ) {
    /*
      `expire: 0` e não "max": quem recebe a notificação "2 reclamações
      novas" clica e abre o quadro na hora. Servir a lista velha nessa
      primeira abertura seria dizer que a notificação mentiu.
    */
    revalidateTag(CASES_TAG, { expire: 0 });
  }

  return responder(request, {
    ...resultado,
    ignoradas: brutas.length - validas.length,
  });
}

export function OPTIONS(request: Request) {
  return responderPreVoo(request);
}
