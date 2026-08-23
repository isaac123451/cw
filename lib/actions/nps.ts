"use server";

import * as XLSX from "xlsx";

import { updateTag } from "next/cache";

import { PrismaClient } from "@prisma/client";

import { requireRole, tryRole } from "@/lib/auth/guard";
import type { Modulo } from "@/lib/auth/modules";
import { WORKSPACE_TAG } from "@/lib/actions/tags";

import {
  NpsResponseView,
  moodOf,
  ROOT_CAUSES,
  RootCauseOption,
  segmentOf,
  STATUS_SEM_TRATATIVA,
} from "@/lib/models/nps";
import { ProjectStage } from "@/lib/models/project";

import { prazoPrimeiroContato } from "@/lib/services/nps.service";
import {
  aplicarPosContato,
  registrarTentativa,
} from "@/lib/services/nps.repository";

import {
  FormatoInvalido,
  parseNpsPlanilha,
} from "@/lib/services/npsImport.service";

import {
  listarRespostas,
  RespostaImportada,
  temWootric,
  traduzir,
} from "@/lib/services/wootric.service";

/** O módulo a que estas ações pertencem — ver lib/auth/modules.ts. */
const MODULO: Modulo = "nps";

/**
 * Registro e tratativa do NPS.
 *
 * Gravar exige **AGENTE**: é operação da rotina, não configuração. A
 * checagem mora aqui e não na tela — esconder o botão não impede a
 * chamada direta da server action.
 */

function dia(value?: Date | null) {
  return value ? value.toISOString() : undefined;
}

export interface NpsDraft {
  id?: string;
  score: number;
  comment: string;
  respondedAt: string;
  customer: string;
  email?: string;
  phone?: string;
  company?: string;
  establishmentId?: string;
  kind?: string;
  rootCause?: string;
  owner?: string;
}

export async function listNpsResponses(): Promise<
  NpsResponseView[]
> {

  // Leitura: o provider monta no layout raiz e roda em `/login` também.
  const ctx = await tryRole("LEITURA", MODULO);

  if (!ctx) return [];

  const linhas = await ctx.prisma.npsResponse.findMany({
    include: {
      owner: { select: { name: true } },
      attempts: { orderBy: { createdAt: "asc" } },
    },
    orderBy: { respondedAt: "desc" },
  });

  return linhas.map((r) => ({
    id: r.id,
    score: r.score,
    comment: r.comment,
    respondedAt: r.respondedAt.toISOString(),
    customer: r.customer,
    email: r.email ?? undefined,
    phone: r.phone ?? undefined,
    company: r.company ?? undefined,
    establishmentId: r.establishmentId ?? undefined,
    kind: r.kind ?? undefined,
    rootCause: r.rootCause ?? undefined,
    status: r.status,
    owner: r.owner?.name ?? undefined,
    firstContactDueAt:
      r.firstContactDueAt.toISOString(),
    firstContactAt: dia(r.firstContactAt),
    confirmedAt: dia(r.confirmedAt),
    closedAt: dia(r.closedAt),
    outcome: r.outcome ?? undefined,
    reviewAsked: r.reviewAsked,
    testimonialAsked: r.testimonialAsked,
    referralAsked: r.referralAsked,
    source: r.source,
    externalId: r.externalId ?? undefined,
    moodAfter: r.moodAfter ?? undefined,
    resolvedAfter: r.resolvedAfter ?? undefined,
    postContactNote: r.postContactNote ?? undefined,
    postContactAt: dia(r.postContactAt),
    postContactBy: r.postContactBy ?? undefined,
    attempts: r.attempts.map((a) => ({
      id: a.id,
      channel: a.channel,
      note: a.note,
      actor: a.actor,
      createdAt: a.createdAt.toISOString(),
    })),
  }));
}

/* ============================================================
   CAUSA RAIZ — CADASTRO
============================================================ */

/**
 * Lista as causas cadastradas.
 *
 * Banco vazio devolve os valores de partida de `ROOT_CAUSES`, com id
 * derivado do nome: assim a tela funciona antes de qualquer cadastro e
 * antes do seed, sem um caso especial dentro do formulário.
 */
