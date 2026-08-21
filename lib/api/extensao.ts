import "server-only";

import { jwtVerify } from "jose";

import { getPrisma } from "@/lib/prisma";
import type { Role } from "@/lib/auth/guard";

/**
 * Autenticação das rotas que a extensão de navegador consome.
 *
 * **Por que não reaproveitar o `API_TOKEN`.** A API pública
 * (`/api/reputacao`, `/api/casos`) devolve dado **sem telefone e sem
 * e-mail**, de propósito: foi feita para outro sistema ler indicadores,
 * não para uma pessoa procurar um consumidor pelo número. A extensão
 * precisa exatamente do que aquela API esconde — então não pode usar
 * aquele token. Ver `API.md`, "O que a API não devolve".
 *
 * **Como autentica então.** Como você mesmo. A extensão lê o cookie de
 * sessão do navegador (`cw_session`, o mesmo que as telas usam) e o
 * manda no cabeçalho `X-CW-Sessao`. O papel continua vindo do banco, e
 * não do cookie, pelo mesmo motivo de `lib/auth/guard.ts`: rebaixar ou
 * desativar alguém precisa valer agora, não no próximo login.
 *
 * Mandar no cabeçalho, e não confiar no cookie viajando sozinho, tem
 * dois efeitos bons: funciona independentemente de como o navegador
 * trata `SameSite` numa requisição vinda de `chrome-extension://`, e
 * fecha a porta de CSRF — uma página qualquer não consegue forjar um
 * cabeçalho personalizado.
 */

const COOKIE_SESSAO = "cw_session";

export interface UsuarioDaExtensao {
  id: string;
  nome: string;
  email: string;
  papel: Role;
}

export interface Acesso {
  usuario: UsuarioDaExtensao | null;

  /**
   * Sem banco a aplicação inteira roda aberta, com o dataset de
   * demonstração — é o que `middleware.ts` já faz. As rotas da extensão
   * seguem a mesma regra para o `npm run dev` continuar útil sem
   * infraestrutura. O dataset versionado tem telefone e e-mail
   * mascarados, então não há contato real exposto nesse modo.
   */
  demonstracao: boolean;
}

function segredo() {
  const valor =
    process.env.AUTH_SECRET ??
    process.env.NEXTAUTH_SECRET;

  return valor
    ? new TextEncoder().encode(valor)
    : null;
}

/**
 * O token pode chegar por três caminhos. O cabeçalho é o que a extensão
 * usa; `Authorization` existe para testar com `curl`; e o cookie cobre
 * quem abrir a rota já logado no próprio navegador.
 */
function tokenDaRequisicao(request: Request) {
  const proprio = request.headers.get("x-cw-sessao");

  if (proprio && proprio.trim() !== "") {
    return proprio.trim();
  }

  const auth = request.headers.get("authorization") ?? "";

  if (auth.startsWith("Bearer ")) {
    return auth.slice(7).trim();
  }

  const cookies = request.headers.get("cookie") ?? "";

  const achado = cookies.match(
    new RegExp(`(?:^|;\\s*)${COOKIE_SESSAO}=([^;]+)`)
  );

  return achado ? decodeURIComponent(achado[1]) : "";
}

export async function autenticar(
  request: Request
): Promise<Acesso> {

  const prisma = getPrisma();

  if (!prisma) {
    return { usuario: null, demonstracao: true };
  }

  const chave = segredo();
  const token = tokenDaRequisicao(request);

  if (!chave || !token) {
    return { usuario: null, demonstracao: false };
  }

  let id = "";

  try {
    const { payload } = await jwtVerify(token, chave);
    id = String(payload.id ?? "");
  } catch {
    // Expirado ou adulterado: trata como não autenticado.
    return { usuario: null, demonstracao: false };
  }

  if (!id) {
    return { usuario: null, demonstracao: false };
  }

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
    },
  });

  if (!user || !user.active) {
    return { usuario: null, demonstracao: false };
  }

  return {
    usuario: {
      id: user.id,
      nome: user.name,
      email: user.email,
      papel: user.role as Role,
    },
    demonstracao: false,
  };
}

/**
 * Origens aceitas na resposta.
 *
 * O trabalho de rede da extensão acontece no service worker, que já
 * atravessa origem por causa de `host_permissions` — então isto aqui
 * quase nunca é necessário. Fica pelo caso em que o navegador exige o
 * cabeçalho mesmo assim, e restrito a origens de extensão: página
 * comum na internet continua sem conseguir ler a resposta.
 */
function origemPermitida(origem: string) {
  return (
    /^chrome-extension:\/\/[a-z]{32}$/.test(origem) ||
    /^moz-extension:\/\//.test(origem) ||
    /^safari-web-extension:\/\//.test(origem)
  );
}

export function cabecalhos(request: Request) {
  const origem = request.headers.get("origin") ?? "";

  const base: Record<string, string> = {
    // Resposta com contato de consumidor real não fica em cache.
    "Cache-Control": "no-store, private",
    Vary: "Origin",
  };

  if (!origemPermitida(origem)) return base;

  return {
    ...base,
    "Access-Control-Allow-Origin": origem,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "X-CW-Sessao, Content-Type",
    "Access-Control-Max-Age": "600",
  };
}

/** Pré-voo do CORS. Todas as rotas da extensão respondem igual. */
export function responderPreVoo(request: Request) {
  return new Response(null, {
    status: 204,
    headers: cabecalhos(request),
  });
}

export function semSessao(request: Request) {
  return Response.json(
    {
      erro: "Sessão ausente ou expirada.",
      dica: "Abra o CW Reputação no navegador e entre com sua conta. A extensão usa a mesma sessão.",
    },
    { status: 401, headers: cabecalhos(request) }
  );
}

export function responder(
  request: Request,
  corpo: unknown,
  status = 200
) {
  return Response.json(corpo, {
    status,
    headers: cabecalhos(request),
  });
}
