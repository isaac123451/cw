import { revalidateTag } from "next/cache";

import {
  autenticar,
  responder,
  responderPreVoo,
  semSessao,
} from "@/lib/api/extensao";

import { CASES_TAG } from "@/lib/actions/tags";
import { descreverFaltas } from "@/lib/models/case";
import { digitosDoDocumento } from "@/lib/models/establishment";
import { getPrisma } from "@/lib/prisma";

import {
  acharParaCompletar,
  completarContato,
  faltasDoBanco,
} from "@/lib/services/raPortal.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Completar, pela área da empresa, a reclamação que entrou sem o
 * consumidor.
 *
 * **O pedido.** "Os casos que foram adicionados não estarão com as
 * informações completas. Quero um botão no Kanban e na lista para
 * completar abrindo uma aba rápida." O vigia cria a reclamação pela
 * página pública, onde nome, contato e documento não aparecem. A área
 * da empresa mostra tudo — e a extensão já sabe ler essa página.
 *
 * GET pergunta o que falta; a extensão só oferece o botão quando falta
 * algo que a página tem. POST completa, **depois do clique**: nada é
 * gravado só por abrir a reclamação.
 *
 * Só onde está vazio, mascarado ou "Não informado" — ver
 * `completarContato`. Valor real não é trocado.
 */

function limpo(valor: unknown, teto: number) {
  return typeof valor === "string"
    ? valor.replace(/\s+/g, " ").trim().slice(0, teto)
    : "";
}

export async function GET(request: Request) {
  const { usuario, demonstracao } = await autenticar(request);

  if (!usuario && !demonstracao) {
    return semSessao(request);
  }

  const prisma = getPrisma();

  if (!prisma) {
    return responder(request, { existe: false });
  }

  const url = new URL(request.url);

  const caso = await acharParaCompletar(
    prisma,
    limpo(url.searchParams.get("cod"), 16),
    limpo(url.searchParams.get("id"), 12)
  );

  if (!caso) {
    return responder(request, { existe: false });
  }

  const faltam = faltasDoBanco(caso);

  return responder(request, {
    existe: true,
    protocolo: caso.protocol,
    faltam,
    descricao: descreverFaltas(faltam),
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
      { erro: "Seu acesso é somente leitura — não dá para completar reclamação." },
      403
    );
  }

  const prisma = getPrisma();

  if (!prisma) {
    return responder(request, { erro: "Sem banco configurado." }, 503);
  }

  let corpo: Record<string, unknown> = {};

  try {
    corpo = (await request.json()) as Record<string, unknown>;
  } catch {
    return responder(request, { erro: "Corpo inválido." }, 400);
  }

  const caso = await acharParaCompletar(
    prisma,
    limpo(corpo.cod, 16),
    limpo(corpo.id, 12)
  );

  if (!caso) {
    return responder(
      request,
      { erro: "Esta reclamação não está no quadro." },
      404
    );
  }

  const completou = await completarContato(prisma, caso, {
    cliente: limpo(corpo.cliente, 120),
    email: limpo(corpo.email, 160),
    telefone: limpo(corpo.telefone, 40),
    documento: digitosDoDocumento(limpo(corpo.documento, 30)),
    cidade: limpo(corpo.cidade, 80),
    estado: limpo(corpo.estado, 4),
  });

  if (completou.length > 0) {
    /* Quem está com o quadro aberto vê a reclamação completa na próxima leitura. */
    revalidateTag(CASES_TAG, { expire: 0 });
  }

  const depois = await prisma.case.findUniqueOrThrow({
    where: { id: caso.id },
    select: {
      channel: true,
      customer: true,
      email: true,
      phone: true,
      document: true,
    },
  });

  const faltam = faltasDoBanco(depois);

  return responder(request, {
    protocolo: caso.protocol,
    completou,
    faltam,
    descricao: descreverFaltas(faltam),
  });
}

export function OPTIONS(request: Request) {
  return responderPreVoo(request);
}
