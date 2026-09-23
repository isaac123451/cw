"use server";

import * as XLSX from "xlsx";

import { updateTag } from "next/cache";

import { PrismaClient } from "@prisma/client";

import { requireRole, SemPermissao, tryRole } from "@/lib/auth/guard";
import type { Modulo } from "@/lib/auth/modules";
import { CASES_TAG, WORKSPACE_TAG } from "@/lib/actions/tags";

import {
  CHANNELS,
  ETAPAS_PADRAO,
  isEncerrado,
  KINDS,
  NpsKindOption,
  NpsResponseView,
  NpsStageOption,
  moodOf,
  ROOT_CAUSES,
  RootCauseOption,
  rotuloDeEtapa,
  segmentOf,
  STATUS_SEM_TRATATIVA,
  TIPOS_PADRAO,
} from "@/lib/models/nps";
import { ProjectStage } from "@/lib/models/project";

import { motivoParaNaoEncerrar, prazoPrimeiroContato } from "@/lib/services/nps.service";
import { lerExpediente } from "@/lib/services/operacao.service";
import {
  aplicarPosContato,
  registrarTentativa,
} from "@/lib/services/nps.repository";

import {
  FormatoInvalido,
  parseNpsPlanilha,
} from "@/lib/services/npsImport.service";

import { temWootric } from "@/lib/services/wootric.service";
import {
  devolverEncerramentoAoWootric,
  reabrirNoWootric,
  type ResultadoNoWootric,
} from "@/lib/services/wootric.escrita";

