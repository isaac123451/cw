import { PrismaClient } from "@prisma/client";

import {
  listarRespostas,
  RespostaImportada,
  temWootric,
  traduzir,
} from "@/lib/services/wootric.service";

import { prazoPrimeiroContato } from "@/lib/services/nps.service";
import { STATUS_SEM_TRATATIVA } from "@/lib/models/nps";

/**
 * A importação do Wootric, fora do arquivo de server actions.
 *
 * **Por que não vive em `lib/actions/nps.ts`.** Aquele arquivo começa
 * com `"use server"`, e nele toda função exportada vira server action —
 * um endpoint que o navegador alcança pelo id, sem passar por rota
 * nenhuma.
 *
 * `importarDoWootric` não confere papel, e isso é deliberado: quem a
 * chama já autorizou — a action da tela exige AGENTE, a rota de cron
 * exige o segredo dela. Exportada de um arquivo `"use server"`, essa
 * mesma ausência virava porta aberta: qualquer um poderia disparar uma
 * importação inteira. Foi o `check:seguranca` que apontou, listando-a
 * como "sem checagem".
 *
 * Aqui ela é uma função comum. Para chamá-la é preciso ser código do
 * servidor — e o servidor já decidiu quem pode.
 */


export interface ResultadoImportacao {
  erro?: string;
  lidas: number;
  novas: number;
  atualizadas: number;
  semTratativa: number;
  desde: string;
  ate?: string;

  /**
   * Parou no teto — ainda há resposta esperando.
   *
   * A tela chama de novo até isto vir falso. É o que faz uma
   * importação grande caber em várias requisições curtas em vez de uma
   * que a Vercel corta no meio.
   */
  parcial?: boolean;

  /** De onde a próxima rodada deve continuar. */
  proximoDesde?: string;
}

/**
 * Quantas respostas uma rodada processa.
 *
 * Não é limite do Wootric nem do banco: é o **relógio da plataforma**.
 * Uma server action na Vercel tem dezenas de segundos, e a leitura são
 * idas e voltas de 50 em 50 à API deles. Uma rodada de 800 respostas
 * não termina — e o sintoma não diz isso: a requisição é cortada e o
 * botão devolve um erro de rede genérico, que parece integração
 * quebrada quando é só trabalho demais para uma requisição.
 *
 * Sessenta cabe com folga. O que passa disso vira a próxima rodada.
 */
const TETO_POR_RODADA = Number(
  process.env.WOOTRIC_TETO ?? 60
);

/**
 * Grava um lote no banco.
 *
 * Cinco por vez, e não todas de uma vez: é o mesmo teto que
 * `case.repository.ts` já usa: o pooler do Supabase no plano gratuito
 * derruba a conexão com paralelismo maior.
 *
 * O que a importação **não** sobrescreve: status, tipo, causa raiz,
 * responsável, tentativas e todo o pós-contato. Isso é trabalho da
 * operação — reimportar a mesma janela não pode desfazer uma tratativa.
 */
async function gravarLote(
  prisma: PrismaClient,
  itens: RespostaImportada[]
) {

  let novas = 0;
  let atualizadas = 0;
  let semTratativa = 0;

  const existentes = new Set(
    (
      await prisma.npsResponse.findMany({
        where: {
          externalId: {
            in: itens.map((i) => i.externalId),
          },
        },
        select: { externalId: true },
      })
    ).map((r) => r.externalId as string)
  );

  for (let i = 0; i < itens.length; i += 5) {

    const lote = itens.slice(i, i + 5);

    await Promise.all(
      lote.map(async (item) => {

        const jaExiste = existentes.has(item.externalId);

        const doWootric = {
          score: item.score,
          comment: item.comment,
          respondedAt: item.respondedAt,
          customer: item.customer,
          email: item.email || null,
          phone: item.phone || null,
          company: item.company || null,
          externalCompanyId:
            item.externalCompanyId || null,

          /*
            As anotações do painel do Wootric.

            Lista inteira, e não acréscimo: a origem é o Wootric, então
            reimportar tem de refletir o que está lá agora — inclusive
            uma nota apagada de lá. Acumular deixaria a ficha com
            anotações que já não existem na fonte.
          */
          wootricNotes: item.notasDoWootric,

          source: "Wootric",
        };

        if (jaExiste) {
          await prisma.npsResponse.update({
            where: { externalId: item.externalId },
            data: doWootric,
          });

          atualizadas += 1;
          return;
        }

        await prisma.npsResponse.create({
          data: {
            ...doWootric,
            externalId: item.externalId,

            firstContactDueAt: prazoPrimeiroContato(
              item.respondedAt,
              item.score,
              null
            ),

            status: item.exigeTratativa
              ? "Novo"
              : STATUS_SEM_TRATATIVA,

            /**
             * Promotor calado nasce fechado, com a data da própria
             * resposta: deixar `closedAt` nulo faria a tela mostrar um
             * encerramento sem quando.
             */
            closedAt: item.exigeTratativa
              ? null
              : item.respondedAt,

            outcome: item.exigeTratativa
              ? null
              : STATUS_SEM_TRATATIVA,
          },
        });

        novas += 1;

        if (!item.exigeTratativa) semTratativa += 1;
      })
    );
  }

  return { novas, atualizadas, semTratativa };
}

