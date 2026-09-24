import { autenticar, responder, responderPreVoo, semSessao } from "@/lib/api/extensao";
import { getPrisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/extensao/aprender-resposta — a resposta sugerida que a
 * pessoa editou antes de copiar (Fase 28).
 *
 * O painel só manda quando o texto mudou. Fica guardado por pessoa: é o
 * jeito dela escrever que o próximo rascunho segue. Sem a tabela (antes
 * do `db:push`), responde que não guardou e o painel segue igual.
 */
export async function POST(request: Request) {
  const { usuario, demonstracao } = await autenticar(request);
  if (!usuario && !demonstracao) return semSessao(request);
  if (!usuario) return responder(request, { ok: false, guardado: false });

  const prisma = getPrisma();
  if (!prisma) return responder(request, { ok: false, guardado: false });

  const entrada = (await request.json().catch(() => ({}))) as { tom?: string; original?: string; editada?: string };
  const original = String(entrada.original ?? "").trim().slice(0, 3000);
  const editada = String(entrada.editada ?? "").trim().slice(0, 3000);
  if (original.length < 10 || editada.length < 10 || original === editada) return responder(request, { ok: true, guardado: false });

  try {
    await prisma.edicaoDeResposta.create({
      data: { userId: usuario.id, tom: String(entrada.tom ?? "").slice(0, 40) || "resposta", original, editada },
      select: { id: true },
    });
    return responder(request, { ok: true, guardado: true });
  } catch (erro) {
    const codigo = (erro as { code?: string })?.code;
    if (codigo !== "P2021" && codigo !== "P2022") console.error("[extensao/aprender-resposta]", erro);
    return responder(request, { ok: false, guardado: false });
  }
}

export function OPTIONS(request: Request) {
  return responderPreVoo(request);
}
