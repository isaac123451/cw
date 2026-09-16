import {
  conversar,
  provedorDeIA,
} from "@/lib/services/ia.service";

import { ASSISTANT_SYSTEM } from "@/lib/services/assistant.context";

import {
  dadosParaMedir,
  escolherMedicoes,
  medir,
} from "@/lib/services/assistant.agent";

import {
  trechosParaAPergunta,
  trechosParaOPrompt,
} from "@/lib/services/documentacao.service";

import { getApiCases } from "@/lib/api/source";

import { getSession } from "@/lib/auth/session";
import { getPrisma, hasDatabase } from "@/lib/prisma";

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
   * O agente: o modelo escolhe o que medir, o servidor mede.
   *
   * O retrato abaixo é fixo — foi montado antes de a pergunta existir.
   * Serve para o que ele cobre e não serve para o resto: se o número
   * que a pergunta pede não estiver ali, o modelo dizia que não sabia
   * ou, pior, arredondava a partir do que tinha.
   *
   * Aqui uma chamada curta pergunta **quais medições** a pergunta
   * precisa, entre as do catálogo. As escolhidas rodam contra o
   * Postgres, pelas mesmas funções que as telas usam. O que chega ao
   * modelo são números conferíveis, e a resposta dele é escrita só com
   * eles.
   *
   * **Falha em silêncio.** Se a escolha não vier — modelo fora do ar,
   * pergunta que não é sobre a operação —, a conversa segue com o
   * retrato de sempre. É enriquecimento, não dependência.
   */
  let medicoes = "";

  try {

    const pergunta =
      [...messages]
        .reverse()
        .find((m) => m.role === "user")?.content ?? "";

    const escolhas = await escolherMedicoes(pergunta);

    if (escolhas.length > 0) {

      const prisma = getPrisma();

      if (prisma) {
        medicoes = medir(
          await dadosParaMedir(
            prisma,
            await getApiCases("all")
          ),
          escolhas
        );
      }
    }

  } catch (erro) {
    console.error("[assistente] medições", erro);
  }

  /**
   * A documentação, procurada antes de responder (Fase 9.1).
   *
   * O assistente sabia os números da operação e não sabia as regras
   * dela. Perguntado "qual o prazo de uma urgente?", respondia pelo que
   * parece razoável — e o que parece razoável é justamente o que a
   * documentação existe para substituir.
   *
   * As seções que casam com a pergunta vão **literalmente** para a
   * instrução, com título e endereço. Não há resumo pelo caminho: o
   * modelo lê o texto do documento. Nada casou? Nada vai — e a
   * instrução manda dizer que a documentação não cobre aquilo.
   */
  let documentacao = "";

  try {
    const prisma = getPrisma();

    if (prisma) {
      const pergunta =
        [...messages].reverse().find((m) => m.role === "user")?.content ?? "";

      const trechos = await trechosParaAPergunta(prisma, pergunta);

      if (trechos.length > 0) documentacao = trechosParaOPrompt(trechos);
    }
  } catch (erro) {
    console.error("[assistente] documentação", erro);
  }

  /*
    O retrato da operação entra na instrução de sistema.

    Antes era o primeiro turno da conversa, para aproveitar o cache de
    prompt entre perguntas. No sistema ele continua sendo o trecho
    estável que o cache marca — e é a única forma que os dois provedores
    tratam do mesmo jeito.
  */
  const sistema = `${ASSISTANT_SYSTEM}

--- RETRATO DA OPERAÇÃO ---
${snapshot}${
    medicoes
      ? `

--- MEDIÇÕES PEDIDAS PARA ESTA PERGUNTA ---
Estes números foram calculados agora, no banco, pelas mesmas funções
das telas. Use-os literalmente e cite o nome da medição quando fizer
sentido. Não recalcule nem arredonde.

${medicoes}`
      : ""
  }${
    documentacao
      ? `

--- A DOCUMENTAÇÃO DO TIME, SOBRE ESTA PERGUNTA ---
Estes são trechos literais dos documentos guardados na plataforma.
Quando a resposta vier de uma regra, ela sai daqui: cite a seção pelo
nome ("Atendimento no Reclame Aqui → 2. Prazos e Classificação de
Criticidade") e, se ajudar, o endereço entre parênteses. Não complete
nem generalize uma regra que não esteja escrita abaixo — se o trecho
não responde, diga o que ele cobre e o que ficou de fora.

${documentacao}`
      : `

--- A DOCUMENTAÇÃO DO TIME ---
Nenhuma seção dos documentos guardados casou com esta pergunta. Então
não há regra documentada para citar: se a pergunta for sobre "o que o
processo manda fazer", diga que a documentação da plataforma não cobre
isso e sugira procurar em Documentação. Nunca invente uma regra, um
prazo ou um limite.`
  }`;

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