export async function listNpsRootCauses(): Promise<
  RootCauseOption[]
> {

  const ctx = await tryRole("LEITURA", MODULO);

  if (!ctx) {
    return ROOT_CAUSES.map((name, i) => ({
      id: `padrao-${i}`,
      name,
      order: i,
      active: true,
    }));
  }

  const linhas = await ctx.prisma.npsRootCause.findMany({
    orderBy: [{ order: "asc" }, { name: "asc" }],
  });

  if (linhas.length === 0) {
    return ROOT_CAUSES.map((name, i) => ({
      id: `padrao-${i}`,
      name,
      order: i,
      active: true,
    }));
  }

  return linhas.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description ?? undefined,
    order: r.order,
    active: r.active,
  }));
}

export async function saveNpsRootCause(
  input: RootCauseOption
) {

  const ctx = await requireRole("AGENTE", MODULO);

  if (!ctx) return null;

  const nome = input.name.trim();

  if (nome === "") return null;

  const dados = {
    name: nome,
    description: input.description?.trim() || null,
    order: input.order,
    active: input.active,
  };

  /**
   * Id que começa com "padrao-" é um valor de partida que nunca foi
   * gravado: editar um deles cria o registro, em vez de falhar tentando
   * atualizar uma linha que não existe.
   */
  const novo =
    !input.id || input.id.startsWith("padrao-");

  if (novo) {
    const criado = await ctx.prisma.npsRootCause.create({
      data: dados,
      select: { id: true },
    });

    await semearRestantes(ctx.prisma, nome);

    updateTag(WORKSPACE_TAG);

    return criado.id;
  }

  const anterior =
    await ctx.prisma.npsRootCause.findUnique({
      where: { id: input.id },
      select: { name: true },
    });

  await ctx.prisma.npsRootCause.update({
    where: { id: input.id },
    data: dados,
  });

  /**
   * Renomear a causa tem de arrastar os registros junto: a resposta
   * guarda o **nome**, e sem isto o gráfico de tendência passaria a
   * mostrar a causa antiga e a nova como coisas diferentes.
   */
  if (anterior && anterior.name !== nome) {
    await ctx.prisma.npsResponse.updateMany({
      where: { rootCause: anterior.name },
      data: { rootCause: nome },
    });
  }

  updateTag(WORKSPACE_TAG);

  return input.id;
}

/**
 * Ao gravar a primeira causa, materializa as de partida.
 *
 * Sem isto, criar uma causa nova faria as nove originais sumirem da
 * tela de uma vez — porque a listagem deixa de cair no padrão assim que
 * existe qualquer linha no banco.
 */
async function semearRestantes(
  prisma: PrismaClient,
  exceto: string
) {

  const total = await prisma.npsRootCause.count();

  if (total > 1) return;

  await prisma.npsRootCause.createMany({
    data: ROOT_CAUSES.filter(
      (name) => name !== exceto
    ).map((name, i) => ({ name, order: i })),
    skipDuplicates: true,
  });
}

export async function removeNpsRootCause(id: string) {

  const ctx = await requireRole("AGENTE", MODULO);

  if (!ctx || id.startsWith("padrao-")) return;

  const alvo = await ctx.prisma.npsRootCause.findUnique({
    where: { id },
    select: { name: true },
  });

  if (!alvo) return;

  const emUso = await ctx.prisma.npsResponse.count({
    where: { rootCause: alvo.name },
  });

  /**
   * Causa já usada é **desativada**, não apagada. Apagar reescreveria o
   * passado: as respostas que apontam para ela ficariam sem causa, e a
   * série histórica mudaria sozinha.
   */
  if (emUso > 0) {
    await ctx.prisma.npsRootCause.update({
      where: { id },
      data: { active: false },
    });
  } else {
    await ctx.prisma.npsRootCause.delete({
      where: { id },
    });
  }

  updateTag(WORKSPACE_TAG);

  return emUso;
}