/*
  A importação em si mora fora deste arquivo.

  Aqui tudo que é exportado vira server action; ela não confere papel
  de propósito, e exportada daqui seria uma porta aberta. Ver o
  comentário em `wootric.import.ts`.
*/
import {
  importarDoWootric,
  ResultadoImportacao,
} from "@/lib/services/wootric.import";
import { hojeNaOperacao } from "@/lib/services/reputation.service";
import { semApagarVazios } from "@/lib/services/semApagar";
import { podeMarcarSemRetorno, quandoLiberaSemRetorno } from "@/lib/models/tratativa";

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
  /** O nome de gente, quando alguem o escreveu. */
  customerName?: string;
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
      notes: { orderBy: { createdAt: "asc" } },
      avaliacoesGoogle: {
        select: { estrelas: true, publicadaEm: true },
        orderBy: { publicadaEm: "desc" },
        take: 1,
      },
    },
    orderBy: { respondedAt: "desc" },
  });

  return linhas.map((r) => ({
    id: r.id,
    score: r.score,
    comment: r.comment,
    respondedAt: r.respondedAt.toISOString(),
    customer: r.customer,
    customerName: r.customerName ?? undefined,
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
    reviewFeita: r.reviewFeita ?? undefined,
    aceitaCase: r.aceitaCase ?? undefined,
    indicacoes: r.indicacoes ?? undefined,
    avaliacaoGoogle: r.avaliacoesGoogle[0]
      ? {
          estrelas: r.avaliacoesGoogle[0].estrelas,
          publicadaEm: r.avaliacoesGoogle[0].publicadaEm.toISOString(),
        }
      : undefined,
    source: r.source,
    externalId: r.externalId ?? undefined,
    externalCompanyId: r.externalCompanyId ?? undefined,
    churnRisk: r.churnRisk,
    wootricNotes: r.wootricNotes,
    wootricNotaEm: dia(r.wootricNotaEm),
    wootricConcluidoEm: dia(r.wootricConcluidoEm),
    wootricErro: r.wootricErro ?? undefined,
    notes: r.notes.map((n) => ({
      id: n.id,
      body: n.body,
      actor: n.actor,
      createdAt: n.createdAt.toISOString(),
    })),
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
      resultado: a.resultado === "aguardando" ? ("aguardando" as const) : ("sem-resposta" as const),
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
    !input.id ||
    input.id.startsWith("padrao-") ||
    /*
      "novo-" é o id que a tela dá à causa acrescentada e ainda não
      gravada. Sem reconhecê-lo, a gravação tentava **atualizar** um
      registro que não existe e estourava — era o "dá erro ao salvar
      causa raiz". Etapas, tipos e planos já tratavam os dois prefixos.
    */
    input.id.startsWith("novo-");

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

    /*
      Desde 13/09/2026 a lista é única para as quatro frentes: os casos
      (Reclame Aqui e redes) e as avaliações do Google guardam o mesmo
      nome, e renomear arrasta os três.
    */
    await ctx.prisma.case.updateMany({
      where: { causaRaiz: anterior.name },
      data: { causaRaiz: nome },
    });

    await ctx.prisma.avaliacaoGoogle.updateMany({
      where: { causaRaiz: anterior.name },
      data: { causaRaiz: nome },
    });

    updateTag(CASES_TAG);
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

  /* Em uso em qualquer frente — a lista é a mesma para as quatro. */
  const [noNps, nosCasos, noGoogle] = await Promise.all([
    ctx.prisma.npsResponse.count({ where: { rootCause: alvo.name } }),
    ctx.prisma.case.count({ where: { causaRaiz: alvo.name } }),
    ctx.prisma.avaliacaoGoogle.count({ where: { causaRaiz: alvo.name } }),
  ]);

  const emUso = noNps + nosCasos + noGoogle;

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

/**
 * Registra ou edita uma resposta.
 *
 * Devolve o que aconteceu — o id e se abriu revisão de processo —, e o
 * erro em português. A tela só diz "salvo" depois desta resposta.
 */
export async function saveNpsResponse(
  input: NpsDraft
): Promise<{ ok: true; id: string } | Falha> {

  if (!Number.isInteger(input.score) || input.score < 0 || input.score > 10) {
    return { ok: false, erro: "A nota vai de 0 a 10." };
  }
  if (!input.customer?.trim()) return { ok: false, erro: "Diga quem respondeu." };
  if (Number.isNaN(Date.parse(input.respondedAt))) return { ok: false, erro: "Data da resposta inválida." };

  const quem = await agente();
  if ("erro" in quem) return { ok: false, erro: quem.erro! };

  try {
    const id = await gravarResposta(quem.ctx.prisma, input);
    updateTag(WORKSPACE_TAG);
    return { ok: true, id };
  } catch (erro) {
    console.error("[nps] salvar resposta", erro);
    return { ok: false, erro: "O banco não aceitou a gravação agora. Tente de novo em instantes." };
  }
}

async function gravarResposta(prisma: PrismaClient, input: NpsDraft) {

  const ctx = { prisma };

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

    /* Vazio vira null: "ninguem preencheu" nao e´ o mesmo que "". */
    customerName: input.customerName?.trim() || null,

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

    /*
      Classificar como Erro Processual na edição também gera a revisão.

      Só a criação gerava — e quase toda resposta chega pelo Wootric e
      é classificada depois, numa edição. O "toda ocorrência" do guia
      ficava valendo só para o registro manual.
    */
    await gerarRevisaoDeProcesso(ctx.prisma, input, input.id);

    return input.id;
  }

  const criado = await ctx.prisma.npsResponse.create({
    data: {
      ...dados,
      firstContactDueAt: prazoPrimeiroContato(
        respondedAt,
        input.score,
        input.kind,
        undefined,
        await lerExpediente(ctx.prisma)
      ),
    },
    select: { id: true },
  });

  await gerarRevisaoDeProcesso(
    ctx.prisma,
    input,
    criado.id
  );

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

  /* Uma revisão por resposta: salvar de novo não cria outra. */
  const origem = `nps:${npsId}`;

  /* As revisões de antes de `origem` existir se reconhecem pela descrição. */
  const existente = await prisma.project.findFirst({
    where: {
      OR: [
        { origem },
        { description: { contains: `Registro NPS: ${npsId}` } },
      ],
    },
    select: { id: true },
  });

  if (existente) return;

  await prisma.project.create({
    data: {
      origem,
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

/** O nome de quem está logado, como a tela mostra — a autoria vem do servidor. */
async function nomeDe(prisma: PrismaClient, userId: string) {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
  return u?.name ?? "";
}

/**
 * Uma tentativa de contato. A primeira é o 1º contato (ver o repositório).
 *
 * A autoria vem da sessão, e não da tela: a tela mandava o nome que
 * tinha em memória, e uma aba aberta com outra conta assinava por ela.
 */
export async function registerNpsAttempt(input: {
  responseId: string;
  channel: string;
  note: string;
  /** Quando foi (ISO). Ausente é agora. */
  em?: string;
  /** Já passou das 2 horas e o cliente não respondeu. */
  semRetorno?: boolean;
}): Promise<{ ok: true } | Falha> {

  const note = input.note.trim().slice(0, 1000);
  if (!CHANNELS.includes(input.channel)) return { ok: false, erro: "Escolha o canal: e-mail, telefone ou WhatsApp." };
  if (!note) return { ok: false, erro: "Diga o que aconteceu na tentativa." };

  const agora = new Date();
  const em = input.em ? new Date(input.em) : agora;
  if (!Number.isFinite(em.getTime())) return { ok: false, erro: "A hora da tentativa não é válida." };
  if (em.getTime() > agora.getTime() + 5 * 60_000) return { ok: false, erro: "A tentativa não pode estar no futuro." };
  /* Sem retorno só depois da espera: o cliente ainda pode responder. */
  if (input.semRetorno && !podeMarcarSemRetorno(em, agora)) {
    return { ok: false, erro: `Sem retorno só 2 horas depois da tentativa (a partir das ${quandoLiberaSemRetorno(em, agora)}). Até lá, fica aguardando retorno.` };
  }

  const quem = await agente();
  if ("erro" in quem) return { ok: false, erro: quem.erro! };

  try {
    const existe = await quem.ctx.prisma.npsResponse.findUnique({ where: { id: input.responseId }, select: { status: true, respondedAt: true } });
    if (!existe) return { ok: false, erro: "Esta resposta não existe mais." };
    if (isEncerrado(existe.status)) return { ok: false, erro: "O ciclo já está encerrado." };
    if (em < existe.respondedAt) return { ok: false, erro: "A tentativa não pode ser de antes da resposta do cliente." };

    await registrarTentativa(quem.ctx.prisma, {
      responseId: input.responseId,
      channel: input.channel,
      note,
      actor: await nomeDe(quem.ctx.prisma, quem.ctx.userId),
      em,
      resultado: input.semRetorno ? "sem-resposta" : "aguardando",
    });
  } catch (erro) {
    console.error("[nps] tentativa", erro);
    return { ok: false, erro: "O banco não aceitou a gravação agora. Tente de novo em instantes." };
  }

  updateTag(WORKSPACE_TAG);
  return { ok: true };
}

/**
 * A tentativa aguardando retorno vira "sem retorno" — só depois de 2
 * horas. É aí que ela passa a contar para as tentativas mínimas do guia.
 */
export async function marcarTentativaNpsSemRetorno(attemptId: string): Promise<{ ok: true } | Falha> {

  const quem = await agente();
  if ("erro" in quem) return { ok: false, erro: quem.erro! };

  try {
    const t = await quem.ctx.prisma.npsAttempt.findUnique({
      where: { id: attemptId },
      select: { resultado: true, createdAt: true, response: { select: { status: true } } },
    });
    if (!t) return { ok: false, erro: "Esta tentativa não existe mais." };
    if (isEncerrado(t.response.status)) return { ok: false, erro: "O ciclo já está encerrado." };
    if (t.resultado !== "aguardando") return { ok: false, erro: "Esta tentativa já está marcada." };
    if (!podeMarcarSemRetorno(t.createdAt)) {
      return { ok: false, erro: `Ainda dá tempo de o cliente responder: sem retorno a partir das ${quandoLiberaSemRetorno(t.createdAt)}.` };
    }
    await quem.ctx.prisma.npsAttempt.update({ where: { id: attemptId }, data: { resultado: "sem-resposta" } });
  } catch (erro) {
    console.error("[nps] sem retorno", erro);
    return { ok: false, erro: "O banco não aceitou a gravação agora. Tente de novo em instantes." };
  }

  updateTag(WORKSPACE_TAG);
  return { ok: true };
}

/**
 * Os tipos e as etapas cadastrados — ou os do guia, com o banco vazio.
 * O servidor confere o encerramento com a mesma lista que a tela mostra.
 */
async function cadastroDoNps(prisma: PrismaClient) {
  const [kinds, stages] = await Promise.all([prisma.npsKind.findMany(), prisma.npsStage.findMany()]);
  const tipos: NpsKindOption[] = kinds.length
    ? kinds.map((r) => ({
        id: r.id,
        name: r.name,
        emoji: r.emoji,
        color: r.color,
        action: r.action,
        requiresConfirmation: r.requiresConfirmation,
        requiresRootCause: r.requiresRootCause,
        opensProcessReview: r.opensProcessReview,
        ownDeadlineHours: r.ownDeadlineHours ?? undefined,
        order: r.order,
        active: r.active,
      }))
    : TIPOS_PADRAO;
  const etapas: NpsStageOption[] = stages.length
    ? stages.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description ?? undefined,
        color: r.color,
        order: r.order,
        active: r.active,
        final: r.final,
        kinds: r.kinds,
      }))
    : ETAPAS_PADRAO;
  return { tipos, etapas };
}

/**
 * Move o ciclo de etapa — e encerra, quando a etapa é final.
 *
 * **O encerramento é conferido aqui.** Só a ficha travava, e só o
 * "Resolvido"; o quadro e qualquer chamada direta encerravam sem lastro.
 * Agora o final precisa ser um que o tipo aceita, e cumprir o que o
 * guia pede para ele (`motivoParaNaoEncerrar`).
 */
export async function setNpsStatus(
  id: string,
  status: string,
  outcome?: string
): Promise<{ ok: true; status: string; wootric?: ResultadoNoWootric; avisoDoWootric?: string } | Falha> {

  const quem = await agente();
  if ("erro" in quem) return { ok: false, erro: quem.erro! };
  const prisma = quem.ctx.prisma;

  const encerrando = isEncerrado(status);
  let estavaEncerrado = false;

  try {
    const { tipos, etapas } = await cadastroDoNps(prisma);

    const etapa = etapas.find((e) => e.name === status && e.active);
    if (!etapa && status !== STATUS_SEM_TRATATIVA) return { ok: false, erro: `A etapa "${status}" não está cadastrada.` };

    const linha = await prisma.npsResponse.findUnique({
      where: { id },
      include: { attempts: { select: { id: true, channel: true, note: true, actor: true, createdAt: true } }, owner: { select: { name: true } } },
    });
    if (!linha) return { ok: false, erro: "Esta resposta não existe mais." };

    estavaEncerrado = isEncerrado(linha.status);

    if (encerrando) {
      if (etapa && etapa.kinds.length > 0 && (!linha.kind || !etapa.kinds.includes(linha.kind))) {
        return { ok: false, erro: `"${rotuloDeEtapa(status)}" não é um final do tipo ${linha.kind ? `"${linha.kind}"` : "— classifique o tipo antes"}.` };
      }

      const motivo = motivoParaNaoEncerrar(
        {
          ...linha,
          respondedAt: linha.respondedAt.toISOString(),
          firstContactDueAt: linha.firstContactDueAt.toISOString(),
          firstContactAt: dia(linha.firstContactAt),
          confirmedAt: dia(linha.confirmedAt),
          postContactAt: dia(linha.postContactAt),
          kind: linha.kind ?? undefined,
          rootCause: linha.rootCause ?? undefined,
          owner: linha.owner?.name ?? undefined,
          attempts: linha.attempts.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() })),
        } as unknown as NpsResponseView,
        status,
        tipos
      );
      if (motivo) return { ok: false, erro: motivo };
    }

    await prisma.npsResponse.update({
      where: { id },
      data: {
        status,
        outcome: outcome?.trim() || (encerrando ? status : null),
        closedAt: encerrando ? new Date() : null,
      },
    });
  } catch (erro) {
    console.error("[nps] etapa", erro);
    return { ok: false, erro: "O banco não aceitou a gravação agora. Tente de novo em instantes." };
  }

  /*
    Depois de gravado aqui, o Wootric: encerrar manda a nota com os
    detalhes e conclui a resposta lá; reabrir desfaz a conclusão. Uma
    falha lá não desfaz o que foi gravado — volta como aviso.
  */
  let wootric: ResultadoNoWootric | undefined;
  let avisoDoWootric: string | undefined;

  if (encerrando) {
    wootric = await devolverEncerramentoAoWootric(prisma, id, await nomeDe(prisma, quem.ctx.userId)).catch((e) => {
      console.error("[nps] devolver ao Wootric", e);
      return {
        estado: "pendente" as const,
        nota: "falhou" as const,
        concluido: "falhou" as const,
        erro: "Não deu para falar com o Wootric agora.",
      };
    });
  } else if (estavaEncerrado) {
    avisoDoWootric = await reabrirNoWootric(prisma, id).catch(() => "Não deu para reabrir no Wootric.");
  }

  updateTag(WORKSPACE_TAG);
  return { ok: true, status, wootric, avisoDoWootric };
}

