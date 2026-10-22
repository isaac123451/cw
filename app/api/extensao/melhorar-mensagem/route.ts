import { autenticar, responder, responderPreVoo, semSessao } from "@/lib/api/extensao";
import { revisarMensagemComIA } from "@/lib/services/revisaoDaMensagem.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * "Melhorar com IA" na mensagem que a pessoa está escrevendo no WhatsApp
 * (22/10/2026): "quando digitar alguma coisa no WhatsApp, a extensão me
 * ajude com uma resposta, corrija a frase... coisas que podem piorar a
 * relação com o cliente, dicas do que responder até para reter".
 *
 * Recebe o rascunho e as últimas mensagens da conversa (como estão na tela)
 * e devolve o texto revisado — a mesma intenção, sem erro, sem o que piora
 * a relação —, o que mudou e por quê, o risco do rascunho original e, se o
 * cliente falou em cancelar ou está insatisfeito, uma dica de retenção.
 *
 * Só sugestão: nada é gravado e nada é enviado. Quem troca o texto na
 * caixa e manda é a pessoa.
 */

export async function OPTIONS(request: Request) {
  return responderPreVoo(request);
}

export async function POST(request: Request) {
  const { usuario, demonstracao } = await autenticar(request);
  if (!usuario && !demonstracao) return semSessao(request);

  const corpo = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const rascunho = String(corpo.texto ?? "").trim().slice(0, 2000);
  if (rascunho.length < 3) return responder(request, { ok: false, erro: "Escreva a mensagem antes de pedir a revisão." }, 400);
  const mensagens = (Array.isArray(corpo.mensagens) ? corpo.mensagens : [])
    .map((m) => m as Record<string, unknown>)
    .filter((m) => typeof m?.texto === "string" && String(m.texto).trim())
    .slice(-12)
    .map((m) => ({ de: (m.de === "nos" ? "nos" : "cliente") as "nos" | "cliente", texto: String(m.texto).trim().slice(0, 500) }));
  const nome = String(corpo.nome ?? "").trim().slice(0, 80);
  const avisos = (Array.isArray(corpo.avisos) ? corpo.avisos : [])
    .map((a) => a as Record<string, unknown>)
    .filter((a) => typeof a?.texto === "string")
    .slice(0, 6)
    .map((a) => ({ tom: (a.tom === "perigo" ? "perigo" : "atencao") as "perigo" | "atencao", texto: String(a.texto).slice(0, 200) }));

  return responder(request, await revisarMensagemComIA({ rascunho, mensagens, nome, avisos }));
}
