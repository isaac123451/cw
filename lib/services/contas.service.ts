import type { PrismaClient } from "@prisma/client";

import { normalizeEmail } from "@/lib/auth/access";
import { CLOSED_STATUS } from "@/lib/services/case.service";

/**
 * Excluir uma conta da plataforma.
 *
 * **O pedido.** "Opções de excluir contas da plataforma é importante."
 * Havia só desativar — e a base tem conta duplicada e conta de teste com
 * papel de administrador, que desativar esconde mas não tira.
 *
 * **Excluir não pode levar o trabalho junto.** O que a pessoa tinha nas
 * mãos ou deixou escrito tem destino decidido aqui, e a tela mostra
 * antes:
 *
 * - **em aberto** (reclamação, ciclo de NPS, tarefa) passa para quem o
 *   administrador escolher — ou fica sem responsável, e aparece na fila
 *   de quem distribui;
 * - **encerrado** fica sem responsável: atribuir a outra pessoa um caso
 *   que ela não tratou mentiria nos números por responsável;
 * - **comentários e anotações** guardam o nome de quem escreveu — a
 *   autoria do histórico não some com a conta;
 * - **filtros pessoais** são apagados; os compartilhados ficam;
 * - **o e-mail sai da lista de liberados**, senão a pessoa criaria a
 *   conta de novo no dia seguinte.
 *
 * Duas travas: ninguém exclui a própria conta, e a última conta de
 * administrador ativa não sai — a plataforma ficaria sem ninguém que
 * libere acesso.
 *
 * Sem transação, de propósito: o pooler do Supabase (porta 6543) recusa
 * a transação em lote do Prisma. Cada passo é idempotente, e a conta só
 * é apagada no fim — se algo falhar no meio, ela continua lá e dá para
 * tentar de novo.
 *
 * `npm run check:exclusao` prova cada destino contra o banco.
 */

const ENCERRADO_NPS = "[Encerrado]";

export interface PreviaDaExclusao {
  id: string;
  nome: string;
  email: string;
  papel: string;
  ativo: boolean;
  /** Excluir deixaria a plataforma sem administrador ativo. */
  ultimoAdmin: boolean;

  reclamacoesAbertas: number;
  reclamacoesEncerradas: number;
  npsEmTratativa: number;
  npsEncerrados: number;
  tarefasPendentes: number;
  tarefasConcluidas: number;
  comentarios: number;
  anotacoesNps: number;
  filtrosPessoais: number;
  googleConectado: boolean;
}

async function outrosAdminsAtivos(prisma: PrismaClient, id: string) {
  return prisma.user.count({
    where: { role: "ADMIN", active: true, id: { not: id } },
  });
}

export async function previaDaExclusao(
  prisma: PrismaClient,
  id: string
): Promise<PreviaDaExclusao | null> {

  const alvo = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      googleAccount: { select: { id: true } },
    },
  });

  if (!alvo) return null;

  const [
    reclamacoesAbertas,
    reclamacoesEncerradas,
    npsEmTratativa,
    npsEncerrados,
    tarefasPendentes,
    tarefasConcluidas,
    comentarios,
    anotacoesNps,
    filtrosPessoais,
    outrosAdmins,
  ] = await Promise.all([
    prisma.case.count({ where: { ownerId: id, status: { notIn: CLOSED_STATUS } } }),
    prisma.case.count({ where: { ownerId: id, status: { in: CLOSED_STATUS } } }),
    prisma.npsResponse.count({ where: { ownerId: id, NOT: { status: { startsWith: ENCERRADO_NPS } } } }),
    prisma.npsResponse.count({ where: { ownerId: id, status: { startsWith: ENCERRADO_NPS } } }),
    prisma.agendaTask.count({ where: { ownerId: id, done: false } }),
    prisma.agendaTask.count({ where: { ownerId: id, done: true } }),
    prisma.caseComment.count({ where: { authorId: id } }),
    prisma.npsNote.count({ where: { authorId: id } }),
    prisma.savedFilter.count({ where: { ownerId: id, shared: false } }),
    outrosAdminsAtivos(prisma, id),
  ]);

  return {
    id: alvo.id,
    nome: alvo.name,
    email: alvo.email,
    papel: alvo.role,
    ativo: alvo.active,
    ultimoAdmin: alvo.role === "ADMIN" && alvo.active && outrosAdmins === 0,
    reclamacoesAbertas,
    reclamacoesEncerradas,
    npsEmTratativa,
    npsEncerrados,
    tarefasPendentes,
    tarefasConcluidas,
    comentarios,
    anotacoesNps,
    filtrosPessoais,
    googleConectado: Boolean(alvo.googleAccount),
  };
}

