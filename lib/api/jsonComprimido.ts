import { gzipSync } from "node:zlib";

/**
 * A resposta em JSON, comprimida quando o navegador aceita (21/10/2026).
 *
 * O `next start` comprime as páginas, mas não a resposta das rotas: o NPS
 * saía com 2,6 MB crus a cada carga do Meu dia (medido no build local, 1,7 s).
 * Comprimido aqui, vale em qualquer lugar — o JSON repetitivo cai a ~10%.
 * Abaixo de 8 kB não compensa o trabalho.
 */
export function jsonComprimido(request: Request, corpo: unknown, init: { status?: number; headers?: Record<string, string> } = {}) {
  const texto = JSON.stringify(corpo);
  const aceita = /\bgzip\b/.test(request.headers.get("accept-encoding") ?? "");
  const headers: Record<string, string> = { "Content-Type": "application/json; charset=utf-8", Vary: "Accept-Encoding", ...init.headers };
  if (!aceita || texto.length < 8_192) return new Response(texto, { status: init.status, headers });
  return new Response(gzipSync(texto), { status: init.status, headers: { ...headers, "Content-Encoding": "gzip" } });
}
