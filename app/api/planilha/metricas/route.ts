import { checkToken } from "@/lib/api/auth";
import { getPrisma } from "@/lib/prisma";
import { planilhaDoMes } from "@/lib/services/planilhaDoCiclo.service";
import { hojeNaOperacao } from "@/lib/services/reputation.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * As linhas da planilha "Métricas do Reclame Aqui" de um mês (1.97).
 *
 * Quem chama é o Apps Script da própria planilha, uma vez por dia, com o
 * `API_TOKEN` guardado nas propriedades do script. A rota só **lê**; quem
 * decide não escrever por cima do que já está preenchido é o script, célula
 * a célula. Ver `planilhaDoCiclo.service.ts` e `docs/planilha/MetricasDoCW.gs`.
 *
 *   GET /api/planilha/metricas?mes=2026-09
 */
export async function GET(request: Request) {
  const barrado = checkToken(request);
  if (barrado) return barrado;

  const prisma = getPrisma();
  if (!prisma) return Response.json({ error: "Sem banco configurado." }, { status: 503 });

  const pedido = new URL(request.url).searchParams.get("mes") ?? hojeNaOperacao().slice(0, 7);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(pedido)) {
    return Response.json({ error: "Mês inválido — use AAAA-MM." }, { status: 400 });
  }
  if (pedido > hojeNaOperacao().slice(0, 7)) {
    return Response.json({ error: "Esse mês ainda não começou." }, { status: 400 });
  }

  return Response.json(await planilhaDoMes(prisma, pedido));
}
