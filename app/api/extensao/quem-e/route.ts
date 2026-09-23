import { autenticar, responder, responderPreVoo, semSessao } from "@/lib/api/extensao";
import { getPrisma } from "@/lib/prisma";
import { candidatosPorNome } from "@/lib/services/contatoConhecido.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * "Quem é este contato?" — candidatos pelo nome, quando o telefone não
 * achou ninguém. Só sugere: quem decide é a pessoa, no "É este".
 */
export async function GET(request: Request) {
  const { usuario, demonstracao } = await autenticar(request);
  if (!usuario && !demonstracao) return semSessao(request);

  const prisma = getPrisma();
  if (!prisma) return responder(request, { candidatos: [] });

  const nome = String(new URL(request.url).searchParams.get("nome") ?? "").trim().slice(0, 120);
  if (!nome) return responder(request, { candidatos: [] });

  try {
    return responder(request, { candidatos: await candidatosPorNome(prisma, nome) });
  } catch (erro) {
    console.error("[extensao/quem-e]", erro);
    return responder(request, { erro: "Não deu para procurar pelo nome agora." }, 500);
  }
}

export function OPTIONS(request: Request) {
  return responderPreVoo(request);
}
