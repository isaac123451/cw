import { revalidateTag } from "next/cache";

import {
  autenticar,
  responder,
  responderPreVoo,
  semSessao,
} from "@/lib/api/extensao";

import { CASES_TAG } from "@/lib/actions/tags";
import { digitosDoDocumento } from "@/lib/models/establishment";
import { getPrisma } from "@/lib/prisma";
import { lerTelefone } from "@/lib/services/contato.service";
import { completarContato } from "@/lib/services/raPortal.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/extensao/completar-pela-conversa
 *
 * O clique em "Completar" do painel: grava no caso o e-mail, telefone ou
 * CPF/CNPJ que o cliente escreveu na conversa. Usa a mesma regra do
 * vigia do Reclame Aqui (`completarContato`): só preenche campo vazio,
 * nunca troca o que já está lá — e o documento liga o estabelecimento
 * sozinho, quando o vínculo não foi escolhido à mão.
 */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(request: Request) {

  const { usuario, demonstracao } = await autenticar(request);

  if (!usuario && !demonstracao) return semSessao(request);

  if (!usuario || usuario.papel === "LEITURA") {
    return responder(request, { erro: "Seu acesso é somente leitura — não dá para completar o cadastro." }, 403);
  }

  const prisma = getPrisma();
  if (!prisma) return responder(request, { erro: "Sem banco configurado." }, 503);

  let corpo: { protocolo?: string; email?: string; telefone?: string; documento?: string };
  try {
    corpo = await request.json();
  } catch {
    return responder(request, { erro: "Corpo inválido." }, 400);
  }

  const protocolo = String(corpo.protocolo ?? "").trim().slice(0, 40);

  const caso = protocolo
    ? await prisma.case.findUnique({
        where: { protocol: protocolo },
        select: {
          id: true,
          customer: true,
          companyName: true,
          email: true,
          phone: true,
          document: true,
          city: true,
          state: true,
          establishmentId: true,
          establishmentManual: true,
        },
      })
    : null;

  if (!caso) return responder(request, { erro: "Este caso não está no CW Reputação." }, 404);

  /* O que chega é conferido de novo aqui: o painel sugere, o servidor decide. */
  const email = String(corpo.email ?? "").trim().toLowerCase().slice(0, 160);
  const telefone = lerTelefone(String(corpo.telefone ?? "").slice(0, 40));

  const completou = await completarContato(prisma, caso, {
    cliente: "",
    email: EMAIL.test(email) ? email : "",
    telefone: telefone?.completo ? telefone.digitos : "",
    documento: digitosDoDocumento(String(corpo.documento ?? "").slice(0, 30)),
    cidade: "",
    estado: "",
  });

  if (completou.length > 0) revalidateTag(CASES_TAG, { expire: 0 });

  return responder(request, { protocolo, completou });
}

export function OPTIONS(request: Request) {
  return responderPreVoo(request);
}
