import { revalidateTag } from "next/cache";

import { autenticar, responder, responderPreVoo, semSessao } from "@/lib/api/extensao";
import { CASES_TAG, WORKSPACE_TAG } from "@/lib/actions/tags";
import { getPrisma } from "@/lib/prisma";
import { acoesNaoVistas } from "@/lib/services/iaDoDia.service";
import { rodarSeJaPassou } from "@/lib/services/iaDoDiaRodada";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/* A rodada lê conversas, agenda e chama a IA: mais que o relógio padrão. */
export const maxDuration = 60;

/**
 * A IA do dia pelo relógio da extensão (04/11/2026).
 *
 * A rodada só acontecia com a plataforma aberta. A extensão fica ligada o
 * dia inteiro — no WhatsApp, no portal — e já acorda a cada 30 minutos
 * para o vigia; agora, na mesma hora, pede a rodada da IA da pessoa que
 * está conectada. Quem lê "o que a IA fez" continua sendo a plataforma
 * (os avisos com desfazer); aqui só volta quantas ações ainda não foram
 * vistas e os títulos, para um aviso único e discreto.
 */
export async function POST(request: Request) {
  const { usuario, demonstracao } = await autenticar(request);
  if (!usuario && !demonstracao) return semSessao(request);
  const prisma = getPrisma();
  if (!usuario || !prisma) return responder(request, { rodou: false, novas: [] });
  if (usuario.papel === "LEITURA") return responder(request, { rodou: false, novas: [] });

  try {
    const rodou = await rodarSeJaPassou(prisma, usuario.id);
    if (rodou) {
      revalidateTag(WORKSPACE_TAG, "max");
      revalidateTag(CASES_TAG, "max");
    }
    const novas = await acoesNaoVistas(prisma, usuario.id);
    return responder(request, {
      rodou,
      novas: novas.map((a) => ({ id: a.id, tipo: a.tipo, titulo: a.titulo })),
    });
  } catch (erro) {
    console.error("[extensao/ia-do-dia]", erro);
    return responder(request, { erro: "A IA do dia não rodou agora." }, 500);
  }
}

export function OPTIONS(request: Request) {
  return responderPreVoo(request);
}