export type ResultadoDaExclusao =
  | {
      ok: true;
      nome: string;
      transferidas: { reclamacoes: number; nps: number; tarefas: number };
      destino: string | null;
    }
  | { ok: false; erro: string };

export async function excluirUsuario(
  prisma: PrismaClient,
  {
    alvoId,
    executorId,
    destinoId,
  }: {
    alvoId: string;
    executorId: string;
    /** Quem recebe o que está em aberto; `null` deixa sem responsável. */
    destinoId: string | null;
  }
): Promise<ResultadoDaExclusao> {

  if (alvoId === executorId) {
    return { ok: false, erro: "Você não pode excluir a própria conta." };
  }

  const alvo = await prisma.user.findUnique({
    where: { id: alvoId },
    select: { id: true, name: true, email: true, role: true, active: true },
  });

  if (!alvo) {
    return { ok: false, erro: "Esta conta não existe mais." };
  }

  if (
    alvo.role === "ADMIN" &&
    alvo.active &&
    (await outrosAdminsAtivos(prisma, alvoId)) === 0
  ) {
    return {
      ok: false,
      erro: "Esta é a única conta de administrador ativa. Dê o papel de administrador a outra pessoa antes de excluir.",
    };
  }

  let destino: { id: string; name: string } | null = null;

  if (destinoId) {
    const achado = await prisma.user.findUnique({
      where: { id: destinoId },
      select: { id: true, name: true, active: true, role: true },
    });

    if (!achado || achado.id === alvoId) {
      return { ok: false, erro: "Escolha outra pessoa para receber o que está em aberto." };
    }

    if (!achado.active) {
      return { ok: false, erro: `${achado.name} está com a conta desativada.` };
    }

    /* Quem só lê não move o caso: o que está em aberto ficaria parado. */
    if (achado.role === "LEITURA") {
      return {
        ok: false,
        erro: `${achado.name} só tem acesso de leitura e não conseguiria tratar o que está em aberto.`,
      };
    }

    destino = { id: achado.id, name: achado.name };
  }

  const novoDono = destino?.id ?? null;

  /* 1. O que está em aberto: para o destino escolhido. */
  const reclamacoes = await prisma.case.updateMany({
    where: { ownerId: alvoId, status: { notIn: CLOSED_STATUS } },
    data: { ownerId: novoDono },
  });

  const nps = await prisma.npsResponse.updateMany({
    where: { ownerId: alvoId, NOT: { status: { startsWith: ENCERRADO_NPS } } },
    data: { ownerId: novoDono },
  });

  const tarefas = await prisma.agendaTask.updateMany({
    where: { ownerId: alvoId, done: false },
    data: { ownerId: novoDono },
  });

  /* 2. O que já foi encerrado: sem responsável, e não atribuído a outro. */
  await prisma.case.updateMany({ where: { ownerId: alvoId }, data: { ownerId: null } });
  await prisma.npsResponse.updateMany({ where: { ownerId: alvoId }, data: { ownerId: null } });
  await prisma.agendaTask.updateMany({ where: { ownerId: alvoId }, data: { ownerId: null } });

  /* 3. A autoria do histórico fica, pelo nome. */
  await prisma.caseComment.updateMany({
    where: { authorId: alvoId, authorName: null },
    data: { authorName: alvo.name },
  });
  await prisma.caseComment.updateMany({ where: { authorId: alvoId }, data: { authorId: null } });

  await prisma.npsNote.updateMany({
    where: { authorId: alvoId, actor: "" },
    data: { actor: alvo.name },
  });
  await prisma.npsNote.updateMany({ where: { authorId: alvoId }, data: { authorId: null } });

  /* 4. Filtros: os pessoais vão junto; os compartilhados ficam para a operação. */
  await prisma.savedFilter.deleteMany({ where: { ownerId: alvoId, shared: false } });
  await prisma.savedFilter.updateMany({ where: { ownerId: alvoId }, data: { ownerId: null } });

  /* 5. O e-mail deixa de estar liberado. */
  await prisma.allowedEmail.deleteMany({
    where: { email: normalizeEmail(alvo.email) },
  });

  /* 6. A conta — preferências, Google, papéis por módulo e códigos vão em cascata. */
  await prisma.user.delete({ where: { id: alvoId } });

  return {
    ok: true,
    nome: alvo.name,
    transferidas: {
      reclamacoes: reclamacoes.count,
      nps: nps.count,
      tarefas: tarefas.count,
    },
    destino: destino?.name ?? null,
  };
}
