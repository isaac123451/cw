import "server-only";

import { SignJWT, jwtVerify } from "jose";

import { PrismaClient } from "@prisma/client";

import {
  GOOGLE_SCOPES,
  GoogleEvent,
  RepeatKind,
  RepeatRule,
} from "@/lib/models/google";

/**
 * OAuth do Google para conectar a agenda de **cada usuário**.
 *
 * Sem `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` a integração fica
 * desligada e a tela mostra o passo a passo — mesmo critério da API por
 * token: recurso que depende de segredo não fica meio ligado.
 */

const AUTH_URL =
  "https://accounts.google.com/o/oauth2/v2/auth";

const TOKEN_URL = "https://oauth2.googleapis.com/token";

const EVENTS_URL =
  "https://www.googleapis.com/calendar/v3/calendars/primary/events";

/** Renova um pouco antes de vencer: relógio do servidor não é exato. */
const MARGEM_SEGUNDOS = 60;

export function hasGoogle() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET
  );
}

/**
 * Endereço de retorno registrado no Google.
 *
 * Precisa bater **exatamente** com o que está no console, incluindo
 * protocolo e porta. Em produção vem de `NEXT_PUBLIC_APP_URL`; sem ela,
 * cai no localhost do desenvolvimento.
 */
export function redirectUri() {

  const base = (
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000"
  ).replace(/\/$/, "");

  return `${base}/api/google/callback`;
}

function secret() {

  const value =
    process.env.AUTH_SECRET ??
    process.env.NEXTAUTH_SECRET;

  if (!value) {
    throw new Error(
      "AUTH_SECRET não definido — necessário para assinar o state do OAuth."
    );
  }

  return new TextEncoder().encode(value);
}

/**
 * `state` assinado, com o id de quem pediu.
 *
 * Impede que alguém induza a vítima a completar um fluxo iniciado por
 * outra pessoa (CSRF de OAuth) e diz de quem é o token que voltou —
 * sem precisar de tabela para guardar nonce.
 */
export async function createState(userId: string) {
  return new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(secret());
}

export async function readState(state: string) {
  try {
    const { payload } = await jwtVerify(
      state,
      secret()
    );

    return typeof payload.userId === "string"
      ? payload.userId
      : null;

  } catch {
    return null;
  }
}

