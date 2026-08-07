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
