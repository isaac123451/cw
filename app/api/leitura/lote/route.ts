import { LEITURAS, type NomeDaLeitura } from "@/lib/leituras/registro";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Várias leituras da tela numa ida só, em paralelo (1.116).
 *
 * O Next despacha as server actions de uma aba **uma de cada vez** — está na
 * documentação: "Server Actions are queued. Using them for data fetching
 * introduces sequential execution." Medido em 01/10/2026: o Meu dia fazia 10
 * leituras em fila e ficava pronto em 9,6 s. Por rota não há fila: as
 * leituras pedidas juntas rodam juntas, e em paralelo com a carga inicial.
 *
 * Só as do registro (`lib/leituras/registro.ts`); cada uma é a própria action,
 * com a própria checagem de acesso — sem sessão, ela devolve o mesmo vazio
 * ou a mesma recusa de sempre. Uma que falha não derruba as outras.
 */
export async function POST(request: Request) {
  const corpo = (await request.json().catch(() => ({}))) as { pedidos?: { nome?: string; args?: unknown[] }[] };
  const pedidos = Array.isArray(corpo.pedidos) ? corpo.pedidos.slice(0, 30) : [];

  const respostas = await Promise.all(
    pedidos.map(async (p) => {
      const nome = String(p?.nome ?? "") as NomeDaLeitura;
      const ler = Object.prototype.hasOwnProperty.call(LEITURAS, nome) ? (LEITURAS[nome] as (...args: unknown[]) => Promise<unknown>) : null;
      if (!ler) return { ok: false, erro: "Leitura desconhecida." };
      try {
        return { ok: true, valor: await ler(...(Array.isArray(p.args) ? p.args : [])) };
      } catch (erro) {
        console.error(`[leitura/lote] ${nome}`, erro);
        return { ok: false, erro: "A leitura falhou." };
      }
    })
  );

  return Response.json({ respostas }, { headers: { "Cache-Control": "no-store" } });
}