/**
 * Tenta de novo mandar ao Wootric o encerramento que ficou para trás —
 * o botão da ficha quando a nota ou a conclusão foram recusadas.
 */
export async function reenviarAoWootric(id: string): Promise<{ ok: true; wootric: ResultadoNoWootric } | Falha> {
  const quem = await agente();
  if ("erro" in quem) return { ok: false, erro: quem.erro! };

  try {
    const wootric = await devolverEncerramentoAoWootric(quem.ctx.prisma, id, await nomeDe(quem.ctx.prisma, quem.ctx.userId));
    if (wootric.estado === "fora") return { ok: false, erro: "Este ciclo não veio do Wootric, ou não está encerrado." };
    updateTag(WORKSPACE_TAG);
    return { ok: true, wootric };
  } catch (erro) {
    console.error("[nps] reenviar ao Wootric", erro);
    return { ok: false, erro: "Não deu para falar com o Wootric agora. Tente de novo em instantes." };
  }
}

/**
 * Classifica o ciclo: o tipo, a causa raiz e, se pedido, quem assume.
 *
 * Existia só dentro do formulário inteiro de edição (que regrava nome,
 * nota e comentário) ou na triagem em lote (que não tem causa). A ficha
 * nova classifica com três campos e um Salvar.
 */
export async function classificarNps(entrada: {
  id: string;
  tipo: string;
  causa?: string | null;
  assumir?: boolean;
}): Promise<{ ok: true; revisao: boolean; responsavel?: string } | Falha> {

  if (!entrada.tipo) return { ok: false, erro: "Escolha o tipo." };

  const quem = await agente();
  if ("erro" in quem) return { ok: false, erro: quem.erro! };
  const prisma = quem.ctx.prisma;

  try {
    const { tipos } = await cadastroDoNps(prisma);
    const regra = tipos.find((t) => t.name === entrada.tipo && t.active);
    if (!regra) return { ok: false, erro: `O tipo "${entrada.tipo}" não está cadastrado.` };

    const causa = entrada.causa?.trim() || null;
    if (regra.requiresRootCause && !causa) return { ok: false, erro: `${regra.name} pede a causa raiz.` };
    if (causa) {
      const cadastrada = await prisma.npsRootCause.findFirst({ where: { name: causa }, select: { id: true } });
      if (!cadastrada && !ROOT_CAUSES.includes(causa)) return { ok: false, erro: `A causa "${causa}" não está cadastrada.` };
    }

    const linha = await prisma.npsResponse.findUnique({
      where: { id: entrada.id },
      select: { id: true, score: true, comment: true, respondedAt: true, customer: true, owner: { select: { name: true } } },
    });
    if (!linha) return { ok: false, erro: "Esta resposta não existe mais." };

    const responsavel = entrada.assumir ? await nomeDe(prisma, quem.ctx.userId) : undefined;

    await prisma.npsResponse.update({
      where: { id: entrada.id },
      data: {
        kind: regra.name,
        rootCause: causa,
        ...(entrada.assumir ? { ownerId: quem.ctx.userId } : {}),
      },
    });

    let revisao = false;
    if (regra.opensProcessReview || regra.name === "Erro Processual") {
      const antes = await prisma.project.count({ where: { origem: `nps:${linha.id}` } });
      await gerarRevisaoDeProcesso(
        prisma,
        {
          score: linha.score,
          comment: linha.comment,
          respondedAt: linha.respondedAt.toISOString(),
          customer: linha.customer,
          kind: "Erro Processual",
          owner: responsavel ?? linha.owner?.name,
        },
        linha.id
      );
      revisao = (await prisma.project.count({ where: { origem: `nps:${linha.id}` } })) > antes;
    }

    updateTag(WORKSPACE_TAG);
    return { ok: true, revisao, responsavel };
  } catch (erro) {
    console.error("[nps] classificar", erro);
    return { ok: false, erro: "O banco não aceitou a gravação agora. Tente de novo em instantes." };
  }
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
}): Promise<{ ok: true } | Falha> {

  if (input.mood != null && !(Number.isInteger(input.mood) && input.mood >= 1 && input.mood <= 5)) {
    return { ok: false, erro: "Humor inválido." };
  }

  const quem = await agente();
  if ("erro" in quem) return { ok: false, erro: quem.erro! };

  try {
    const r = await aplicarPosContato(quem.ctx.prisma, {
      ...input,
      note: input.note?.slice(0, 2000),
      actor: await nomeDe(quem.ctx.prisma, quem.ctx.userId),
    });
    if (!r) return { ok: false, erro: "Esta resposta não existe mais." };
  } catch (erro) {
    console.error("[nps] pós-contato", erro);
    return { ok: false, erro: "O banco não aceitou a gravação agora. Tente de novo em instantes." };
  }

  updateTag(WORKSPACE_TAG);
  return { ok: true };
}

