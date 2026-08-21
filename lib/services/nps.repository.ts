import { PrismaClient } from "@prisma/client";

import { isEncerrado } from "@/lib/models/nps";

/**
 * Acesso ao banco para a tratativa do NPS.
 *
 * Separado das server actions pelo mesmo motivo de
 * `case.repository.ts`: a action cuida de sessão e autorização, isto
 * aqui cuida de Postgres. A divisão paga por si em dois lugares
 * concretos —
 *
 * 1. **A extensão de navegador escreve pelo cabeçalho**, não pelo
 *    cookie: `app/api/extensao/nps/` autentica com `X-CW-Sessao` e não
 *    pode chamar uma server action, que lê a sessão por `next/headers`.
 *    Sem esta camada, a regra do pós-contato existiria duas vezes — e
 *    duas cópias da mesma regra divergem na primeira correção.
 * 2. **Dá para exercitar a gravação num script**, contra o banco de
 *    verdade, sem precisar de sessão (`npm run check:nps-extensao`).
 */

/* ============================================================
   RETRATO PARA A EXTENSÃO
============================================================ */

/**
 * O que a extensão precisa saber de um ciclo de NPS.
 *
 * Mora aqui, e não dentro de cada rota, porque **duas** rotas devolvem
 * este mesmo objeto: `contexto` (ao abrir uma conversa) e `nps` (depois
 * de gravar). Se as duas montassem o retrato por conta própria, o
 * painel mostraria um estado depois de consultar e outro depois de
 * registrar — e o segundo é justamente o que a pessoa acabou de fazer.
 */
export const SELECAO_NPS = {
  id: true,
  score: true,
  status: true,
  kind: true,
  customer: true,
  phone: true,
  email: true,
  establishmentId: true,
  respondedAt: true,
  firstContactDueAt: true,
  firstContactAt: true,
  moodAfter: true,
  resolvedAfter: true,
  postContactNote: true,
  postContactAt: true,
  postContactBy: true,
  _count: { select: { attempts: true } },
} as const;

interface LinhaNps {
  id: string;
  score: number;
  status: string;
  kind: string | null;
  customer: string;
  establishmentId: string | null;
  respondedAt: Date;
  firstContactDueAt: Date;
  firstContactAt: Date | null;
  moodAfter: number | null;
  resolvedAfter: boolean | null;
  postContactNote: string | null;
  postContactAt: Date | null;
  postContactBy: string | null;
  _count: { attempts: number };
}

export interface RetratoNps {
  id: string;
  nota: number;
  status: string;
  tipo?: string;
  cliente: string;
  respondidoEm?: string;
  prazoPrimeiroContato?: string;
  primeiroContatoEm?: string;
  tentativas: number;
  establishmentId: string | null;
  encerrado: boolean;
  humor?: number;
  resolvido?: boolean;
  notaPosContato?: string;
  posContatoEm?: string;
  posContatoPor?: string;
}

export function retratoNps(linha: LinhaNps): RetratoNps {

  const dia = (valor: Date | null) =>
    valor ? valor.toISOString().slice(0, 10) : undefined;

  return {
    id: linha.id,
    nota: linha.score,
    status: linha.status,
    tipo: linha.kind ?? undefined,
    cliente: linha.customer,
    respondidoEm: dia(linha.respondedAt),
    prazoPrimeiroContato: dia(linha.firstContactDueAt),
    primeiroContatoEm: dia(linha.firstContactAt),
    tentativas: linha._count.attempts,
    establishmentId: linha.establishmentId,
    encerrado: isEncerrado(linha.status),

    humor: linha.moodAfter ?? undefined,

    /**
     * `?? undefined` e não `|| undefined`: "resolvido: não" é uma
     * resposta registrada, e `false || undefined` a transformaria em
     * "ninguém respondeu" — que é outra coisa.
     */
    resolvido: linha.resolvedAfter ?? undefined,

    notaPosContato: linha.postContactNote ?? undefined,
    posContatoEm: dia(linha.postContactAt),
    posContatoPor: linha.postContactBy ?? undefined,
  };
}

/* ============================================================
   PÓS-CONTATO
============================================================ */

export interface PosContato {
  id: string;
  mood?: number | null;
  resolved?: boolean | null;
  note?: string;
  actor?: string;
}

/**
 * Pós-contato: a régua de humor e o "resolveu ou não".
 *
 * **Por que não mexe na nota do NPS.** A nota é de antes: mede como o
 * cliente estava quando respondeu a pesquisa, e é ela que compõe o
 * indicador. Reescrevê-la depois de uma ligação bem-sucedida maquiaria
 * o NPS — o número subiria sem nenhum cliente ter mudado de opinião na
 * pesquisa. A régua mede outra coisa: se o **contato** moveu a agulha.
 *
 * `resolvedAfter` também alimenta `confirmedAt`, que é o item do
 * checklist do guia. São o mesmo fato dito de dois jeitos — o registro
 * é feito logo depois de falar com a pessoa, então "resolvido: sim" é a
 * confirmação dela. Manter dois botões para isso só criaria a dúvida de
 * qual marcar.
 *
 * Devolve `null` quando a resposta não existe, para quem chamou
 * distinguir "id errado" de "gravado".
 */
export async function aplicarPosContato(
  prisma: PrismaClient,
  input: PosContato
) {

  const humor =
    typeof input.mood === "number" &&
    input.mood >= 1 &&
    input.mood <= 5
      ? input.mood
      : null;

  const agora = new Date();

  const atual = await prisma.npsResponse.findUnique({
    where: { id: input.id },
    select: { firstContactAt: true, status: true },
  });

  if (!atual) return null;

  return prisma.npsResponse.update({
    where: { id: input.id },
    data: {
      moodAfter: humor,
      resolvedAfter: input.resolved ?? null,
      postContactNote: input.note?.trim() || null,
      postContactAt: agora,
      postContactBy: input.actor || null,

      confirmedAt:
        input.resolved === true ? agora : null,

      /**
       * Registrar o pós-contato **é** ter falado com o cliente. Sem
       * isto o SLA de primeiro contato ficaria estourado para sempre
       * em quem já foi atendido — mesmo problema que
       * `registrarTentativa` resolve para as tentativas.
       */
      firstContactAt: atual.firstContactAt ?? agora,

      /**
       * Ciclo já encerrado continua encerrado. Registrar o humor de um
       * contato posterior não é motivo para reabrir a tratativa e
       * devolver o caso à fila de quem ainda não foi atendido.
       */
      status: isEncerrado(atual.status)
        ? atual.status
        : "Em tratativa",
    },
  });
}

export interface Tentativa {
  responseId: string;
  channel: string;
  note: string;
  actor: string;
}

/**
 * Uma tentativa de contato.
 *
 * A primeira tentativa **é** o primeiro contato: sem isso o SLA ficaria
 * estourado para sempre mesmo com a operação tendo ligado. `updateMany`
 * com `firstContactAt: null` no filtro é o que garante que só a
 * primeira mova a data — a segunda encontra zero linhas e não faz nada.
 */
export async function registrarTentativa(
  prisma: PrismaClient,
  input: Tentativa
) {

  const criada = await prisma.npsAttempt.create({
    data: {
      responseId: input.responseId,
      channel: input.channel,
      note: input.note,
      actor: input.actor,
    },
    select: { id: true, createdAt: true },
  });

  await prisma.npsResponse.updateMany({
    where: {
      id: input.responseId,
      firstContactAt: null,
    },
    data: {
      firstContactAt: new Date(),
      status: "Em tratativa",
    },
  });

  return criada;
}
