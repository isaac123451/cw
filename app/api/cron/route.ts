import { revalidateTag } from "next/cache";

import { Prisma, PrismaClient } from "@prisma/client";

import { checkCronToken } from "@/lib/api/auth";
import { WORKSPACE_TAG } from "@/lib/actions/tags";
import { getPrisma } from "@/lib/prisma";

import { digitosDoDocumento } from "@/lib/models/establishment";

import {
  isEncerrado,
  NpsResponseView,
} from "@/lib/models/nps";
import { deveEncerrarSemRetorno } from "@/lib/services/nps.service";

import { movementStatus } from "@/lib/services/movement.service";
import { deliverWebhook } from "@/lib/services/webhook.service";

import { limparDesafiosVelhos } from "@/lib/auth/two-factor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Tempo máximo por rodada.
 *
 * A rotina toca três coisas e cada uma pode ir à rede. Sessenta segundos
 * é o teto do plano gratuito da Vercel; o corte por lote abaixo é o que
 * garante que ela termine bem antes disso.
 */
export const maxDuration = 60;

/**
 * A rotina agendada.
 *
 * Três coisas dependiam de existir alguém rodando sem ninguém com a tela
 * aberta — e as três estavam quebradas do mesmo jeito, cada uma por um
 * motivo diferente de parecer que funcionava:
 *
 * 1. **O encerramento automático do NPS.** A regra dos 30 dias sem
 *    resposta existia, mas só era avaliada quando alguém abria o `/nps`.
 *    Numa semana sem ninguém abrir a tela, o indicador de resolução
 *    contava como aberto o que já tinha morrido de velho.
 *
 * 2. **`movimentacao.atrasada`.** O evento não existia porque atraso não
 *    é gravação: os outros dois webhooks nascem de alguém salvar um
 *    caso, este nasce do relógio passar. Sem rotina não havia de onde
 *    dispará-lo.
 *
 * 3. **O reenvio de webhook que falhou.** A entrega registrava a falha e
 *    parava ali. Quem recebe estava fora do ar por dez minutos perdia o
 *    evento para sempre, e o log dizia "falhou" como se isso fosse um
 *    desfecho.
 *
 * **É idempotente.** Roda de novo sem repetir trabalho: o encerramento
 * olha só o que ainda está aberto, o aviso de atraso carimba
 * `lateNotifiedAt`, e o reenvio apaga o corpo guardado ao acertar. Isso
 * importa porque cron falha e é reexecutado — e um alerta que se repete
 * toda madrugada é um alerta que se aprende a ignorar.
 *
 * Protegida por `CRON_SECRET` (o que a Vercel manda) ou pelo `API_TOKEN`,
 * que é o que permite disparar à mão para conferir:
 *
 * ```bash
 * curl -H "Authorization: Bearer $API_TOKEN" https://.../api/cron
 * ```
 */

/** Teto por rodada, para a requisição terminar dentro do relógio. */
const LOTE = 50;

/** Falha mais velha que isto não é reenviada: o evento já não descreve nada. */
const REENVIO_MAXIMO_HORAS = 24;

/** Quantas vezes uma mesma mensagem é tentada, no total. */
const TENTATIVAS_MAXIMAS = 5;

export async function GET(request: Request) {

  const barrado = checkCronToken(request);

  if (barrado) return barrado;

  const prisma = getPrisma();

  if (!prisma) {
    return Response.json(
      { erro: "Sem banco configurado." },
      { status: 503 }
    );
  }

  const inicio = Date.now();

  const [
    nps,
    movimentacoes,
    reenvios,
    vinculos,
    desafios,
  ] = await Promise.all([
    encerrarNpsAbandonado(prisma),
    avisarMovimentacoesAtrasadas(prisma),
    reenviarWebhooksFalhados(prisma),
    vincularPorCnpj(prisma),
    /**
     * Faxina dos códigos de verificação vencidos.
     *
     * É dado de acesso — hash de código de login. Não deve ficar por
     * perto mais do que precisa, e sem faxina a tabela só cresce
     * guardando o que ninguém mais vai usar.
     */
    limparDesafiosVelhos(),
  ]);

  /**
   * A etiqueta é invalidada uma vez, no fim.
   *
   * As três tarefas mexem em dados que a carga do workspace serve, e
   * invalidar dentro de cada uma faria três recargas em cascata para o
   * primeiro que abrisse a tela depois.
   */
  if (
    nps.encerrados > 0 ||
    movimentacoes.avisadas > 0 ||
    vinculos.vinculados > 0
  ) {
    revalidateTag(WORKSPACE_TAG, "max");
  }

  return Response.json({
    ok: true,
    duracaoMs: Date.now() - inicio,
    nps,
    movimentacoes,
    reenvios,
    vinculos,
    desafiosApagados: desafios,
  });
}

/**
 * Vercel Cron chama por GET; o POST existe para quem preferir agendar de
 * fora (um scheduler próprio, um `curl` no cron do sistema).
 */