/**
 * Registra (ou desfaz) a confirmação do cliente de que resolveu.
 *
 * A pergunta enviada, sem resposta ainda, não é isto: é a etapa
 * [Aguardando Resposta], por `setNpsStatus`.
 */
export async function confirmNpsResolution(
  id: string,
  confirmado: boolean
): Promise<{ ok: true } | Falha> {

  const quem = await agente();
  if ("erro" in quem) return { ok: false, erro: quem.erro! };

  try {
    const atual = await quem.ctx.prisma.npsResponse.findUnique({ where: { id }, select: { status: true } });
    if (!atual) return { ok: false, erro: "Esta resposta não existe mais." };
    if (isEncerrado(atual.status)) return { ok: false, erro: "O ciclo já está encerrado." };

    await quem.ctx.prisma.npsResponse.update({
      where: { id },
      data: { confirmedAt: confirmado ? new Date() : null },
    });
  } catch (erro) {
    console.error("[nps] confirmação", erro);
    return { ok: false, erro: "O banco não aceitou a gravação agora. Tente de novo em instantes." };
  }

  updateTag(WORKSPACE_TAG);
  return { ok: true };
}

type Falha = { ok: false; erro: string };

/**
 * A sessão e o papel, com o erro em português em vez de exceção.
 *
 * As ações antigas deste arquivo devolvem `void` e a tela diz "salvo"
 * de qualquer jeito; as novas devolvem o que aconteceu, e o aviso só
 * sai depois da resposta. As antigas entram na mesma regra na 10.4.
 */