export async function saveNpsResponse(
  input: NpsDraft
) {

  const ctx = await requireRole("AGENTE", MODULO);

  if (!ctx) return null;

  const respondedAt = new Date(input.respondedAt);

  const ownerId = input.owner
    ? (
        await ctx.prisma.user.findFirst({
          where: { name: input.owner },
          select: { id: true },
        })
      )?.id ?? null
    : null;

  const dados = {
    score: input.score,
    comment: input.comment,
    respondedAt,
    customer: input.customer,
    email: input.email || null,
    phone: input.phone || null,
    company: input.company || null,
    establishmentId: input.establishmentId || null,
    kind: input.kind || null,
    rootCause: input.rootCause || null,
    ownerId,
  };

  if (input.id) {

    /**
     * O prazo **não** é recalculado na edição: ele foi congelado no
     * registro. Reclassificar o tipo depois não pode reescrever o
     * compromisso que já estava valendo.
     */
    await ctx.prisma.npsResponse.update({
      where: { id: input.id },
      data: dados,
    });

    updateTag(WORKSPACE_TAG);

    return input.id;
  }

  const criado = await ctx.prisma.npsResponse.create({
    data: {
      ...dados,
      firstContactDueAt: prazoPrimeiroContato(
        respondedAt,
        input.score,
        input.kind
      ),
    },
    select: { id: true },
  });

  await gerarRevisaoDeProcesso(
    ctx.prisma,
    input,
    criado.id
  );

  updateTag(WORKSPACE_TAG);

  return criado.id;
}

/**
 * Erro Processual gera revisão de processo automaticamente.
 *
 * É exigência do guia: falha de processo tem de virar correção na
 * origem, senão o mesmo erro reaparece com outro cliente. Entra como
 * item em Projetos e Melhorias, que é onde a operação já acompanha esse
 * tipo de trabalho.
 */
async function gerarRevisaoDeProcesso(
  prisma: PrismaClient,
  input: NpsDraft,
  npsId: string
) {

  if (input.kind !== "Erro Processual") return;

  await prisma.project.create({
    data: {
      title: `Revisão de processo — ${input.customer}`,
      description: `Aberto automaticamente por um NPS classificado como Erro Processual (nota ${input.score}).\n\nRelato do cliente: ${input.comment || "(sem comentário)"}\n\nRegistro NPS: ${npsId}`,
      /**
       * Precisa ser um estágio que o quadro de Projetos conhece
       * (`ProjectStage`), senão o item nasce sem coluna e fica
       * invisível — mesmo defeito que "Nova reclamação" já teve no
       * Kanban.
       */
      stage: "Ideia" satisfies ProjectStage,
      owner: input.owner ?? "",
      impact: "Alto",
      tags: ["NPS", "Erro Processual"],
    },
  });
}

export async function registerNpsAttempt(input: {
  responseId: string;
  channel: string;
  note: string;
  actor: string;
}) {

  const ctx = await requireRole("AGENTE", MODULO);

  if (!ctx) return;

  await registrarTentativa(ctx.prisma, input);

  updateTag(WORKSPACE_TAG);
}

export async function setNpsStatus(
  id: string,
  status: string,
  outcome?: string
) {

  const ctx = await requireRole("AGENTE", MODULO);

  if (!ctx) return;

  const encerrando = status.startsWith("[Encerrado]");

  await ctx.prisma.npsResponse.update({
    where: { id },
    data: {
      status,
      outcome: outcome ?? (encerrando ? status : null),
      closedAt: encerrando ? new Date() : null,
    },
  });

  updateTag(WORKSPACE_TAG);
}

/**
 * Pós-contato: a régua de humor e o "resolveu ou não".
 *
 * A regra mora em `lib/services/nps.repository.ts`, e não aqui, porque
 * a extensão de navegador registra o mesmo pós-contato por uma rota
 * (`/api/extensao/nps`) que autentica pelo cabeçalho e não pode chamar
 * server action. Aqui ficam só sessão, papel e invalidação de cache.
 */
export async function registerPostContact(input: {
  id: string;
  mood?: number | null;
  resolved?: boolean | null;
  note?: string;
  actor?: string;
}) {

  const ctx = await requireRole("AGENTE", MODULO);

  if (!ctx) return;

  await aplicarPosContato(ctx.prisma, input);

  updateTag(WORKSPACE_TAG);
}

