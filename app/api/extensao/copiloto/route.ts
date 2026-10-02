import { autenticar, responder, responderPreVoo, semSessao } from "@/lib/api/extensao";
import { descreverCasoAberto } from "@/lib/models/contextoDaTela";
import { getPrisma } from "@/lib/prisma";
import { fetchCaseByProtocol } from "@/lib/services/case.repository";
import { pedirEstruturado } from "@/lib/services/ia.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * O copiloto da tratativa (1.128, Fase 33: "IA como copiloto da tratativa —
 * a cada momento da conversa, o próximo passo e o texto sugeridos pela IA").
 *
 * O painel já dizia "o que fazer agora" por regras (Fase 28) — a
 * abordagem e um roteiro. O copiloto lê a conversa de verdade (as últimas
 * mensagens, como estão na tela) e os casos do cliente, e devolve o
 * próximo passo, o porquê e **o texto da próxima mensagem**, pronto para
 * copiar. O painel pede de novo a cada mensagem nova do cliente.
 *
 * Só rascunho: nada é gravado e nada é enviado — quem manda a mensagem é
 * a pessoa, com Enter.
 */

const SISTEMA = `Você é o copiloto de quem atende clientes da Cardápio Web — sistema para restaurantes (PDV, cardápio online, KDS, integrações de delivery, módulo fiscal) — numa conversa de WhatsApp aberta agora.

Leia a conversa e diga, para ESTE momento:
- "passo": o próximo passo de quem atende, uma frase curta no imperativo ("Peça o número do pedido e o horário", "Confirme que a impressora voltou").
- "porque": por que esse passo, em uma frase, apontando o que o cliente disse (cite o trecho curto).
- "texto": a próxima mensagem para mandar ao cliente, pronta para colar. Português do Brasil, cordial e direto, no tom de WhatsApp (sem saudação longa, sem assinatura), até 600 caracteres. Não prometa prazo — nem "hoje", "amanhã" ou "em X horas" —, reembolso, desconto ou solução que quem atende não tenha confirmado na conversa ou no caso: diga que vai verificar e quando volta a falar só se isso já foi combinado. Se faltar informação, pergunte só o que falta.
- "tom": um de acolher, apurar, resolver, encerrar, escalar.

Se o cliente estiver irritado ou falar em cancelar, o passo começa por reconhecer o problema. Se a última mensagem já for nossa e não houver o que acrescentar, diga para aguardar e sugira um texto curto de acompanhamento para mais tarde.`;

const ESQUEMA = {
  type: "object",
  properties: {
    passo: { type: "string", description: "O próximo passo, uma frase curta no imperativo." },
    porque: { type: "string", description: "Por que, em uma frase, citando o que o cliente disse." },
    texto: { type: "string", description: "A próxima mensagem para o cliente, pronta para colar. Até 600 caracteres." },
    tom: { type: "string", enum: ["acolher", "apurar", "resolver", "encerrar", "escalar"] },
  },
  required: ["passo", "porque", "texto", "tom"],
};

export async function OPTIONS(request: Request) {
  return responderPreVoo(request);
}

export async function POST(request: Request) {
  const { usuario, demonstracao } = await autenticar(request);
  if (!usuario && !demonstracao) return semSessao(request);

  const corpo = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const mensagens = (Array.isArray(corpo.mensagens) ? corpo.mensagens : [])
    .map((m) => m as Record<string, unknown>)
    .filter((m) => typeof m?.texto === "string" && String(m.texto).trim())
    .slice(-20)
    .map((m) => ({ de: m.de === "nos" ? "nos" : "cliente", texto: String(m.texto).trim().slice(0, 600) }));
  if (mensagens.length === 0) return responder(request, { ok: false, erro: "Sem mensagens na conversa para ler." }, 400);

  const protocolos = (Array.isArray(corpo.protocolos) ? corpo.protocolos : [])
    .map((p) => String(p ?? "").trim())
    .filter((p) => /^[\w-]{3,60}$/.test(p))
    .slice(0, 3);
  const nome = String(corpo.nome ?? "").trim().slice(0, 120);

  const prisma = getPrisma();
  const casos = prisma ? (await Promise.all(protocolos.map((p) => fetchCaseByProtocol(prisma, p).catch(() => null)))).filter((c) => c !== null) : [];

  const prompt = [
    nome ? `Cliente: ${nome}.` : "",
    casos.length ? `Casos dele na plataforma:\n${casos.map(descreverCasoAberto).join("\n\n")}` : "Nenhum caso dele na plataforma.",
    "",
    "A conversa, da mais antiga para a mais recente (CLIENTE / NÓS):",
    ...mensagens.map((m) => `${m.de === "nos" ? "NÓS" : "CLIENTE"}: ${m.texto}`),
  ]
    .filter((l) => l !== undefined)
    .join("\n");

  const r = await pedirEstruturado({ sistema: SISTEMA, prompt, esquema: ESQUEMA, rapido: true });
  const d = r.dados ?? {};
  const passo = String(d.passo ?? "").trim();
  const texto = String(d.texto ?? "").trim().slice(0, 900);
  if (r.erro || !passo || !texto) {
    return responder(request, { ok: false, erro: r.erro ? "O copiloto não respondeu agora — o \"o que fazer\" acima segue valendo." : "O copiloto não chegou a uma sugestão." });
  }
  return responder(request, {
    ok: true,
    sugestao: {
      passo: passo.slice(0, 200),
      porque: String(d.porque ?? "").trim().slice(0, 300),
      texto,
      tom: ["acolher", "apurar", "resolver", "encerrar", "escalar"].includes(String(d.tom)) ? String(d.tom) : "apurar",
    },
  });
}