async function agente() {
  try {
    const ctx = await requireRole("AGENTE", MODULO);
    if (!ctx) return { erro: "Sem banco configurado — nada é gravado no modo demonstração." } as const;
    return { ctx } as const;
  } catch (erro) {
    return {
      erro: erro instanceof SemPermissao ? erro.message : "Não foi possível confirmar sua sessão. Entre de novo.",
    } as const;
  }
}

export interface AcoesDoPromotor {
  id: string;
  reviewAsked: boolean;
  testimonialAsked: boolean;
  referralAsked: boolean;
  /** `null` é "ainda não se sabe" — diferente de "não". */
  reviewFeita: boolean | null;
  aceitaCase: boolean | null;
  indicacoes: number | null;
}

/**
 * As três ações do promotor e o que voltou delas.
 *
 * "Direcionar para review pública (Google), perguntar se aceita ser
 * case, pedir indicação." Registrar o resultado sem o pedido não faz
 * sentido — quem publicou a review foi convidado —, então o resultado
 * marca o pedido junto.
 */
export async function salvarAcoesDoPromotor(
  entrada: AcoesDoPromotor
): Promise<{ ok: true; acoes: AcoesDoPromotor } | Falha> {

  const indicacoes = entrada.indicacoes;

  if (indicacoes !== null && !(Number.isInteger(indicacoes) && indicacoes >= 0 && indicacoes <= 500)) {
    return { ok: false, erro: "Indicações é um número inteiro, de 0 a 500." };
  }

  const quem = await agente();
  if ("erro" in quem) return { ok: false, erro: quem.erro! };

  const dados = {
    reviewAsked: entrada.reviewAsked || entrada.reviewFeita !== null,
    testimonialAsked: entrada.testimonialAsked || entrada.aceitaCase !== null,
    referralAsked: entrada.referralAsked || (indicacoes ?? 0) > 0,
    reviewFeita: entrada.reviewFeita,
    aceitaCase: entrada.aceitaCase,
    indicacoes,
  };

  try {
    const atual = await quem.ctx.prisma.npsResponse.findUnique({ where: { id: entrada.id }, select: { score: true } });
    if (!atual) return { ok: false, erro: "Esta resposta não existe mais." };
    if (atual.score < 9) return { ok: false, erro: "As ações de promotor valem para nota 9 ou 10." };

    await quem.ctx.prisma.npsResponse.update({ where: { id: entrada.id }, data: dados });
  } catch (erro) {
    console.error("[nps] ações do promotor", erro);
    return { ok: false, erro: "O banco não aceitou a gravação agora. Tente de novo em instantes." };
  }

  updateTag(WORKSPACE_TAG);

  return { ok: true, acoes: { id: entrada.id, ...dados } };
}