/**
 * A importação em si, sem exigir sessão de ninguém.
 *
 * Separada da action de propósito, e o motivo é um defeito medido: a
 * rotina diária passou a chamar a importação e recebia **"Sessão
 * expirada. Entre novamente."** Ela autentica pelo próprio token de
 * cron e não tem usuário nenhum logado — `requireRole` a recusava, e o
 * recurso nascia morto sem que nada quebrasse: o cron respondia 200, o
 * campo de erro ficava no JSON, e a base envelhecia em silêncio.
 *
 * A autorização é de quem chama: a action de tela exige AGENTE, a rota
 * de cron exige o segredo dela. As duas chegam aqui já autorizadas, e
 * esta função só se ocupa de ler o Wootric e gravar.
 */
export async function importarDoWootric(
  prisma: PrismaClient,
  input?: {
    dias?: number;
    ateDias?: number;
    desdeIso?: string;
  }
): Promise<ResultadoImportacao> {

  const ctx = { prisma };

  const vazio = {
    lidas: 0,
    novas: 0,
    atualizadas: 0,
    semTratativa: 0,
    desde: "",
  };

  if (!temWootric()) {
    return {
      ...vazio,
      erro: "Wootric não configurado. Defina WOOTRIC_CLIENT_ID e WOOTRIC_CLIENT_SECRET.",
    };
  }

  let desde: Date;

  if (input?.desdeIso) {
    desde = new Date(input.desdeIso);
  } else if (input?.dias) {
    desde = new Date(
      Date.now() - input.dias * 86400000
    );
  } else {

    const ultima = await ctx.prisma.npsResponse.findFirst({
      where: { source: "Wootric" },
      orderBy: { respondedAt: "desc" },
      select: { respondedAt: true },
    });

    desde = ultima
      ? new Date(ultima.respondedAt.getTime() - 3600000)
      : new Date(Date.now() - 7 * 86400000);
  }

  const ate = input?.ateDias
    ? new Date(Date.now() - input.ateDias * 86400000)
    : undefined;

  try {

    /**
     * Lê no máximo uma rodada, e grava exatamente o que leu.
     *
     * O teto entra nos dois lados: na leitura, para não gastar o tempo
     * da requisição em idas ao Wootric; e no corte abaixo, porque a
     * última página traz 50 de uma vez e pode passar do teto.
     */
    const brutas = await listarRespostas(
      desde,
      undefined,
      ate,
      TETO_POR_RODADA
    );

    const todos = brutas
      .map(traduzir)
      .filter(
        (item): item is RespostaImportada =>
          item !== null
      )
      /**
       * Da mais antiga para a mais nova.
       *
       * A ordem importa por causa da continuação: a rodada seguinte
       * parte da última gravada, então gravar fora de ordem deixaria
       * um buraco no meio da janela que ninguém voltaria a preencher.
       */
      .sort(
        (a, b) =>
          a.respondedAt.getTime() -
          b.respondedAt.getTime()
      );

    const itens = todos.slice(0, TETO_POR_RODADA);

    const parcial = todos.length > itens.length;

    const contas = await gravarLote(ctx.prisma, itens);

    /*
      A invalidação do cache é de quem chama, não daqui.

      `updateTag` só existe dentro de uma server action; a rota de cron
      chama esta mesma função e recebia o erro em cheio — outra vez com
      200 na resposta e a falha escondida num campo. Cada chamador
      invalida com o que lhe cabe: a tela com `updateTag`, para ler o
      valor novo na sequência; o cron com `revalidateTag`, que é o que
      um route handler pode.
    */

    const ultima = itens[itens.length - 1]?.respondedAt;

    return {
      ...contas,
      lidas: itens.length,
      desde: desde.toISOString(),
      ate: ultima?.toISOString(),

      /**
       * Só é parcial se houver de onde continuar.
       *
       * Sem a última data a tela repetiria a mesma janela para sempre,
       * que é pior do que parar.
       */
      parcial: parcial && Boolean(ultima),

      proximoDesde: ultima
        ? new Date(
            ultima.getTime() - 1000
          ).toISOString()
        : undefined,
    };

  } catch (erro) {
    return {
      ...vazio,
      desde: desde.toISOString(),
      erro:
        erro instanceof Error
          ? erro.message
          : "Falha ao falar com o Wootric.",
      parcial: false,
    };
  }
}
