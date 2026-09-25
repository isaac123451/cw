import { autenticar, responder, responderPreVoo, semSessao } from "@/lib/api/extensao";
import { getPrisma } from "@/lib/prisma";
import { candidatosPelasPistas } from "@/lib/services/contatoConhecido.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * "Quem é este contato?" — candidatos pelo nome, quando o telefone não
 * achou ninguém. Só sugere: quem decide é a pessoa, no "É este".
 *
 * Desde a 1.83, também pelas pistas da conversa: a extensão manda só os
 * identificadores que o cliente escreveu — CPF/CNPJ, e-mail, endereço do
 * cardápio —, nunca o texto. Documento e e-mail acham a ficha mesmo
 * quando o nome não casa.
 */
export async function GET(request: Request) {
  const { usuario, demonstracao } = await autenticar(request);
  if (!usuario && !demonstracao) return semSessao(request);

  const prisma = getPrisma();
  if (!prisma) return responder(request, { candidatos: [] });

  const busca = new URL(request.url).searchParams;
  const lista = (chave: string) =>
    String(busca.get(chave) ?? "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean)
      .slice(0, 5);
  const pistas = {
    nome: String(busca.get("nome") ?? "").trim().slice(0, 120),
    documentos: lista("documentos"),
    emails: lista("emails"),
    slugs: lista("slugs"),
    perfil: String(busca.get("perfil") ?? "").trim().slice(0, 60),
  };
  if (!pistas.nome && !pistas.documentos.length && !pistas.emails.length && !pistas.slugs.length && !pistas.perfil) {
    return responder(request, { candidatos: [] });
  }

  try {
    return responder(request, { candidatos: await candidatosPelasPistas(prisma, pistas) });
  } catch (erro) {
    console.error("[extensao/quem-e]", erro);
    return responder(request, { erro: "Não deu para procurar agora." }, 500);
  }
}

export function OPTIONS(request: Request) {
  return responderPreVoo(request);
}
