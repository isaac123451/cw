import { revalidateTag } from "next/cache";

import {
  autenticar,
  responder,
  responderPreVoo,
  semSessao,
} from "@/lib/api/extensao";

import { WORKSPACE_TAG } from "@/lib/actions/tags";
import { getPrisma } from "@/lib/prisma";
import { hojeNaOperacao } from "@/lib/services/reputation.service";

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
      hoje: hojeNaOperacao(),
      itens: [],
    });
  }

  /**
   * A data de referência da operação, não a do relógio.
   *
   * É a mesma regra do resto da aplicação — usar `new Date()` aqui faria
   * a extensão discordar da tela de Agenda sobre o que é "hoje".
   */
  const hoje = hojeNaOperacao();

  const fimDeHoje = new Date(`${hoje}T23:59:59Z`);

  /**
   * O recorte que a aba de Atividades pede.
   *
   * O painel do dia mostra só o que está vencendo — é o que ele tem de
   * mostrar, porque divide espaço com a nota, os contadores e os
   * alertas. A aba é a tela inteira do assunto, e ali "o que vem pela
   * frente" e "o que eu já fechei hoje" são perguntas legítimas: sem a
   * primeira não dá para planejar a tarde, e sem a segunda a lista
   * esvazia sem deixar rastro de que o trabalho foi feito.
   */
  const escopo = (
    new URL(request.url).searchParams.get("escopo") ?? ""
  ).trim();

  const where =
    escopo === "proximos"
      ? {
          done: false,
          dueDate: {
            gt: fimDeHoje,
            lte: new Date(
              fimDeHoje.getTime() + 14 * 86400000
            ),
          },
        }
      : escopo === "concluidas"
        ? {
            done: true,
            dueDate: {
              gte: new Date(
                fimDeHoje.getTime() - 7 * 86400000
              ),
            },
          }
        : { done: false, dueDate: { lte: fimDeHoje } };

  const linhas = await prisma.agendaTask.findMany({
    where,
    include: {
      owner: { select: { name: true } },
      case: {
        select: { protocol: true, title: true },
      },
    },
    orderBy: { dueDate: "asc" },
    take: 40,
  });

  /**
   * As contagens dos três recortes, sempre.
   *
   * O chip precisa dizer quantos há do outro lado **antes** de alguém
   * clicar nele: uma barra de filtros que só sabe contar o recorte
   * aberto deixa de servir para escolher o próximo.
   */
  const inicioDeHoje = new Date(`${hoje}T00:00:00Z`);

  const [pendentes, atrasadas, proximos, concluidas] =
    await Promise.all([
      prisma.agendaTask.count({
        where: { done: false, dueDate: { lte: fimDeHoje } },
      }),
      /**
       * Contada no banco, e não sobre a lista devolvida.
       *
       * Sobre a lista, "atrasadas" daria zero sempre que o recorte
       * aberto fosse "próximos" — e o chip que existe para chamar de
       * volta quem se distraiu diria justamente que não há nada.
       */
      prisma.agendaTask.count({
        where: {
          done: false,
          dueDate: { lt: inicioDeHoje },
        },
      }),
      prisma.agendaTask.count({
        where: {
          done: false,
          dueDate: {
            gt: fimDeHoje,
            lte: new Date(
              fimDeHoje.getTime() + 14 * 86400000
            ),
          },
        },
      }),
      prisma.agendaTask.count({
        where: {
          done: true,
          dueDate: {
            gte: new Date(
              fimDeHoje.getTime() - 7 * 86400000
            ),
          },
        },
      }),
    ]);

  const origem = new URL(request.url).origin;

  const itens = linhas.map((item) => {

    const dia = item.dueDate.toISOString().slice(0, 10);

    return {
      id: item.id,
      titulo: item.title,
      tipo: item.type,
      prioridade: item.priority,
      quando: dia,
      /** HH:MM, quando quem marcou informou hora. */
      hora: item.time ?? null,
      atrasada: !item.done && dia < hoje,
      concluida: item.done,
      responsavel: item.owner?.name,
      protocolo: item.case?.protocol,
      caso: item.case?.title,
    };
  });

  return responder(request, {
    hoje,
    escopo,
    itens,

    /** Quantas de cada, para os chips da aba de Atividades. */
    contagens: {
      pendentes,
      atrasadas,
      proximos,
      concluidas,
    },

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
