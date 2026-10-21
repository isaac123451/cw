import { createHash } from "node:crypto";

import { autenticar, responder, responderPreVoo, semSessao } from "@/lib/api/extensao";
import { getPrisma } from "@/lib/prisma";
import { semDadoSensivel } from "@/lib/models/aprendizados";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/extensao/erro — o erro não tratado que a extensão viu
 * (21/10/2026). O mesmo erro soma; documento e contato saem do texto.
 */
export async function POST(request: Request) {
  const { usuario, demonstracao } = await autenticar(request);
  if (!usuario && !demonstracao) return semSessao(request);
  if (demonstracao) return responder(request, { ok: true });

  let corpo: { onde?: unknown; mensagem?: unknown; pilha?: unknown; versao?: unknown } = {};
  try {
    corpo = await request.json();
  } catch {
    return responder(request, { erro: "Corpo inválido." }, 400);
  }

  const onde = String(corpo.onde ?? "").slice(0, 80) || "desconhecido";
  const mensagem = semDadoSensivel(String(corpo.mensagem ?? "")).slice(0, 500);
  const pilha = corpo.pilha ? semDadoSensivel(String(corpo.pilha)).slice(0, 2000) : null;
  const versao = String(corpo.versao ?? "").slice(0, 20) || "?";
  if (!mensagem) return responder(request, { erro: "Sem mensagem." }, 400);

  const prisma = getPrisma();
  if (!prisma) return responder(request, { ok: false, erro: "Sem banco configurado." }, 503);

  const chave = createHash("sha1").update(`${onde}|${mensagem}|${versao}`).digest("hex");
  try {
    await prisma.erroDaExtensao.upsert({
      where: { chave },
      create: { chave, onde, mensagem, pilha, versao, quem: usuario?.nome ?? null },
      update: { vezes: { increment: 1 }, ultimaEm: new Date(), quem: usuario?.nome ?? undefined },
    });
  } catch (erro) {
    console.error("[extensao] erro", erro);
  }
  return responder(request, { ok: true });
}

export function OPTIONS(request: Request) {
  return responderPreVoo(request);
}
