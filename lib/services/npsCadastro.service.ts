import { PrismaClient } from "@prisma/client";

import {
  ETAPAS_PADRAO,
  isEncerrado,
  nomeDeEtapa,
  NpsKindOption,
  NpsStageOption,
  TIPOS_PADRAO,
} from "@/lib/models/nps";

/**
 * As regras de gravar etapa e tipo do NPS.
 *
 * Moram aqui, e não na server action, pelo mesmo motivo de
 * `nps.repository.ts`: a action lê a sessão por `next/headers` e não dá
 * para exercitá-la de um script. E a regra que mais precisa de prova é
 * justamente a que não aparece na tela — a normalização do prefixo
 * `[Encerrado]`, o arrasto dos ciclos ao renomear e a desativação em vez
 * da exclusão.
 *
 * `npm run check:nps-etapas` roda tudo isto contra o banco real, num
 * cadastro descartável que o próprio script cria e apaga.
 */

/* ============================================================
   ETAPAS
============================================================ */

export async function gravarEtapa(
  prisma: PrismaClient,
  input: NpsStageOption
): Promise<string | null> {

  /**
   * O nome carrega o marcador de encerramento.
   *
   * `isEncerrado()` roda em lugares sem banco à mão — o cartão do
   * quadro, o filtro da tela, a fila da extensão — e é ela que tira o
   * ciclo da fila e alimenta o indicador de resolução. Normalizar aqui
   * é o que impede a coluna `final` e o texto do status de discordarem.
   */
  const nome = nomeDeEtapa(input.name, input.final);

  if (nome === "" || nome === "[Encerrado]") return null;

  const dados = {
    name: nome,
    description: input.description?.trim() || null,
    color: input.color,
    order: input.order,
    active: input.active,
    final: input.final,

    /**
     * Etapa de andamento não tem tipo amarrado.
     *
     * A lista existe para responder "quais tipos podem **encerrar**
     * aqui". Guardá-la numa etapa de meio de caminho seria um dado que
     * ninguém lê e que engana quem for editar depois.
     */
    kinds: input.final ? input.kinds : [],
  };

  const novo = !input.id || input.id.startsWith("padrao-") || input.id.startsWith("novo-");

  if (novo) {

    const criado = await prisma.npsStage.create({
      data: dados,
      select: { id: true },
    });

    await semearEtapas(prisma, nome);

    return criado.id;
  }

  const anterior = await prisma.npsStage.findUnique({
    where: { id: input.id },
    select: { name: true },
  });

  await prisma.npsStage.update({
    where: { id: input.id },
    data: dados,
  });

  /**
   * Renomear a etapa arrasta os ciclos junto.
   *
   * A resposta guarda o **texto** do status, não o id da etapa — é o
   * que permite `isEncerrado()` ser função pura. O preço é este:
   * renomear sem atualizar os registros deixaria os ciclos apontando
   * para uma coluna que não existe mais, e eles sumiriam do quadro sem
   * ninguém ter movido nada.
   */
  if (anterior && anterior.name !== nome) {

    await prisma.npsResponse.updateMany({
      where: { status: anterior.name },
      data: { status: nome },
    });

    // O desfecho é o mesmo rótulo, gravado no encerramento.
    await prisma.npsResponse.updateMany({
      where: { outcome: anterior.name },
      data: { outcome: nome },
    });

    /**
     * Deixou de encerrar? Os ciclos que estavam ali reabrem.
     *
     * `closedAt` preenchido com um status que não é mais final é
     * exatamente a contradição que faz o indicador de resolução contar
     * como fechado o que voltou a ser trabalho — só que ao contrário.
     */
    if (!isEncerrado(nome) && isEncerrado(anterior.name)) {
      await prisma.npsResponse.updateMany({
        where: { status: nome },
        data: { closedAt: null, outcome: null },
      });
    }
  }

  return input.id;
}

/**
 * Ao gravar a primeira etapa, materializa as de partida.
 *
 * Sem isto, criar uma etapa nova faria as nove originais sumirem de uma
 * vez — porque a listagem deixa de cair no padrão assim que existe
 * qualquer linha no banco.
 */
async function semearEtapas(
  prisma: PrismaClient,
  exceto: string
) {

  const total = await prisma.npsStage.count();

  if (total > 1) return;

  await prisma.npsStage.createMany({
    data: ETAPAS_PADRAO.filter(
      (e) => e.name !== exceto
    ).map((e) => ({
      name: e.name,
      color: e.color,
      order: e.order,
      active: e.active,
      final: e.final,
      kinds: e.kinds,
    })),
    skipDuplicates: true,
  });
}

