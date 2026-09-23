import { autenticar, responder, responderPreVoo, semSessao } from "@/lib/api/extensao";
import { getPrisma } from "@/lib/prisma";
import { chaveDoContato, vincularContato, type TipoDeCandidato } from "@/lib/services/contatoConhecido.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * "É este cliente": liga o telefone do contato à ficha escolhida, para
 * sempre — ou desfaz (`desfazer: true`), quando foi engano. Tudo por
 * POST: é o método que a extensão já usa em todas as rotas.
 */
export async function POST(request: Request) {
  const { usuario, demonstracao } = await autenticar(request);
  if (!usuario && !demonstracao) return semSessao(request);
  if (!usuario) return responder(request, { erro: "Entre na aplicação para vincular o contato." }, 401);
  if (usuario.papel === "LEITURA") return responder(request, { erro: "Seu acesso é somente leitura — não dá para vincular." }, 403);

  const prisma = getPrisma();
  if (!prisma) return responder(request, { erro: "Sem banco configurado." }, 503);

  const entrada = (await request.json().catch(() => ({}))) as { telefone?: string; nome?: string; tipo?: string; ref?: string; desfazer?: boolean };

  if (entrada.desfazer) {
    const chave = chaveDoContato(String(entrada.telefone ?? ""));
    if (!chave) return responder(request, { erro: "Sem o telefone do contato." }, 400);
    /*
      O telefone que o vínculo completou no NPS sai junto: ficando, o
      mesmo número continuaria achando o cliente errado pelo telefone.
    */
    const vinculo = await prisma.contatoConhecido.findUnique({ where: { telefone: chave }, select: { npsResponseId: true } });
    if (vinculo?.npsResponseId) {
      await prisma.npsResponse.updateMany({ where: { id: vinculo.npsResponseId, phone: chave }, data: { phone: null } });
    }
    const r = await prisma.contatoConhecido.deleteMany({ where: { telefone: chave } });
    return responder(request, { ok: true, removidos: r.count });
  }

  const tipos: TipoDeCandidato[] = ["nps", "caso", "conta"];
  if (!tipos.includes(entrada.tipo as TipoDeCandidato) || !entrada.ref) return responder(request, { erro: "Escolha o cliente para vincular." }, 400);

  try {
    const r = await vincularContato(prisma, {
      telefone: String(entrada.telefone ?? ""),
      nome: entrada.nome,
      tipo: entrada.tipo as TipoDeCandidato,
      ref: String(entrada.ref).slice(0, 80),
      por: usuario.nome,
    });
    return r.ok ? responder(request, { ok: true }) : responder(request, { erro: r.erro }, 400);
  } catch (erro) {
    console.error("[extensao/vincular-contato]", erro);
    return responder(request, { erro: "O banco não aceitou agora. Tente de novo em instantes." }, 500);
  }
}

export function OPTIONS(request: Request) {
  return responderPreVoo(request);
}
