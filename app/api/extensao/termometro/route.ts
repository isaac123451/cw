import { autenticar, responder, responderPreVoo, semSessao } from "@/lib/api/extensao";
import { getPrisma } from "@/lib/prisma";
import { medirTermometro } from "@/lib/services/termometro.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * "Medir agora" do termômetro, pela extensão (09/10/2026): a satisfação de
 * 0 a 10 e a avaliação prevista do cliente aberto, gravadas na hora.
 * Recebe o protocolo do caso ou o id do NPS.
 */
export async function POST(request: Request) {
  const { usuario, demonstracao } = await autenticar(request);
  if (!usuario && !demonstracao) return semSessao(request);
  if (!usuario) return responder(request, { erro: "Entre na aplicação para medir." }, 401);
  if (usuario.papel === "LEITURA") return responder(request, { erro: "Seu acesso é somente leitura — não dá para medir." }, 403);

  const prisma = getPrisma();
  if (!prisma) return responder(request, { erro: "Sem banco configurado." }, 503);

  const corpo = (await request.json().catch(() => ({}))) as { protocolo?: string; npsId?: string };
  const protocolo = String(corpo.protocolo ?? "").trim().slice(0, 60);
  const npsId = String(corpo.npsId ?? "").trim().slice(0, 60);

  const caso = protocolo ? await prisma.case.findUnique({ where: { protocol: protocolo }, select: { id: true } }) : null;
  if (!caso && !npsId) return responder(request, { erro: "Abra um cliente com caso ou NPS para medir." }, 400);

  try {
    const r = await medirTermometro(prisma, caso ? { caseId: caso.id } : { npsResponseId: npsId });
    return r.ok ? responder(request, { ok: true, termometro: r.termometro }) : responder(request, { erro: r.erro }, 400);
  } catch (erro) {
    console.error("[extensao/termometro]", erro);
    return responder(request, { erro: "Não deu para medir agora. Tente de novo em instantes." }, 500);
  }
}

export function OPTIONS(request: Request) {
  return responderPreVoo(request);
}