export const POST = GET;

/* ============================================================
   1. NPS ABANDONADO
============================================================ */

/**
 * Encerra por falta de retorno o que a regra do guia já autoriza.
 *
 * A decisão de encerrar é a mesma de `deveEncerrarSemRetorno`, usada
 * pela tela — de propósito: duas cópias dessa regra fariam a tela e a
 * rotina discordarem sobre o mesmo ciclo, e a operação descobriria isso
 * na forma de um registro que fecha sozinho e reabre no dia seguinte.
 */
async function encerrarNpsAbandonado(
  prisma: NonNullable<ReturnType<typeof getPrisma>>
) {

  const abertos = await prisma.npsResponse.findMany({
    where: { closedAt: null },
    include: {
      attempts: {
        select: { createdAt: true },
        orderBy: { createdAt: "asc" },
      },
    },
    take: 500,
  });

  const alvos = abertos
    .map((linha) => ({
      id: linha.id,
      vista: {
        status: linha.status,
        respondedAt: linha.respondedAt.toISOString(),
        confirmedAt:
          linha.confirmedAt?.toISOString(),
        attempts: linha.attempts.map((a) => ({
          createdAt: a.createdAt.toISOString(),
        })),
      } as NpsResponseView,
    }))
    .filter(({ vista }) => !isEncerrado(vista.status))
    .map(({ id, vista }) => ({
      id,
      veredito: deveEncerrarSemRetorno(vista),
    }))
    .filter(({ veredito }) => veredito.deve)
    .slice(0, LOTE);

  if (alvos.length === 0) {
    return { avaliados: abertos.length, encerrados: 0 };
  }

  const agora = new Date();

  await prisma.npsResponse.updateMany({
    where: { id: { in: alvos.map((a) => a.id) } },
    data: {
      status: "[Encerrado] Sem Retorno",
      outcome: "[Encerrado] Sem Retorno",
      closedAt: agora,
    },
  });

  return {
    avaliados: abertos.length,
    encerrados: alvos.length,
    motivos: alvos
      .slice(0, 5)
      .map((a) => a.veredito.motivo),
  };
}

/* ============================================================
   2. MOVIMENTAÇÃO ATRASADA
============================================================ */

/**
 * Avisa uma vez por movimentação que estourou o prazo.
 *
 * O carimbo `lateNotifiedAt` é o que separa "avisar" de "cobrar todo
 * dia". Ele é gravado **mesmo sem webhook configurado** — assim ligar a
 * integração amanhã não dispara um lote de avisos sobre atrasos velhos,
 * que é a primeira impressão errada que a integração poderia dar.
 */
async function avisarMovimentacoesAtrasadas(
  prisma: NonNullable<ReturnType<typeof getPrisma>>
) {

  const pendentes = await prisma.caseMovement.findMany({
    where: { returnedAt: null, lateNotifiedAt: null },
    include: {
      case: {
        select: {
          protocol: true,
          title: true,
          status: true,
          customer: true,
          companyName: true,
        },
      },
    },
    orderBy: { startedAt: "asc" },
    take: 200,
  });

  const atrasadas = pendentes
    .filter((item) => {

      const estado = movementStatus({
        id: item.id,
        caseId: item.caseId,
        destination: item.destination,
        reason: item.reason,
        actor: item.actor,
        startedAt: item.startedAt
          .toISOString()
          .slice(0, 10),
        dueHours: item.dueHours,
        returnedAt: undefined,
        outcome: undefined,
      });

      return estado.situation === "estourado";
    })
    .slice(0, LOTE);

  if (atrasadas.length === 0) {
    return { pendentes: pendentes.length, avisadas: 0 };
  }

  const webhook = await prisma.webhookConfig.findFirst({
    where: {
      active: true,
      events: { has: "movimentacao.atrasada" },
    },
  });

  let entregues = 0;

  for (const item of atrasadas) {

    if (webhook) {

      const entregue = await deliverWebhook(
        prisma,
        webhook,
        "movimentacao.atrasada",
        {
          protocolo: item.case.protocol,
          titulo: item.case.title,
          statusDoCaso: item.case.status,
          cliente: item.case.customer,
          empresa: item.case.companyName,
          destino: item.destination,
          motivo: item.reason,
          encaminhadoPor: item.actor,
          encaminhadoEm: item.startedAt.toISOString(),
          prazoHoras: item.dueHours,
        },
        item.case.protocol
      );

      if (entregue) entregues += 1;
    }

    await prisma.caseMovement.update({
      where: { id: item.id },
      data: { lateNotifiedAt: new Date() },
    });
  }

  return {
    pendentes: pendentes.length,
    avisadas: atrasadas.length,
    entregues,
    comWebhook: Boolean(webhook),
  };
}

/* ============================================================
   3. REENVIO DE WEBHOOK
============================================================ */

