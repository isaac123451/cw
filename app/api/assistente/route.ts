import Anthropic from "@anthropic-ai/sdk";

import { ASSISTANT_SYSTEM } from "@/lib/services/assistant.context";

import { getSession } from "@/lib/auth/session";
import { hasDatabase } from "@/lib/prisma";

/** Streaming precisa do runtime Node — o edge corta a conexão longa. */
export const runtime = "nodejs";

export interface AssistantTurn {
  role: "user" | "assistant";
  content: string;
}

interface Payload {
  messages: AssistantTurn[];
  /** Retrato da operação montado no cliente, onde os dados vivem. */
  snapshot: string;
}

/**
 * A chave precisa ter conteúdo de verdade.
 *
 * Além do vazio, recusa o texto de exemplo do .env — assim a tela cai no
 * modo local com um aviso claro, em vez de só falhar com 401 na hora em
 * que alguém faz a primeira pergunta.
 */
export function hasAssistant() {

  const chave = (process.env.ANTHROPIC_API_KEY ?? "").trim();

  if (chave === "") return false;

  // Placeholders herdados do .env.example.
  if (chave.endsWith("...")) return false;

  return chave.startsWith("sk-ant-");
}

/**
 * Esta rota gasta dinheiro a cada chamada.
 *
 * O middleware deixa `/api` passar (a API pública tem token próprio), e
 * esta aqui não tinha checagem nenhuma: qualquer pessoa na internet
 * podia apontar para `/api/assistente` e consumir a cota da Anthropic
 * da empresa, sem login e sem limite.
 *
 * Diferente de `/api/casos`, o consumidor é a **própria tela**, então o
 * critério certo é a sessão do navegador — não o `API_TOKEN`, que é
 * para outro sistema.
 */
async function exigirSessao() {

  if (!hasDatabase()) return null;

  const session = await getSession();

  if (session) return null;

  return Response.json(
    { error: "Não autorizado." },
    { status: 401 }
  );
}

export async function GET() {

  const barrado = await exigirSessao();
  if (barrado) return barrado;

  // A tela consulta isto para saber se mostra a IA ou o modo local.
  return Response.json({ enabled: hasAssistant() });
}

export async function POST(request: Request) {

  const barrado = await exigirSessao();
  if (barrado) return barrado;

  if (!hasAssistant()) {
    return Response.json(
      {
        error:
          "ANTHROPIC_API_KEY não configurada. O assistente responde em modo local enquanto isso.",
      },
      { status: 503 }
    );
  }

  let payload: Payload;

  try {
    payload = (await request.json()) as Payload;
  } catch {
    return Response.json(
      { error: "Corpo da requisição inválido." },
      { status: 400 }
    );
  }

  const { messages, snapshot } = payload;

  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json(
      { error: "Nenhuma pergunta recebida." },
      { status: 400 }
    );
  }

  const client = new Anthropic();

  // O retrato entra como primeiro turno para o restante da conversa
  // aproveitar o cache de prompt entre perguntas.
  const conversa: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: snapshot,
          cache_control: { type: "ephemeral" },
        },
      ],
    },
    {
      role: "assistant",
      content:
        "Retrato da operação recebido. Pode perguntar.",
    },
    ...messages.map((item) => ({
      role: item.role,
      content: item.content,
    })),
  ];

  const encoder = new TextEncoder();

  const stream = new ReadableStream({

    async start(controller) {

      function send(evento: unknown) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify(evento)}\n\n`
          )
        );
      }

      try {

        const resposta = client.messages.stream({
          model: "claude-opus-5",
          // Espaço para o raciocínio adaptativo (ligado por padrão no
          // Opus 5) mais o texto — o limite cobre os dois juntos.
          max_tokens: 16000,
          system: ASSISTANT_SYSTEM,
          output_config: { effort: "medium" },
          messages: conversa,
        });

        resposta.on("text", (delta) => {
          send({ type: "delta", text: delta });
        });

        const final = await resposta.finalMessage();

        if (final.stop_reason === "refusal") {
          send({
            type: "error",
            message:
              "O modelo recusou responder a esta pergunta.",
          });
        } else {
          send({
            type: "done",
            usage: {
              input: final.usage.input_tokens,
              output: final.usage.output_tokens,
              cacheRead:
                final.usage.cache_read_input_tokens ?? 0,
            },
          });
        }

      } catch (error) {

        const message =
          error instanceof Anthropic.RateLimitError
            ? "Limite de requisições atingido. Tente de novo em instantes."
            : error instanceof Anthropic.AuthenticationError
            ? "Chave da API inválida."
            : error instanceof Anthropic.APIError
            ? `Erro da API (${error.status}).`
            : "Falha ao falar com o modelo.";

        send({ type: "error", message });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
