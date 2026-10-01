import { tryRole } from "@/lib/auth/guard";
import { lerRespostasDoNps } from "@/lib/services/npsLista.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * As respostas do NPS para a tela, por rota e não por server action (1.116).
 *
 * São 4 mil respostas (2,3 MB), e as server actions de uma aba correm uma de
 * cada vez: dentro da carga inicial, o NPS segurava todas as outras leituras
 * da tela atrás dele. Por rota, corre em paralelo com elas. A checagem é a
 * mesma da action (`tryRole`, leitura no módulo do NPS) — o middleware
 * deixa `/api` passar, e é esta linha que fecha a porta.
 *
 * `?desde=` traz só o que mudou (a recarga de 3 em 3 minutos).
 */
export async function GET(request: Request) {
  const ctx = await tryRole("LEITURA", "nps").catch(() => null);
  if (!ctx) return Response.json({ erro: "Entre na aplicação para ver o NPS." }, { status: 401 });

  const agora = new Date();
  const desde = new URL(request.url).searchParams.get("desde");
  const quando = desde ? new Date(desde) : null;
  /* Um minuto de folga: o que gravou no meio da leitura anterior não escapa. */
  const respostas = await lerRespostasDoNps(ctx.prisma, quando && Number.isFinite(quando.getTime()) ? { desde: new Date(quando.getTime() - 60_000) } : {});

  return Response.json({ respostas, agora: agora.toISOString() }, { headers: { "Cache-Control": "no-store" } });
}
