import {
  conversar,
  provedorDeIA,
} from "@/lib/services/ia.service";

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

  /**
   * Delegado ao serviço de IA.
   *
   * Antes olhava só a `ANTHROPIC_API_KEY`, e o assistente ficava
   * desligado numa instalação que tinha o Gemini configurado — a chave
   * existia, só não era a que este arquivo conhecia.
   */
  return Boolean(provedorDeIA());
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

  /**
   * O retrato da operação entra na instrução de sistema.
   *
   * Antes era o primeiro turno da conversa, para aproveitar o cache de
   * prompt entre perguntas. No sistema ele continua sendo o trecho
   * estável que o cache marca — e é a única forma que os dois
   * provedores tratam do mesmo jeito, agora que o assistente responde
   * pela IA que estiver configurada.
   */
  const sistema = `${ASSISTANT_SYSTEM}

--- RETRATO DA OPERAÇÃO ---
${snapshot}`;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({

    async start(controller) {

      function send(evento: unknown) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify(evento)}

`
          )
        );
      }

      try {

        for await (const pedaco of conversar({
          sistema,
          turnos: messages.map((item) => ({
            role: item.role,
            content: item.content,
          })),
        })) {

          if (pedaco.tipo === "delta") {
            send({ type: "delta", text: pedaco.texto });
            continue;
          }

          if (pedaco.tipo === "erro") {
            send({
              type: "error",
              message: pedaco.mensagem,
            });
            continue;
          }

          send({
            type: "done",
            provedor: provedorDeIA(),
            usage: {
              input: pedaco.uso.entrada,
              output: pedaco.uso.saida,
            },
          });
        }

      } catch {

        send({
          type: "error",
          message: "Falha ao falar com o modelo.",
        });
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