/**
 * Remove — ou desativa, quando já tem ciclo parado ali.
 *
 * Apagar uma etapa em uso deixaria os ciclos dela órfãos: o status
 * continua gravado no registro, e o quadro passaria a não ter coluna
 * para desenhá-los. Somem do quadro sem ninguém ter movido nada, que é
 * a pior forma de perder trabalho.
 *
 * Devolve quantos ciclos estavam usando — zero significa que apagou
 * mesmo.
 */
export async function removerEtapa(
  prisma: PrismaClient,
  id: string
): Promise<number | undefined> {

  const alvo = await prisma.npsStage.findUnique({
    where: { id },
    select: { name: true },
  });

  if (!alvo) return;

  const emUso = await prisma.npsResponse.count({
    where: { status: alvo.name },
  });

  if (emUso > 0) {
    await prisma.npsStage.update({
      where: { id },
      data: { active: false },
    });
  } else {
    await prisma.npsStage.delete({ where: { id } });
  }

  return emUso;
}

/* ============================================================
   TIPOS
============================================================ */

export async function gravarTipo(
  prisma: PrismaClient,
  input: NpsKindOption
): Promise<string | null> {

  const nome = input.name.trim();

  if (nome === "") return null;

  const dados = {
    name: nome,
    emoji: input.emoji.trim() || "⚪",
    color: input.color,
    action: input.action.trim(),
    requiresConfirmation: input.requiresConfirmation,
    requiresRootCause: input.requiresRootCause,
    opensProcessReview: input.opensProcessReview,
    ownDeadlineHours:
      input.ownDeadlineHours && input.ownDeadlineHours > 0
        ? input.ownDeadlineHours
        : null,
    order: input.order,
    active: input.active,
  };

  const novo = !input.id || input.id.startsWith("padrao-") || input.id.startsWith("novo-");

  if (novo) {

    const criado = await prisma.npsKind.create({
      data: dados,
      select: { id: true },
    });

    await semearTipos(prisma, nome);

    return criado.id;
  }

  const anterior = await prisma.npsKind.findUnique({
    where: { id: input.id },
    select: { name: true },
  });

  await prisma.npsKind.update({
    where: { id: input.id },
    data: dados,
  });

  /**
   * Renomear o tipo arrasta duas coisas, não uma.
   *
   * A resposta guarda o nome do tipo; e a **etapa final** guarda a
   * lista de tipos que a aceitam. Esquecer a segunda faria o tipo
   * renomeado perder todos os seus finais de uma vez — ficaria sem como
   * encerrar, e ninguém ligaria uma coisa à outra.
   */
  if (anterior && anterior.name !== nome) {

    await prisma.npsResponse.updateMany({
      where: { kind: anterior.name },
      data: { kind: nome },
    });

    const etapas = await prisma.npsStage.findMany({
      where: { kinds: { has: anterior.name } },
      select: { id: true, kinds: true },
    });

    for (const etapa of etapas) {
      await prisma.npsStage.update({
        where: { id: etapa.id },
        data: {
          kinds: etapa.kinds.map((k) =>
            k === anterior.name ? nome : k
          ),
        },
      });
    }
  }

  return input.id;
}

async function semearTipos(
  prisma: PrismaClient,
  exceto: string
) {

  const total = await prisma.npsKind.count();

  if (total > 1) return;

  await prisma.npsKind.createMany({
    data: TIPOS_PADRAO.filter(
      (t) => t.name !== exceto
    ).map((t) => ({
      name: t.name,
      emoji: t.emoji,
      color: t.color,
      action: t.action,
      requiresConfirmation: t.requiresConfirmation,
      requiresRootCause: t.requiresRootCause,
      opensProcessReview: t.opensProcessReview,
      ownDeadlineHours: t.ownDeadlineHours ?? null,
      order: t.order,
      active: t.active,
    })),
    skipDuplicates: true,
  });
}

/** Tipo em uso é desativado, não apagado — a série histórica fica. */
export async function removerTipo(
  prisma: PrismaClient,
  id: string
): Promise<number | undefined> {

  const alvo = await prisma.npsKind.findUnique({
    where: { id },
    select: { name: true },
  });

  if (!alvo) return;

  const emUso = await prisma.npsResponse.count({
    where: { kind: alvo.name },
  });

  if (emUso > 0) {
    await prisma.npsKind.update({
      where: { id },
      data: { active: false },
    });
  } else {
    await prisma.npsKind.delete({ where: { id } });
  }

  return emUso;
}