/** Registra a confirmação do cliente de que a questão foi resolvida. */
export async function confirmNpsResolution(
  id: string,
  confirmado: boolean
) {

  const ctx = await requireRole("AGENTE", MODULO);

  if (!ctx) return;

  await ctx.prisma.npsResponse.update({
    where: { id },
    data: {
      confirmedAt: confirmado ? new Date() : null,
    },
  });

  updateTag(WORKSPACE_TAG);
}

/** Marcações do pós-elogio: review pública, depoimento, indicação. */
export async function setNpsAdvocacy(
  id: string,
  campo: "review" | "testimonial" | "referral",
  valor: boolean
) {

  const ctx = await requireRole("AGENTE", MODULO);

  if (!ctx) return;

  const coluna = {
    review: "reviewAsked",
    testimonial: "testimonialAsked",
    referral: "referralAsked",
  }[campo];

  await ctx.prisma.npsResponse.update({
    where: { id },
    data: { [coluna]: valor },
  });

  updateTag(WORKSPACE_TAG);
}

export async function deleteNpsResponse(id: string) {

  // Apagar resposta de pesquisa altera indicador: é ato de ADMIN.
  const ctx = await requireRole("ADMIN", MODULO);

  if (!ctx) return;

  await ctx.prisma.npsResponse.delete({ where: { id } });

  updateTag(WORKSPACE_TAG);
}

/* ============================================================
   IMPORTAÇÃO DO WOOTRIC
============================================================ */

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
 * Puxa as respostas do Wootric.
 *
 * **De onde parte.** Sem `dias`, continua de onde parou: a resposta mais
 * nova já importada, com uma hora de recuo para pegar quem chegou
 * atrasado. Com `dias`, refaz a janela inteira — é o caminho do
 * backfill, e reimportar não duplica porque a chave é o `externalId`.
 *
 * **Por que a janela padrão é curta.** São ~790 respostas por mês. Uma
 * janela de 90 dias são mais de 2.000 registros, e uma server action
 * chamada pelo botão da tela não tem tempo de vida para isso na Vercel.
 * Janela grande é trabalho de script: `npm run nps:wootric -- --dias=365`.
 */