/**
 * A triagem em lote do que está parado.
 *
 * Duas operações que valem para dezenas de ciclos de uma vez: assumir
 * (o responsável passa a ser quem clicou) e classificar o tipo. O resto
 * — contato, pós-contato, encerramento — é um a um, na ficha, porque
 * cada um é uma conversa.
 *
 * Classificar como Erro Processual abre a revisão de processo de cada
 * um, como o guia exige de "toda ocorrência".
 */
export async function triarNpsEmLote(entrada: {
  ids: string[];
  tipo?: string;
  assumir?: boolean;
}): Promise<{ ok: true; atualizados: number; revisoes: number; responsavel?: string } | Falha> {

  const ids = [...new Set(entrada.ids)].filter(Boolean);

  if (ids.length === 0) return { ok: false, erro: "Selecione ao menos um ciclo." };
  if (ids.length > 300) return { ok: false, erro: "No máximo 300 ciclos por vez." };
  if (!entrada.tipo && !entrada.assumir) return { ok: false, erro: "Escolha o que aplicar: um tipo, ou assumir." };

  const quem = await agente();
  if ("erro" in quem) return { ok: false, erro: quem.erro! };

  const prisma = quem.ctx.prisma;

  try {
    if (entrada.tipo) {
      const cadastrado = await prisma.npsKind.findFirst({ where: { name: entrada.tipo, active: true }, select: { name: true } });
      const doGuia = KINDS.some((k) => k.label === entrada.tipo);
      if (!cadastrado && !doGuia) return { ok: false, erro: `O tipo "${entrada.tipo}" não está cadastrado.` };
    }

    const pessoa = entrada.assumir
      ? await prisma.user.findUnique({ where: { id: quem.ctx.userId }, select: { id: true, name: true } })
      : null;

    const r = await prisma.npsResponse.updateMany({
      where: { id: { in: ids } },
      data: {
        ...(entrada.tipo ? { kind: entrada.tipo } : {}),
        ...(pessoa ? { ownerId: pessoa.id } : {}),
      },
    });

    let revisoes = 0;

    if (entrada.tipo === "Erro Processual") {
      const linhas = await prisma.npsResponse.findMany({
        where: { id: { in: ids } },
        select: { id: true, customer: true, score: true, comment: true, respondedAt: true, owner: { select: { name: true } } },
      });

      for (const l of linhas) {
        const antes = await prisma.project.count({ where: { origem: `nps:${l.id}` } });
        await gerarRevisaoDeProcesso(
          prisma,
          {
            score: l.score,
            comment: l.comment,
            respondedAt: l.respondedAt.toISOString(),
            customer: l.customer,
            kind: "Erro Processual",
            owner: l.owner?.name,
          },
          l.id
        );
        if ((await prisma.project.count({ where: { origem: `nps:${l.id}` } })) > antes) revisoes += 1;
      }
    }

    updateTag(WORKSPACE_TAG);

    return { ok: true, atualizados: r.count, revisoes, responsavel: pessoa?.name };
  } catch (erro) {
    console.error("[nps] triagem em lote", erro);
    return { ok: false, erro: "O banco não aceitou a gravação agora. Aplicar de novo é seguro: o mesmo tipo e o mesmo responsável não duplicam nada." };
  }
}

export async function deleteNpsResponse(id: string): Promise<{ ok: true } | Falha> {

  // Apagar resposta de pesquisa altera indicador: é ato de ADMIN.
  let ctx;
  try {
    ctx = await requireRole("ADMIN", MODULO);
  } catch (erro) {
    return { ok: false, erro: erro instanceof SemPermissao ? erro.message : "Não foi possível confirmar sua sessão. Entre de novo." };
  }

  if (!ctx) return { ok: false, erro: "Sem banco configurado — nada é gravado no modo demonstração." };

  try {
    await ctx.prisma.npsResponse.delete({ where: { id } });
  } catch (erro) {
    console.error("[nps] excluir", erro);
    return { ok: false, erro: "Não deu para excluir agora. Tente de novo em instantes." };
  }

  updateTag(WORKSPACE_TAG);
  return { ok: true };
}

