import { revalidateTag } from "next/cache";

import {
  autenticar,
  responder,
  responderPreVoo,
  semSessao,
} from "@/lib/api/extensao";

import { WORKSPACE_TAG } from "@/lib/actions/tags";
import { getPrisma } from "@/lib/prisma";
import { REFERENCE_DATE } from "@/lib/services/reputation.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A agenda do dia, dentro da extensão.
 *
 * O que estava marcado para hoje e o que ficou para trás — e o botão de
 * dar baixa. É a outra metade do que a extensão já fazia: ela avisava
 * por notificação que havia tarefa parada, mas concluir exigia abrir a
 * aplicação, então a lista envelhecia mesmo com o trabalho feito.
 *
 * **Atrasado vem junto, e primeiro.** Uma agenda que só mostra "hoje"
 * esconde exatamente o que não foi feito ontem, que é o que mais
 * importa.
 */

interface Entrada {
  id?: string;
  concluida?: boolean;
}

export async function GET(request: Request) {

  const { usuario, demonstracao } =
    await autenticar(request);

  if (!usuario && !demonstracao) {
    return semSessao(request);
  }

  const prisma = getPrisma();

  if (!prisma) {
    return responder(request, {
      hoje: REFERENCE_DATE,
      itens: [],
    });
  }

  /**
   * A data de referência da operação, não a do relógio.
   *
   * É a mesma regra do resto da aplicação — usar `new Date()` aqui faria
   * a extensão discordar da tela de Agenda sobre o que é "hoje".
   */
  const hoje = REFERENCE_DATE;

  const limite = new Date(`${hoje}T23:59:59Z`);

  const linhas = await prisma.agendaTask.findMany({
    where: {
      done: false,
      dueDate: { lte: limite },
    },
    include: {
      owner: { select: { name: true } },
      case: {
        select: { protocol: true, title: true },
      },
    },
    orderBy: { dueDate: "asc" },
    take: 40,
  });

  const origem = new URL(request.url).origin;

  return responder(request, {
    hoje,

    itens: linhas.map((item) => {

      const dia = item.dueDate
        .toISOString()
        .slice(0, 10);

      return {
        id: item.id,
        titulo: item.title,
        tipo: item.type,
        prioridade: item.priority,
        quando: dia,
        atrasada: dia < hoje,
        responsavel: item.owner?.name,
        protocolo: item.case?.protocol,
        caso: item.case?.title,
      };
    }),

    url: `${origem}/agenda`,
  });
}

/** Dar baixa — ou desfazer, que é o que torna o clique seguro. */
export async function POST(request: Request) {

  const { usuario, demonstracao } =
    await autenticar(request);

  if (!usuario && !demonstracao) {
    return semSessao(request);
  }

  if (usuario && usuario.papel === "LEITURA") {
    return responder(
      request,
      {
        erro: "Seu acesso é somente leitura — não dá para concluir tarefa.",
      },
      403
    );
  }

  const prisma = getPrisma();

  if (!prisma) {
    return responder(
      request,
      { erro: "Sem banco configurado — não há onde gravar." },
      503
    );
  }

  let entrada: Entrada;

  try {
    entrada = (await request.json()) as Entrada;
  } catch {
    return responder(
      request,
      { erro: "Corpo inválido." },
      400
    );
  }

  const id = (entrada.id ?? "").trim();

  if (!id) {
    return responder(
      request,
      { erro: "Faltou o id da tarefa." },
      400
    );
  }

  const alteradas = await prisma.agendaTask.updateMany({
    where: { id },
    data: { done: entrada.concluida !== false },
  });

  if (alteradas.count === 0) {
    return responder(
      request,
      { erro: "Essa tarefa não existe mais." },
      404
    );
  }

  revalidateTag(WORKSPACE_TAG, "max");

  return responder(request, {
    concluida: entrada.concluida !== false,
    id,
  });
}

export function OPTIONS(request: Request) {
  return responderPreVoo(request);
}
