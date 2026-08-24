import "server-only";

import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "cw_session";

const MAX_AGE_SECONDS = 60 * 60 * 8;

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

function secret() {
  const value =
    process.env.AUTH_SECRET ??
    process.env.NEXTAUTH_SECRET;

  if (!value) {
    throw new Error(
      "AUTH_SECRET não definido — necessário para assinar a sessão."
    );
  }

  return new TextEncoder().encode(value);
}

export async function createSession(user: SessionUser) {

  const token = await new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secret());

  const store = await cookies();

  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<SessionUser | null> {

  const store = await cookies();

  const token = store.get(SESSION_COOKIE)?.value;

  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secret());

    return {
      id: String(payload.id),
      email: String(payload.email),
      name: String(payload.name),
      role: String(payload.role),
    };
  } catch {
    // Token expirado ou adulterado: trata como não autenticado.
    return null;
  }
}

/**
 * ============================================================
 * A ETAPA DO MEIO — entre a senha certa e a sessão
 * ============================================================
 *
 * A senha bateu, o código ainda não. Esse estado precisa atravessar
 * uma navegação, e onde ele mora define a segurança do recurso
 * inteiro.
 *
 * **Não é um campo escondido no formulário.** Ali o navegador entrega
 * o valor de volta como veio, e quem inspeciona a página troca o id do
 * desafio pelo de outra pessoa. É um cookie assinado, pelo mesmo
 * segredo da sessão.
 *
 * **E não é a sessão com uma marca de "pendente".** Um cookie de
 * sessão válido é a chave da casa; marcá-lo como incompleto e confiar
 * que toda tela lembre de conferir a marca é a forma de, um dia, uma
 * tela nova esquecer. Este cookie tem outro nome, e nenhuma rota da
 * plataforma sabe lê-lo — o `getSession` continua devolvendo `null`.
 */

export const PENDING_COOKIE = "cw_2fa";

/** Dez minutos, alinhado ao vencimento padrão do código. */
const PENDING_MAX_AGE = 60 * 10;

export interface PendingLogin {
  challengeId: string;
  userId: string;
  /** Só para a tela dizer "enviamos para j***@cardapioweb.com". */
  email: string;
}

export async function createPendingLogin(
  dados: PendingLogin
) {

  const token = await new SignJWT({ ...dados })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${PENDING_MAX_AGE}s`)
    .sign(secret());

  const store = await cookies();

  store.set(PENDING_COOKIE, token, {
    httpOnly: true,
    /**
     * `strict`, não `lax`.
     *
     * A sessão usa `lax` porque precisa sobreviver a alguém chegar por
     * um link de fora. Esta etapa não precisa: ela só existe entre
     * duas telas nossas, e `strict` remove qualquer travessia entre
     * sites do caminho de autenticação.
     */
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: PENDING_MAX_AGE,
  });
}

export async function getPendingLogin(): Promise<PendingLogin | null> {

  const store = await cookies();

  const token = store.get(PENDING_COOKIE)?.value;

  if (!token) return null;

  try {

    const { payload } = await jwtVerify(token, secret());

    if (
      !payload.challengeId ||
      !payload.userId ||
      !payload.email
    ) {
      return null;
    }

    return {
      challengeId: String(payload.challengeId),
      userId: String(payload.userId),
      email: String(payload.email),
    };

  } catch {
    return null;
  }
}

export async function clearPendingLogin() {
  const store = await cookies();
  store.delete(PENDING_COOKIE);
}