export async function importWootric(input?: {
  dias?: number;
  /**
   * Fim da janela, também em dias atrás. É o que permite fatiar: a tela
   * pede "de 90 a 60 dias atrás", depois "de 60 a 30", e assim por
   * diante. Cada chamada termina dentro do tempo de vida de uma server
   * action, e um ano inteiro (~9.500 respostas) deixa de ser uma
   * requisição que a Vercel corta no meio.
   */
  ateDias?: number;

  /**
   * Continuar de um instante exato, em vez do começo da janela.
   *
   * É o que a tela devolve para a rodada seguinte quando a anterior
   * parou no teto. Sem isso, a rodada seguinte recomeçaria do começo
   * da mesma janela e releria tudo de novo — e nunca chegaria ao fim.
   */
  desdeIso?: string;
}): Promise<ResultadoImportacao> {

  const ctx = await requireRole("AGENTE", MODULO);

  const vazio = {
    lidas: 0,
    novas: 0,
    atualizadas: 0,
    semTratativa: 0,
    desde: "",
  };

  if (!ctx) {
    return {
      ...vazio,
      erro: "Sem banco configurado — a importação precisa de onde gravar.",
    };
  }

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

    updateTag(WORKSPACE_TAG);

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

/* ============================================================
   IMPORTAÇÃO POR PLANILHA
============================================================ */

export interface ResultadoDaPlanilha {
  erro?: string;
  lidas: number;
  novas: number;
  atualizadas: number;
  ignoradas: { linha: number; motivo: string }[];
  de?: string;
  ate?: string;
}

/**
 * Lê uma planilha de NPS e grava no banco.
 *
 * O Reclame Aqui já entrava por planilha; o NPS só entrava pela API do
 * Wootric. Ficavam de fora a pesquisa que roda fora do Wootric, o
 * histórico anterior à integração e a correção em massa — exportar,
 * arrumar e devolver.
 *
 * **O que a planilha não sobrescreve:** status, responsável, tentativas
 * e todo o pós-contato. Nota, comentário, contato, tipo e causa raiz,
 * sim — são justamente os campos que alguém arruma numa planilha. Um
 * arquivo que reabrisse ciclos encerrados desfaria trabalho de semanas
 * sem ninguém pedir.
 */
export async function importNpsPlanilha(
  _estado: ResultadoDaPlanilha,
  formData: FormData
): Promise<ResultadoDaPlanilha> {

  const vazio = {
    lidas: 0,
    novas: 0,
    atualizadas: 0,
    ignoradas: [],
  };

  const ctx = await requireRole("AGENTE", MODULO);

  if (!ctx) {
    return {
      ...vazio,
      erro: "Sem banco configurado — a importação precisa de onde gravar.",
    };
  }

  const arquivo = formData.get("arquivo");

  if (
    !(arquivo instanceof File) ||
    arquivo.size === 0
  ) {
    return {
      ...vazio,
      erro: "Selecione um arquivo .xlsx ou .csv.",
    };
  }

  let lidas;

  try {

    lidas = parseNpsPlanilha(
      Buffer.from(await arquivo.arrayBuffer())
    );

  } catch (erro) {

    if (erro instanceof FormatoInvalido) {
      return { ...vazio, erro: erro.message };
    }

    console.error("[nps] leitura da planilha falhou", erro);

    return {
      ...vazio,
      erro: "Não foi possível ler a planilha. Confira se é um .xlsx ou .csv válido.",
    };
  }

  let novas = 0;
  let atualizadas = 0;

  /**
   * Cinco por vez, como a importação do Wootric.
   *
   * É o mesmo teto que `case.repository.ts` respeita: o pooler do
   * Supabase no plano gratuito derruba a conexão com paralelismo maior.
   */
  for (let i = 0; i < lidas.itens.length; i += 5) {

    const lote = lidas.itens.slice(i, i + 5);

    await Promise.all(
      lote.map(async (item) => {

        const existente =
          await ctx.prisma.npsResponse.findUnique({
            where: { externalId: item.externalId },
            select: { id: true },
          });

        const daPlanilha = {
          score: item.score,
          comment: item.comment,
          respondedAt: item.respondedAt,
          customer: item.customer,
          email: item.email ?? null,
          phone: item.phone ?? null,
          company: item.company ?? null,
          kind: item.kind ?? null,
          rootCause: item.rootCause ?? null,
          source: "Planilha",
        };

        if (existente) {
          await ctx.prisma.npsResponse.update({
            where: { id: existente.id },
            data: daPlanilha,
          });
          atualizadas += 1;
          return;
        }

        await ctx.prisma.npsResponse.create({
          data: {
            ...daPlanilha,
            externalId: item.externalId,

            firstContactDueAt: prazoPrimeiroContato(
              item.respondedAt,
              item.score,
              item.kind
            ),

            status: item.exigeTratativa
              ? "Novo"
              : STATUS_SEM_TRATATIVA,

            closedAt: item.exigeTratativa
              ? null
              : item.respondedAt,

            outcome: item.exigeTratativa
              ? null
              : STATUS_SEM_TRATATIVA,
          },
        });

        novas += 1;
      })
    );
  }

  updateTag(WORKSPACE_TAG);

  return {
    lidas: lidas.itens.length,
    novas,
    atualizadas,
    ignoradas: lidas.ignoradas,
    de: lidas.de,
    ate: lidas.ate,
  };
}

/** Aplica o encerramento automático por falta de retorno. */
export async function closeAbandonedNps(ids: string[]) {

  const ctx = await requireRole("AGENTE", MODULO);

  if (!ctx || ids.length === 0) return 0;

  const r = await ctx.prisma.npsResponse.updateMany({
    where: { id: { in: ids } },
    data: {
      status: "[Encerrado] Sem Retorno",
      outcome: "[Encerrado] Sem Retorno",
      closedAt: new Date(),
    },
  });

  updateTag(WORKSPACE_TAG);

  return r.count;
}

/* ============================================================
   EXPORTAÇÃO
============================================================ */

/**
 * Exporta as respostas para .xlsx.
 *
 * Devolve base64: server action não transporta binário puro, então a
 * tela remonta o arquivo e dispara o download — o mesmo caminho que a
 * exportação do Reclame Aqui já usa em `lib/actions/transfer.ts`.
 *
 * Exporta **o recorte que está na tela**, não a base inteira: quem
 * filtrou por "fora do prazo" e clicou em exportar quer aqueles, não os
 * 789. Sem `ids`, exporta tudo.
 */
export async function exportNps(ids?: string[]): Promise<{
  erro?: string;
  arquivo?: string;
  nome?: string;
  total?: number;
}> {

  const ctx = await tryRole("LEITURA", MODULO);

  if (!ctx) {
    return {
      erro: "Sem banco configurado — não há o que exportar.",
    };
  }

  const linhas = await ctx.prisma.npsResponse.findMany({
    where:
      ids && ids.length > 0
        ? { id: { in: ids } }
        : undefined,
    include: {
      owner: { select: { name: true } },
      attempts: { orderBy: { createdAt: "asc" } },
    },
    orderBy: { respondedAt: "desc" },
  });

  const quando = (v?: Date | null) =>
    v ? v.toISOString().slice(0, 16).replace("T", " ") : "";

  const planilha = linhas.map((r) => ({
    Nota: r.score,
    Segmento: segmentOf(r.score).label,
    Cliente: r.customer,
    "E-mail": r.email ?? "",
    Telefone: r.phone ?? "",
    Estabelecimento: r.company ?? "",
    "Id do estabelecimento (origem)":
      r.externalCompanyId ?? "",
    "Comentário": r.comment,
    "Respondido em": quando(r.respondedAt),
    Tipo: r.kind ?? "",
    "Causa raiz": r.rootCause ?? "",
    Status: r.status,
    "Responsável": r.owner?.name ?? "",
    "Prazo 1o contato": quando(r.firstContactDueAt),
    "1o contato em": quando(r.firstContactAt),
    Tentativas: r.attempts.length,
    "Última tentativa": quando(
      r.attempts[r.attempts.length - 1]?.createdAt
    ),
    "Humor após contato": r.moodAfter
      ? `${r.moodAfter} — ${moodOf(r.moodAfter)?.label ?? ""}`
      : "",
    "Situação resolvida":
      r.resolvedAfter === null
        ? ""
        : r.resolvedAfter
          ? "Sim"
          : "Não",
    "Nota do pós-contato": r.postContactNote ?? "",
    "Pós-contato em": quando(r.postContactAt),
    "Pós-contato por": r.postContactBy ?? "",
    "Cliente confirmou": quando(r.confirmedAt),
    "Encerrado em": quando(r.closedAt),
    Desfecho: r.outcome ?? "",
    "Review pedida": r.reviewAsked ? "Sim" : "Não",
    "Depoimento pedido": r.testimonialAsked ? "Sim" : "Não",
    "Indicação": r.referralAsked ? "Sim" : "Não",
    Origem: r.source,
    "Id na origem": r.externalId ?? "",
  }));

  const sheet = XLSX.utils.json_to_sheet(planilha);

  /**
   * Larguras fixas: sem elas o Excel abre tudo em oito caracteres e a
   * planilha chega ilegível — que é metade do motivo de exportar.
   */
  sheet["!cols"] = Object.keys(planilha[0] ?? {}).map(
    (chave) => ({
      wch:
        chave === "Comentário"
          ? 60
          : chave === "Nota do pós-contato"
            ? 40
            : Math.max(chave.length + 2, 14),
    })
  );

  // Cabeçalho congelado: 789 linhas sem isso rolam sem referência.
  sheet["!freeze"] = { xSplit: 0, ySplit: 1 };

  const book = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(book, sheet, "NPS");

  const buffer = XLSX.write(book, {
    type: "buffer",
    bookType: "xlsx",
  }) as Buffer;

  return {
    arquivo: buffer.toString("base64"),
    nome: `cw-nps-${new Date().toISOString().slice(0, 10)}.xlsx`,
    total: linhas.length,
  };
}
