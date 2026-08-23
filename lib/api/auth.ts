import {
  createHash,
  timingSafeEqual,
} from "node:crypto";

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
 * Comparação de tempo constante.
 *
 * `a !== b` sai no primeiro caractere diferente, e a diferença de tempo
 * entre "errou no 1º" e "errou no 20º" permite descobrir o token
 * caractere a caractere. O hash iguala o tamanho dos dois lados, que é
 * o que `timingSafeEqual` exige.
 */
function mesmoToken(recebido: string, esperado: string) {

  if (esperado === "") return false;

  const a = createHash("sha256").update(recebido).digest();
  const b = createHash("sha256").update(esperado).digest();

  return timingSafeEqual(a, b);
}

/**
 * O token do cron da Vercel, quando existe; senão o da API.
 *
 * A Vercel manda `Authorization: Bearer $CRON_SECRET` nas chamadas
 * agendadas. Aceitar o `API_TOKEN` como alternativa é o que permite
 * disparar a rotina à mão — `curl` de um terminal — para conferir o que
 * ela faria sem esperar a madrugada.
 *
 * **Sem nenhum dos dois a rotina fica desligada, não aberta.** Ela
 * encerra ciclo e dispara webhook; um endpoint público por esquecimento
 * de variável seria alguém de fora mexendo no indicador.
 */
export function checkCronToken(request: Request) {

  const header =
    request.headers.get("authorization") ?? "";

  const token = header.startsWith("Bearer ")
    ? header.slice(7).trim()
    : "";

  const cron = (process.env.CRON_SECRET ?? "").trim();
  const api = (process.env.API_TOKEN ?? "").trim();

  if (cron === "" && api === "") {
    return Response.json(
      {
        error:
          "Rotina desativada. Defina CRON_SECRET (ou API_TOKEN) para habilitar.",
      },
      { status: 503 }
    );
  }

  if (
    mesmoToken(token, cron) ||
    mesmoToken(token, api)
  ) {
    return null;
  }

  return Response.json(
    { error: "Token inválido ou ausente." },
    {
      status: 401,
      headers: { "WWW-Authenticate": "Bearer" },
    }
  );
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

  if (!mesmoToken(token, process.env.API_TOKEN ?? "")) {
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
