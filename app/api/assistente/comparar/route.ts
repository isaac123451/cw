import { getSession } from "@/lib/auth/session";
import { hasDatabase } from "@/lib/prisma";
import { provedorDeIA } from "@/lib/services/ia.service";
import { compararModelos } from "@/lib/services/comparacaoDeModelos.service";
import { montarSistemaDoAssistente } from "@/lib/services/sistemaDoAssistente.service";

export const runtime = "nodejs";
/* Duas rodadas de IA (todas em paralelo, depois o juiz): mais tempo que a conversa normal. */
export const maxDuration = 60;

/**
 * "Comparar modelos" no assistente (09/10/2026): a pergunta vai a cada IA
 * com chave, com o mesmo contexto da conversa normal, e volta com as
 * respostas lado a lado e a melhor ideia — ver `comparacaoDeModelos.service`.
 */
export async function POST(request: Request) {
  if (hasDatabase() && !(await getSession())) return Response.json({ error: "Não autorizado." }, { status: 401 });
  if (!provedorDeIA()) return Response.json({ error: "Nenhuma IA configurada para comparar." }, { status: 503 });

  const corpo = (await request.json().catch(() => null)) as { messages?: { role: string; content: string }[]; snapshot?: string } | null;
  const turnos = (Array.isArray(corpo?.messages) ? corpo!.messages : [])
    .filter((m) => (m?.role === "user" || m?.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-8)
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content.slice(0, 4000) }));
  if (!turnos.length || turnos[turnos.length - 1].role !== "user") return Response.json({ error: "Nenhuma pergunta recebida." }, { status: 400 });

  try {
    const sistema = await montarSistemaDoAssistente(turnos, String(corpo?.snapshot ?? "").slice(0, 60_000));
    return Response.json(await compararModelos(sistema, turnos));
  } catch (erro) {
    console.error("[assistente/comparar]", erro);
    return Response.json({ error: "Não deu para comparar agora. Tente de novo em instantes." }, { status: 500 });
  }
}
