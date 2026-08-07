import { NextResponse, type NextRequest } from "next/server";

import { jwtVerify } from "jose";

const SESSION_COOKIE = "cw_session";

const PUBLIC_PATHS = ["/login", "/cadastro"];

/**
 * Enquanto não houver banco configurado a aplicação segue aberta, com os
 * dados de demonstração. Com `DATABASE_URL` definido, o login passa a ser
 * obrigatório.
 */
function authRequired() {
  return Boolean(process.env.DATABASE_URL);
}

async function isValid(token: string) {

  const value =
    process.env.AUTH_SECRET ??
    process.env.NEXTAUTH_SECRET;

  if (!value) return false;

  try {
    await jwtVerify(
      token,
      new TextEncoder().encode(value)
    );
    return true;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {

  const { pathname } = request.nextUrl;

  const isPublic = PUBLIC_PATHS.some(
    (path) =>
      pathname === path || pathname.startsWith(`${path}/`)
  );

  if (!authRequired()) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;

  const logged = token ? await isValid(token) : false;

  if (logged && isPublic) {
    return NextResponse.redirect(
      new URL("/dashboard", request.url)
    );
  }

  if (!logged && !isPublic) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Tudo, menos assets e rotas internas do Next.
    "/((?!_next/static|_next/image|favicon.ico|logo.svg|.*\\.svg$).*)",
  ],
};
