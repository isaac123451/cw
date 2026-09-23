"use server";

import { requireRole, tryRole } from "@/lib/auth/guard";
import type { Modulo } from "@/lib/auth/modules";

import {
  authorizeUrl,
  createEvent,
  deleteEvent,
  gravarEventoDoPlano,
  hasGoogle,
  listarEventosDoPlano,
  listUpcomingEvents,
  updateEvent,
  validAccessToken,
} from "@/lib/services/google.service";

import {
  GoogleEvent,
  GoogleEventDraft,
} from "@/lib/models/google";
import { linkDoDia, sincronizacao, type EventoDoPlano } from "@/lib/models/planoNaAgenda";
import { paredeDe } from "@/lib/services/horasUteis";

/** O módulo a que estas ações pertencem — ver lib/auth/modules.ts. */
const MODULO: Modulo = "agenda";

/**
 * Conexão do Google Agenda, sempre do usuário **da sessão**.
 *
 * Nenhuma action aceita `userId` por parâmetro de propósito: quem manda
 * é o cookie de sessão. Recebendo id de fora, qualquer pessoa logada
 * leria a agenda de outra só trocando o valor.
 */

/**
 * `LEITURA` basta: é a agenda **da própria pessoa**, não dado da
 * operação. Mas passa pelo `requireRole` mesmo assim, que é o que
 * derruba conta desativada — checar só o cookie deixaria quem foi
 * desligado seguir usando até a sessão expirar.
 */
async function contexto() {

  const ctx = await requireRole("LEITURA", MODULO);

  return ctx
    ? { prisma: ctx.prisma, userId: ctx.userId }
    : null;
}

export interface GoogleStatus {
  configurado: boolean;
  conectado: boolean;
  email?: string;
}

export async function getGoogleStatus(): Promise<GoogleStatus> {

  const configurado = hasGoogle();

  // Leitura: `tryRole` devolve null sem sessão, em vez de lançar.
  const ctx = await tryRole("LEITURA", MODULO);

  if (!ctx) return { configurado, conectado: false };

  const conta = await ctx.prisma.googleAccount.findUnique(
    {
      where: { userId: ctx.userId },
      select: { email: true },
    }
  );

  if (!conta) {
    return { configurado, conectado: false };
  }

  return {
    configurado,
    conectado: true,
    email: conta.email,
  };
}

/** Devolve a URL de consentimento; a tela redireciona para ela. */
export async function startGoogleAuth() {

  if (!hasGoogle()) {
    throw new Error(
      "Integração não configurada. Defina GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET."
    );
  }

  const ctx = await contexto();

  if (!ctx) {
    throw new Error("Banco não configurado.");
  }

  return authorizeUrl(ctx.userId);
}

export async function disconnectGoogle() {

  const ctx = await contexto();

  if (!ctx) return;

  await ctx.prisma.googleAccount.deleteMany({
    where: { userId: ctx.userId },
  });
}

export async function getUpcomingEvents(janela?: {
  start?: string;
  end?: string;
  dias?: number;
}): Promise<{
  events: GoogleEvent[];
  error?: string;
}> {

  const ctx = await tryRole("LEITURA", MODULO);

  if (!ctx) return { events: [] };

  try {

    const token = await validAccessToken(
      ctx.prisma,
      ctx.userId
    );

    if (!token) return { events: [] };

    return {
      events: await listUpcomingEvents(token, janela),
    };

  } catch (error) {
    return {
      events: [],
      error:
        error instanceof Error
          ? error.message
          : "Falha ao ler a agenda.",
    };
  }
}

/**
 * Roda algo com um token válido, traduzindo falha em `{ ok, error }`.
 *
 * As telas mostram o motivo em vez de estourar: erro de rede ou permissão
 * do Google é situação normal aqui, não defeito da aplicação.
 */
async function comToken<T>(
  acao: (token: string) => Promise<T>
): Promise<
  { ok: true; dados: T } | { ok: false; error: string }
> {

  const ctx = await contexto();

  if (!ctx) {
    return { ok: false, error: "Banco não configurado." };
  }

  try {

    const token = await validAccessToken(
      ctx.prisma,
      ctx.userId
    );

    if (!token) {
      return {
        ok: false,
        error: "Conecte sua conta do Google primeiro.",
      };
    }

    return { ok: true, dados: await acao(token) };

  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Falha ao falar com o Google.",
    };
  }
}

/** Cria um evento — usado pelo botão da tarefa e pelo formulário. */
export async function pushTaskToGoogle(
  input: GoogleEventDraft
) {

  const r = await comToken((token) =>
    createEvent(token, input)
  );

  return r.ok
    ? { ok: true as const, link: r.dados }
    : { ok: false as const, error: r.error };
}

export async function updateGoogleEvent(
  eventId: string,
  input: GoogleEventDraft
) {

  const r = await comToken((token) =>
    updateEvent(token, eventId, input)
  );

  return r.ok
    ? { ok: true as const, link: r.dados }
    : { ok: false as const, error: r.error };
}

export async function deleteGoogleEvent(
  eventId: string
) {

  const r = await comToken((token) =>
    deleteEvent(token, eventId)
  );

  return r.ok
    ? { ok: true as const }
    : { ok: false as const, error: r.error };
}

/**
 * Leva o plano do dia para a Google Agenda da própria pessoa.
 *
 * Um evento por bloco, marcado com o dia e o bloco. Mandar de novo
 * atualiza os mesmos eventos, cria os novos e tira os que saíram do
 * plano — o que já terminou fica, e evento sem a marca não é tocado.
 */
export async function levarPlanoParaAgenda(entrada: {
  dia: string;
  eventos: EventoDoPlano[];
}): Promise<{ ok: true; criados: number; atualizados: number; removidos: number; link: string } | { ok: false; error: string }> {

  const hoje = paredeDe(new Date()).dia;
  if (entrada.dia !== hoje) return { ok: false, error: "Só o plano de hoje vai para a agenda. Recarregue a página." };
  if (!Array.isArray(entrada.eventos) || entrada.eventos.length > 40) return { ok: false, error: "O plano veio num formato inesperado. Recarregue a página." };

  const hora = /^([01]\d|2[0-3]):[0-5]\d$/;
  for (const e of entrada.eventos) {
    if (!hora.test(e.inicio) || !hora.test(e.fim) || e.fim <= e.inicio) return { ok: false, error: `O bloco "${e.titulo}" tem um horário inválido.` };
    if (!e.chave || e.chave.length > 160 || !e.titulo || e.titulo.length > 200 || e.descricao.length > 6000) {
      return { ok: false, error: "O plano veio num formato inesperado. Recarregue a página." };
    }
  }

  const r = await comToken(async (token) => {
    const existentes = await listarEventosDoPlano(token, entrada.dia);
    const s = sincronizacao(existentes, entrada.eventos, new Date());
    /* Em paralelo: uma dúzia de blocos, um de cada vez, passava do tempo de uma ação do servidor. */
    await Promise.all([
      ...s.criar.map((e) => gravarEventoDoPlano(token, entrada.dia, e)),
      ...s.atualizar.map(({ id, evento }) => gravarEventoDoPlano(token, entrada.dia, evento, id)),
      ...s.apagar.map((id) => deleteEvent(token, id)),
    ]);
    return { criados: s.criar.length, atualizados: s.atualizar.length, removidos: s.apagar.length };
  });

  return r.ok ? { ok: true, ...r.dados, link: linkDoDia(entrada.dia) } : { ok: false, error: r.error };
}
