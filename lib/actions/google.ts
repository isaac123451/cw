"use server";

import { requireRole, tryRole } from "@/lib/auth/guard";
import type { Modulo } from "@/lib/auth/modules";

import {
  authorizeUrl,
  createEvent,
  deleteEvent,
  hasGoogle,
  listUpcomingEvents,
  updateEvent,
  validAccessToken,
} from "@/lib/services/google.service";

import { podeLerEmail as podeLerEmailNoGmail } from "@/lib/services/gmail.service";

import {
  GoogleEvent,
  GoogleEventDraft,
} from "@/lib/models/google";

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

  /**
   * A conta tem permissao de ler e-mail?
   *
   * O escopo `gmail.readonly` entrou depois que a integracao ja
   * existia, e um escopo novo nao se aplica a quem ja autorizou: o
   * token antigo continua valendo para agenda e recusa o Gmail com
   * 403. Sem este campo, a entrada automatica de reclamacoes
   * simplesmente nao acontecia, e o unico lugar onde isso aparecia era
   * o JSON da rotina agendada, que ninguem abre.
   *
   * `undefined` quando nao ha conta conectada: nao ha o que responder.
   */
  podeLerEmail?: boolean;
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

  /*
    A permissao e conferida contra o Google, nao deduzida do banco.

    Guardar "pedimos o escopo tal" na hora de conectar diria o que foi
    pedido, nao o que foi concedido — e sao coisas diferentes quando o
    administrador do Workspace restringe. Uma chamada minima responde a
    pergunta certa: este token, agora, consegue ler?
  */
  const token = await validAccessToken(
    ctx.prisma,
    ctx.userId
  );

  const leitura = token
    ? await podeLerEmailNoGmail(token)
    : { ok: false as const };

  return {
    configurado,
    conectado: true,
    email: conta.email,
    podeLerEmail: leitura.ok,
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