/**
 * Tenta de novo o que falhou, com o **mesmo corpo**.
 *
 * Remontar a mensagem a partir do caso entregaria um retrato diferente
 * do que a primeira tentativa prometeu — e quem recebe não teria como
 * notar. Por isso a entrega guarda o corpo quando falha, e só quando
 * falha.
 *
 * Falha com mais de um dia não é reenviada: o evento já não descreve o
 * que está acontecendo, e entregá-lo agora é pior do que não entregar.
 */
async function reenviarWebhooksFalhados(
  prisma: NonNullable<ReturnType<typeof getPrisma>>
) {

  const desde = new Date(
    Date.now() - REENVIO_MAXIMO_HORAS * 3600000
  );

  /**
   * `payload` não nulo é a marca de "há o que reenviar".
   *
   * O Prisma exige `Prisma.DbNull` para comparar coluna `Json` com
   * nulo — `{ not: null }` não passa no tipo, e é justamente a
   * distinção entre "JSON nulo" e "coluna vazia" que ele quer que se
   * declare.
   */
  const falhadas = await prisma.webhookDelivery.findMany({
    where: {
      ok: false,
      payload: { not: Prisma.DbNull },
      attempts: { lt: TENTATIVAS_MAXIMAS },
      createdAt: { gte: desde },
    },
    include: { webhook: true },
    orderBy: { createdAt: "asc" },
    take: LOTE,
  });

  let entregues = 0;

  for (const tentativa of falhadas) {

    if (!tentativa.webhook.active) continue;

    const entregue = await deliverWebhook(
      prisma,
      tentativa.webhook,
      tentativa.event,
      null,
      tentativa.caseProtocol ?? undefined,
      String(tentativa.payload),
      tentativa.attempts + 1
    );

    if (entregue) entregues += 1;

    /**
     * A tentativa anterior sai do histórico.
     *
     * Sem isto ela seria reenviada de novo na próxima rodada — a nova
     * linha registra o desfecho, e duas linhas com o mesmo corpo
     * pendente fariam a fila crescer sozinha.
     */
    await prisma.webhookDelivery.delete({
      where: { id: tentativa.id },
    });
  }

  return {
    pendentes: falhadas.length,
    entregues,
  };
}

/* ============================================================
   4. VÍNCULO CLIENTE ↔ ESTABELECIMENTO
============================================================ */

/**
 * Liga reclamações a estabelecimentos pelo CNPJ.
 *
 * A extensão grava o CNPJ do RA Forms em toda reclamação que captura,
 * mesmo quando o restaurante ainda não está cadastrado aqui. Sem esta
 * varredura, essas reclamações ficariam órfãs para sempre: o vínculo é
 * tentado na hora de gravar o caso, e o caso não é gravado de novo só
 * porque alguém cadastrou o estabelecimento depois.
 *
 * É o mesmo desenho das outras três tarefas — **idempotente**. Só entram
 * casos com CNPJ e sem vínculo, então rodar de novo em seguida vincula
 * zero. E é o que torna a ordem indiferente: cadastrar o estabelecimento
 * antes ou depois de capturar a reclamação dá no mesmo, com no máximo
 * um ciclo de atraso.
 *
 * Não desfaz vínculo. Um caso que já aponta para um estabelecimento
 * ficou assim por decisão de alguém na tela, ou por um CNPJ que batia na
 * época; reescrever isso aqui seria o cron discordando de uma pessoa sem
 * dizer nada.
 */
async function vincularPorCnpj(prisma: PrismaClient) {

  const cadastros = await prisma.establishment.findMany({
    where: { document: { not: null } },
    select: { id: true, document: true },
  });

  if (cadastros.length === 0) {
    return { vinculados: 0, semCadastro: 0 };
  }

  /**
   * O mapa é por dígitos porque o cadastro é preenchido à mão.
   *
   * A máscara não é obrigatória, e a base tem `12.345.678/0001-90` e
   * `12345678000190` para restaurantes diferentes. Comparar texto com
   * texto deixaria metade dos vínculos sem casar, sem sinal de erro.
   */
  const porDocumento = new Map<string, string>();

  for (const row of cadastros) {

    const digitos = digitosDoDocumento(row.document);

    if (digitos) porDocumento.set(digitos, row.id);
  }

  const orfaos = await prisma.case.findMany({
    where: {
      document: { not: null },
      establishmentId: null,

      /**
       * Desvincular na mão dura. Sem esta linha, a varredura religaria
       * pelo CNPJ na madrugada seguinte, e o botão de desvincular
       * pareceria não funcionar.
       */
      establishmentManual: false,
    },
    select: { id: true, document: true },
  });

  let vinculados = 0;
  let semCadastro = 0;

  for (const caso of orfaos) {

    const alvo = porDocumento.get(caso.document ?? "");

    if (!alvo) {
      semCadastro += 1;
      continue;
    }

    await prisma.case.update({
      where: { id: caso.id },
      data: { establishmentId: alvo },
    });

    vinculados += 1;
  }

  return { vinculados, semCadastro };
}
