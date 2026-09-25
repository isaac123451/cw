import { revalidateTag } from "next/cache";

import { autenticar, responder, responderPreVoo, semSessao } from "@/lib/api/extensao";
import { CASES_TAG } from "@/lib/actions/tags";
import { getPrisma } from "@/lib/prisma";
import { loteDaVez, marcarItem, mudarLote } from "@/lib/services/disparos.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS(request: Request) {
  return responderPreVoo(request);
}

/**
 * A fila de disparos, do lado da extensão (1.78).
 *
 * `ler` devolve a lista da vez de quem está no WhatsApp; `enviado` e
 * `pulado` registram cada contato — o envio só conta depois de a
 * extensão ver a mensagem sair; `pausar`, `retomar` e `parar` mudam a
 * lista. Tudo responde depois de gravar.
 */
export async function POST(request: Request) {
  const { usuario, demonstracao } = await autenticar(request);
  if (!usuario) return demonstracao ? responder(request, { lote: null }) : semSessao(request);

  let corpo: { acao?: string; itemId?: string; loteId?: string; motivo?: string } = {};
  try {
    corpo = await request.json();
  } catch {
    return responder(request, { erro: "Corpo inválido." }, 400);
  }

  const prisma = getPrisma();
  if (!prisma) return responder(request, { lote: null });
  const autor = { id: usuario.id, nome: usuario.nome };

  try {
    if (corpo.acao === "enviado" || corpo.acao === "pulado") {
      if (!corpo.itemId) return responder(request, { erro: "Contato ausente." }, 400);
      const r = await marcarItem(prisma, corpo.itemId, corpo.acao, autor, corpo.motivo);
      if ("erro" in r) return responder(request, { erro: r.erro }, 409);
      if (corpo.acao === "enviado") revalidateTag(CASES_TAG, "max");
    } else if (corpo.acao === "pausar" || corpo.acao === "retomar" || corpo.acao === "parar") {
      if (!corpo.loteId) return responder(request, { erro: "Lista ausente." }, 400);
      const situacao = corpo.acao === "pausar" ? "pausado" : corpo.acao === "retomar" ? "ativo" : "parado";
      const r = await mudarLote(prisma, corpo.loteId, situacao, autor);
      if ("erro" in r) return responder(request, { erro: r.erro }, 409);
    }
    return responder(request, { lote: await loteDaVez(prisma, usuario.id) });
  } catch (erro) {
    console.error("[extensao/disparos]", erro);
    return responder(request, { erro: "O banco não aceitou agora. Tente de novo." }, 500);
  }
}