export async function authorizeUrl(userId: string) {

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: GOOGLE_SCOPES,
    // `offline` + `consent` garantem o refresh token: sem ele a conexão
    // morre em uma hora e a pessoa teria que reconectar toda vez.
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state: await createState(userId),
  });

  return `${AUTH_URL}?${params.toString()}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  error?: string;
  error_description?: string;
}

async function postToken(
  body: Record<string, string>
): Promise<TokenResponse> {

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret:
        process.env.GOOGLE_CLIENT_SECRET ?? "",
      ...body,
    }),
  });

  const data = (await res.json()) as TokenResponse;

  if (!res.ok || data.error) {
    throw new Error(
      data.error_description ??
        data.error ??
        `Google respondeu ${res.status}.`
    );
  }

  return data;
}

export async function exchangeCode(code: string) {
  return postToken({
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri(),
  });
}

export async function fetchGoogleEmail(
  accessToken: string
) {

  const res = await fetch(
    "https://www.googleapis.com/oauth2/v2/userinfo",
    {
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!res.ok) return "";

  const data = (await res.json()) as { email?: string };

  return data.email ?? "";
}

/**
 * Devolve um access token válido, renovando se preciso.
 *
 * O Google só entrega refresh token no primeiro consentimento, então a
 * renovação **não** o sobrescreve quando vem vazio — fazer isso apagaria
 * a conexão sem aviso na próxima renovação.
 */
export async function validAccessToken(
  prisma: PrismaClient,
  userId: string
): Promise<string | null> {

  const conta = await prisma.googleAccount.findUnique({
    where: { userId },
  });

  if (!conta) return null;

  const vencido =
    conta.expiresAt.getTime() - MARGEM_SEGUNDOS * 1000 <
    Date.now();

  if (!vencido) return conta.accessToken;

  const novo = await postToken({
    refresh_token: conta.refreshToken,
    grant_type: "refresh_token",
  });

  await prisma.googleAccount.update({
    where: { userId },
    data: {
      accessToken: novo.access_token,
      expiresAt: new Date(
        Date.now() + novo.expires_in * 1000
      ),
      ...(novo.refresh_token
        ? { refreshToken: novo.refresh_token }
        : {}),
    },
  });

  return novo.access_token;
}

/**
 * Eventos da agenda principal numa janela.
 *
 * Sem `janela`, do momento atual a 14 dias à frente. Com janela livre, o
 * dia inteiro entra dos dois lados — quem escolhe "de 20 a 25" espera
 * ver o que acontece no dia 25, não só até a hora atual dele.
 */
export async function listUpcomingEvents(
  accessToken: string,
  janela?: { start?: string; end?: string; dias?: number }
): Promise<GoogleEvent[]> {

  const agora = new Date();

  const timeMin = janela?.start
    ? new Date(`${janela.start}T00:00:00`).toISOString()
    : agora.toISOString();

  const timeMax = janela?.end
    ? new Date(`${janela.end}T23:59:59`).toISOString()
    : new Date(
        agora.getTime() +
          (janela?.dias ?? 14) * 86400000
      ).toISOString();

  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "100",
  });

  const res = await fetch(
    `${EVENTS_URL}?${params.toString()}`,
    {
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!res.ok) {
    throw new Error(
      `Não foi possível ler a agenda (Google respondeu ${res.status}).`
    );
  }

  const data = (await res.json()) as {
    items?: {
      id: string;
      summary?: string;
      description?: string;
      htmlLink?: string;
      guestsCanModify?: boolean;
      recurringEventId?: string;
      creator?: { self?: boolean };
      organizer?: { self?: boolean };
      start?: { dateTime?: string; date?: string };
      end?: { dateTime?: string; date?: string };
    }[];
  };

  return (data.items ?? []).map((item) => {

    const inicio =
      item.start?.dateTime ?? item.start?.date ?? "";

    const allDay = !item.start?.dateTime;

    /**
     * `dateTime` vem com fuso ("2026-08-14T12:00:00-03:00").
     * Recortar o texto preserva o horário como o Google mostra; passar
     * por `new Date()` converteria para o fuso de quem roda o servidor.
     */
    const date = inicio.slice(0, 10);

    const time = allDay
      ? undefined
      : inicio.slice(11, 16);

    const endTime =
      allDay || !item.end?.dateTime
        ? undefined
        : item.end.dateTime.slice(11, 16);

    return {
      id: item.id,
      title: item.summary ?? "(sem título)",
      description: item.description,
      start: inicio,
      end: item.end?.dateTime ?? item.end?.date,
      allDay,
      link: item.htmlLink,
      date,
      time,
      endTime,
      // Só quem organiza (ou tem permissão) consegue gravar de volta.
      readOnly: !(
        item.organizer?.self ??
        item.creator?.self ??
        false
      ) && !item.guestsCanModify,

      recurring: Boolean(item.recurringEventId),
    };
  });
}

/**
 * Traduz a repetição da tela para RRULE do iCalendar, que é o que o
 * Google entende.
 */
function regraRepeticao(
  repeat?: RepeatRule
): string[] | undefined {

  if (!repeat || repeat.kind === "nenhuma") {
    return undefined;
  }

  const base: Record<
    Exclude<RepeatKind, "nenhuma" | "personalizada">,
    string
  > = {
    diaria: "FREQ=DAILY",
    semanal: "FREQ=WEEKLY",
    quinzenal: "FREQ=WEEKLY;INTERVAL=2",
    mensal: "FREQ=MONTHLY",
  };

  const regra =
    repeat.kind === "personalizada"
      ? `FREQ=DAILY;INTERVAL=${Math.max(
          repeat.everyDays ?? 7,
          1
        )}`
      : base[repeat.kind];

  // UNTIL é sempre em UTC e inclusivo até o fim do dia escolhido.
  const ate = repeat.until
    ? `;UNTIL=${repeat.until.replace(
        /-/g,
        ""
      )}T235959Z`
    : "";

  return [`RRULE:${regra}${ate}`];
}

/** Corpo do evento, compartilhado entre criar e editar. */
function corpoEvento(input: {
  title: string;
  date: string;
  time?: string;
  endTime?: string;
  description?: string;
  repeat?: RepeatRule;
}) {

  const recurrence = regraRepeticao(input.repeat);

  // Sem horário vira evento de dia inteiro, que é como a tarefa nasce.
  if (!input.time) {
    return {
      summary: input.title,
      description: input.description,
      start: { date: input.date },
      end: { date: input.date },
      ...(recurrence ? { recurrence } : {}),
    };
  }

  /**
   * Término anterior ao início faria o Google recusar o evento inteiro.
   * Nesse caso vale a hora seguinte ao início — o mesmo padrão de quem
   * não informou término.
   */
  const fim =
    input.endTime && input.endTime > input.time
      ? input.endTime
      : somarHora(input.time);

  return {
    summary: input.title,
    description: input.description,
    start: {
      dateTime: `${input.date}T${input.time}:00`,
      timeZone: "America/Sao_Paulo",
    },
    end: {
      dateTime: `${input.date}T${fim}:00`,
      timeZone: "America/Sao_Paulo",
    },
    ...(recurrence ? { recurrence } : {}),
  };
}

/** Cria um evento a partir de uma tarefa da operação. */
export async function createEvent(
  accessToken: string,
  input: {
    title: string;
    date: string;
    time?: string;
    description?: string;
  }
) {

  const res = await fetch(EVENTS_URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(corpoEvento(input)),
  });

  if (!res.ok) {
    throw new Error(
      `O Google recusou o evento (${res.status}).`
    );
  }

  const data = (await res.json()) as {
    htmlLink?: string;
  };

  return data.htmlLink ?? "";
}

/**
 * Reescreve um evento existente.
 *
 * `PUT` e não `PATCH`: o formulário manda o evento inteiro, e o `PATCH`
 * deixaria resíduo — tirar o horário de um evento com hora não apagaria
 * o `dateTime` antigo, e o Google recusaria por ter data e dateTime
 * juntos.
 */
export async function updateEvent(
  accessToken: string,
  eventId: string,
  input: {
    title: string;
    date: string;
    time?: string;
    description?: string;
  }
) {

  const res = await fetch(
    `${EVENTS_URL}/${encodeURIComponent(eventId)}`,
    {
      method: "PUT",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(corpoEvento(input)),
    }
  );

  if (!res.ok) {
    throw new Error(
      res.status === 403
        ? "Sem permissão para editar este evento."
        : `O Google recusou a alteração (${res.status}).`
    );
  }

  const data = (await res.json()) as {
    htmlLink?: string;
  };

  return data.htmlLink ?? "";
}

export async function deleteEvent(
  accessToken: string,
  eventId: string
) {

  const res = await fetch(
    `${EVENTS_URL}/${encodeURIComponent(eventId)}`,
    {
      method: "DELETE",
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    }
  );

  // 410 = já estava apagado. Para quem clicou, o resultado é o mesmo.
  if (!res.ok && res.status !== 410) {
    throw new Error(
      res.status === 403
        ? "Sem permissão para excluir este evento."
        : `O Google recusou a exclusão (${res.status}).`
    );
  }
}

/** "14:30" -> "15:30", com virada de dia protegida. */
function somarHora(time: string) {

  const [h, m] = time.split(":").map(Number);

  const hora = Math.min(h + 1, 23);

  return `${String(hora).padStart(2, "0")}:${String(
    m || 0
  ).padStart(2, "0")}`;
}