/* ============================================================
   IMPORTAÇÃO DO WOOTRIC
============================================================ */




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
/**
 * A base está velha o bastante para valer uma busca?
 *
 * O Isaac: "os casos do nps ta tendo que importar toda vez que abro". A
 * rotina agendada roda **uma vez por dia**, às 3h da manhã — quem abre
 * o NPS às 14h vê a base de ontem e precisa clicar em importar.
 *
 * A tela chama isto ao abrir e, se a resposta for sim, busca sozinha em
 * segundo plano. A pergunta fica no servidor e não na tela porque a
 * marca é da base inteira: dois navegadores abertos não podem chegar a
 * respostas diferentes sobre a mesma pergunta.
 *
 * **Trinta minutos.** Curto o bastante para a fila estar em dia quando
 * alguém senta para trabalhar, longo o bastante para navegar entre as
 * telas não virar uma ida ao Wootric por clique.
 */
const JANELA_DE_FRESCOR_MS = 30 * 60 * 1000;

export async function precisaBuscarNoWootric(): Promise<{
  precisa: boolean;
  ultimaEm?: string;
  ultimoErro?: string;
}> {

  const ctx = await tryRole("LEITURA", MODULO);

  if (!ctx || !temWootric()) return { precisa: false };

  const marca = await ctx.prisma.wootricSync.findUnique({
    where: { id: "unico" },
    select: { ranAt: true, lastError: true },
  });

  /* Nunca rodou: vale buscar. */
  if (!marca) return { precisa: true };

  const idade = Date.now() - marca.ranAt.getTime();

  return {
    precisa: idade > JANELA_DE_FRESCOR_MS,
    ultimaEm: marca.ranAt.toISOString(),
    ultimoErro: marca.lastError ?? undefined,
  };
}

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

  if (!ctx) {
    return {
      lidas: 0,
      novas: 0,
      atualizadas: 0,
      semTratativa: 0,
      desde: "",
      erro: "Sem banco configurado — a importação precisa de onde gravar.",
    };
  }

  const r = await importarDoWootric(ctx.prisma, input);

  /* Aqui é server action: `updateTag` faz a própria sessão já ler o novo. */
  if (r.novas > 0 || r.atualizadas > 0) {
    updateTag(WORKSPACE_TAG);
  }

  return r;
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

  const expediente = await lerExpediente(ctx.prisma);

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
          /*
            Coluna que a planilha não traz não apaga o que está aqui.

            Gravava `daPlanilha` inteira, com `?? null` em cada campo — e
            uma planilha sem as colunas de tipo e causa raiz apagava a
            **análise que a operação tinha feito**, além do telefone
            digitado. E trocava a origem para "Planilha" até de resposta
            que veio do Wootric. Achado na revisão de 10/09/2026.
          */
          const { source: _origem, ...semOrigem } = daPlanilha;
          void _origem;

          await ctx.prisma.npsResponse.update({
            where: { id: existente.id },
            data: semApagarVazios(semOrigem, [
              "email",
              "phone",
              "company",
              "kind",
              "rootCause",
              "comment",
            ]),
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
              item.kind,
              undefined,
              expediente
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

  /*
    Hora de Brasília, "13/09/2026 14:05" — como a planilha do time
    escreve e como a importação lê de volta. Era o relógio UTC em
    "2026-09-13 17:05": três horas adiantado para quem abria o arquivo.
  */
  const quando = (v?: Date | null) =>
    v
      ? v
          .toLocaleString("pt-BR", {
            timeZone: "America/Sao_Paulo",
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
          .replace(",", "")
      : "";

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
    "Review publicada": r.reviewFeita === null ? "" : r.reviewFeita ? "Sim" : "Não",
    "Depoimento pedido": r.testimonialAsked ? "Sim" : "Não",
    "Aceita ser case": r.aceitaCase === null ? "" : r.aceitaCase ? "Sim" : "Não",
    "Indicação": r.referralAsked ? "Sim" : "Não",
    "Indicações recebidas": r.indicacoes ?? "",
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
    nome: `cw-nps-${hojeNaOperacao()}.xlsx`,
    total: linhas.length,
  };
}

/**
 * Grava o telefone e o estabelecimento de um ciclo de NPS.
 *
 * Existe separada de `saveNpsResponse` porque a intenção é outra.
 * Aquela grava o ciclo inteiro — nota, comentário, data da resposta —
 * e é o formulário de cadastro. Esta é a ficha aberta durante a
 * tratativa: quem está com o cliente na linha descobre o telefone e o
 * restaurante, e precisa anotar **isso**, sem passar por um formulário
 * que pede a nota de novo.
 *
 * Medido antes de escrever: dos 959 ciclos na base, **zero** têm
 * telefone e **zero** têm estabelecimento — contra 958 com e-mail. A
 * carga do Wootric não traz nenhum dos dois, e não havia onde
 * preencher. É o que o Isaac relatou: "não tem como adicionar o
 * telefone, não tem como adicionar portal".
 *
 * O e-mail fica de fora de propósito: é a **única** chave que liga este
 * ciclo às reclamações e às redes sociais do mesmo cliente. Deixar que
 * se edite aqui é deixar que se quebre o cruzamento sem querer, e o
 * ganho seria corrigir um endereço — que se faz no cadastro, onde a
 * consequência está à vista.
 */
/* ============================================================
   ANOTAÇÕES DO CICLO
============================================================ */

/**
 * Escreve uma anotação no ciclo de NPS.
 *
 * O Isaac pediu paridade com o Wootric: "preciso que seja possível
 * adicionar notas assim nos casos de nps".
 *
 * **Por que não é uma tentativa de contato.** `NpsAttempt` já existia e
 * seria o lugar tentador, mas ela tem canal e significa "liguei". Uma
 * anotação que virasse tentativa inflaria a contagem — e é essa
 * contagem que decide se o ciclo encerra por "sem retorno". O número
 * passaria a mentir sobre quantas vezes se tentou falar com a pessoa.
 *
 * O nome de quem escreveu é gravado junto da relação, e não só como
 * chave: desativar a conta de alguém não pode apagar a autoria do que
 * essa pessoa escreveu.
 */
export async function addNpsNote(input: {
  id: string;
  texto: string;
}): Promise<{ ok: true; id: string; createdAt: string; actor: string } | Falha> {

  const texto = input.texto.trim().slice(0, 4000);

  if (texto === "") return { ok: false, erro: "A anotação está vazia." };

  const quem = await agente();
  if ("erro" in quem) return { ok: false, erro: quem.erro! };

  try {
    const actor = await nomeDe(quem.ctx.prisma, quem.ctx.userId);
    const criada = await quem.ctx.prisma.npsNote.create({
      data: {
        responseId: input.id,
        body: texto,
        authorId: quem.ctx.userId,
        actor,
      },
      select: { id: true, createdAt: true },
    });

    updateTag(WORKSPACE_TAG);

    return { ok: true, id: criada.id, createdAt: criada.createdAt.toISOString(), actor };
  } catch (erro) {
    console.error("[nps] anotação", erro);
    return { ok: false, erro: "O banco não aceitou a gravação agora. Tente de novo em instantes." };
  }
}

export async function removeNpsNote(id: string): Promise<{ ok: true } | Falha> {

  const quem = await agente();
  if ("erro" in quem) return { ok: false, erro: quem.erro! };

  try {
    await quem.ctx.prisma.npsNote.delete({ where: { id } });
  } catch (erro) {
    console.error("[nps] apagar anotação", erro);
    return { ok: false, erro: "Não deu para apagar a anotação agora. Tente de novo em instantes." };
  }

  updateTag(WORKSPACE_TAG);
  return { ok: true };
}

/**
 * Marca (ou desmarca) que a conta precisa de retenção.
 *
 * O Isaac pediu o botão nas três frentes: "quando tenha um botão algo
 * assim na reclamação ou nps e até mesmo redes sociais, para sinalizar
 * que é um caso de cancelamento e ser necessário reter".
 *
 * **Grava na hora, sem passar pelo rascunho.** Os outros campos da
 * ficha esperam o botão Salvar porque são texto em edição. Este é um
 * alerta: quem clica acabou de ouvir "vou cancelar" e vai fechar a tela
 * para ligar para o cliente. Se dependesse de um segundo clique, o
 * aviso se perderia exatamente nos casos em que mais importa.
 */
export async function setNpsChurnRisk(input: {
  id: string;
  valor: boolean;
}): Promise<{ ok: true } | Falha> {

  const quem = await agente();
  if ("erro" in quem) return { ok: false, erro: quem.erro! };

  try {
    await quem.ctx.prisma.npsResponse.update({
      where: { id: input.id },
      data: { churnRisk: input.valor },
    });
  } catch (erro) {
    console.error("[nps] retenção", erro);
    return { ok: false, erro: "O banco não aceitou a marca agora. Tente de novo em instantes." };
  }

  updateTag(WORKSPACE_TAG);
  return { ok: true };
}

export async function updateNpsContato(input: {
  id: string;
  phone?: string | null;
  establishmentId?: string | null;
}): Promise<{ ok: true } | Falha> {

  const digitos = (input.phone ?? "").replace(/\D/g, "");
  if (input.phone?.trim() && (digitos.length < 10 || digitos.length > 13)) {
    return { ok: false, erro: "Telefone com DDD: de 10 a 13 dígitos." };
  }

  const quem = await agente();
  if ("erro" in quem) return { ok: false, erro: quem.erro! };

  try {
    if (input.establishmentId) {
      const existe = await quem.ctx.prisma.establishment.findUnique({ where: { id: input.establishmentId }, select: { id: true } });
      if (!existe) return { ok: false, erro: "Este estabelecimento não existe mais." };
    }

    await quem.ctx.prisma.npsResponse.update({
      where: { id: input.id },
      data: {
        /*
          `undefined` não toca no campo; `null` limpa.

          A distinção importa: a tela pode gravar um campo só, e sem ela
          salvar o telefone apagaria o estabelecimento.
        */
        ...(input.phone !== undefined
          ? { phone: input.phone?.trim() || null }
          : {}),

        ...(input.establishmentId !== undefined
          ? {
              establishmentId:
                input.establishmentId || null,
            }
          : {}),
      },
    });
  } catch (erro) {
    console.error("[nps] contato", erro);
    return { ok: false, erro: "O banco não aceitou a gravação agora. Tente de novo em instantes." };
  }

  updateTag(WORKSPACE_TAG);
  return { ok: true };
}
