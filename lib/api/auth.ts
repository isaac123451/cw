/**
 * Autenticação da API pública por token.
 *
 * Separada do login da aplicação de propósito: quem consome a API é
 * outro sistema da Cardápio Web, não uma pessoa com sessão no navegador.
 *
 * Sem `API_TOKEN` configurado a API fica **desligada**, e não aberta —
 * os dados são de reclamações reais, e um endpoint público por
 * esquecimento de variável seria vazamento.
 */
export function hasApi() {
  return (process.env.API_TOKEN ?? "").trim().length >= 16;
}

/**
 * Devolve uma `Response` quando a requisição deve ser barrada, ou `null`
 * quando pode seguir.
 */
export function checkToken(request: Request) {

  if (!hasApi()) {
    return Response.json(
      {
        error:
          "API desativada. Defina API_TOKEN (mínimo de 16 caracteres) para habilitar.",
      },
      { status: 503 }
    );
  }

  const header = request.headers.get("authorization") ?? "";

  const token = header.startsWith("Bearer ")
    ? header.slice(7).trim()
    : "";

  if (token !== process.env.API_TOKEN) {
    return Response.json(
      { error: "Token inválido ou ausente." },
      {
        status: 401,
        headers: { "WWW-Authenticate": "Bearer" },
      }
    );
  }

  return null;
}
