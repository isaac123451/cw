import Anthropic from "@anthropic-ai/sdk";

import {
  autenticar,
  responder,
  responderPreVoo,
  semSessao,
} from "@/lib/api/extensao";

import { hasAssistant } from "@/app/api/assistente/route";
import { MOODS } from "@/lib/models/nps";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Resumo de uma conversa, e um rascunho de resposta.
 *
 * **Esta é a única rota da extensão que recebe conteúdo de conversa.**
 * O painel só a chama quando você clica em "Resumir" — nunca sozinho,
 * nunca em segundo plano. É a diferença entre uma ferramenta que lê
 * quando pedem e uma que escuta o tempo todo, e ela é deliberada: o
 * resto da extensão continua lendo apenas telefone e nome.
 *
 * O que volta é **estruturado**, não texto solto: resumo, humor,
 * pendência, próximo passo e um rascunho de resposta. O humor sai na
 * mesma régua de 1 a 5 do NPS (`MOODS`), então o que o modelo leu na
 * conversa já chega no formato que o botão de pós-contato grava — sem
 * nenhuma tradução no meio, que é onde esse tipo de coisa costuma
 * divergir.
 *
 * **O rascunho é rascunho.** Volta para o painel como texto para
 * copiar; nada é enviado ao cliente por aqui. A extensão não manda
 * mensagem — é o que a mantém do lado seguro da regra do WhatsApp.
 */

/** Teto de mensagens consideradas. O fim da conversa é o que importa. */
const MAXIMO_MENSAGENS = 60;

/** Teto por mensagem, para um textão colado não estourar a chamada. */
const MAXIMO_CARACTERES = 1200;

interface Mensagem {
  de: "cliente" | "nos";
  texto: string;
  hora?: string;
}

interface Corpo {
  mensagens: Mensagem[];
  contato?: { nome?: string; telefone?: string };
  /** Retrato do cliente vindo de /api/extensao/contexto, já resumido. */
  contexto?: string;
}

const SISTEMA = `Você atende pela Cardápio Web, empresa de sistema para restaurantes (PDV, cardápio online, integrações de delivery). Está lendo uma conversa de WhatsApp entre a operação e um cliente.

Sua tarefa é ler e devolver um retrato curto, para a pessoa que vai responder saber em dez segundos o que está acontecendo.

Regras:
- Escreva em português do Brasil, direto, sem preâmbulo.
- O resumo é do problema e do estado atual, não da conversa mensagem a mensagem.
- "pendencia" é o que está travado agora. Se nada está travado, diga isso.
- "proximoPasso" é uma ação concreta de quem atende, não um conselho genérico.
- "resposta" é um rascunho para o atendente enviar: cordial, específico ao caso, sem prometer prazo que a conversa não sustenta, sem inventar dado que não está ali. Se o certo for perguntar algo antes de resolver, o rascunho pergunta.
- Nunca invente protocolo, valor, data ou nome que não apareça na conversa ou no contexto fornecido.
- Se a conversa for curta ou irrelevante demais para concluir algo, diga isso no resumo em vez de preencher com suposição.`;

const ESQUEMA = {
  type: "object",
  properties: {
    resumo: {
      type: "string",
      description:
        "Duas a quatro frases: qual é o problema e em que pé está.",
    },
    assunto: {
      type: "string",
      description: "O tema em três a seis palavras.",
    },
    humor: {
      type: "integer",
      enum: [1, 2, 3, 4, 5],
      description:
        "Como o cliente está AGORA, ao fim da conversa. 1 irritado, 2 insatisfeito, 3 neutro, 4 satisfeito, 5 encantado.",
    },
    pendencia: {
      type: "string",
      description: "O que está travado agora, ou 'Nada pendente'.",
    },
    proximoPasso: {
      type: "string",
      description: "Uma ação concreta de quem atende.",
    },
    resposta: {
      type: "string",
      description:
        "Rascunho de mensagem para enviar ao cliente agora.",
    },
    resolvido: {
      type: "boolean",
      description:
        "A situação parece resolvida ao fim da conversa?",
    },
  },
  required: [
    "resumo",
    "assunto",
    "humor",
    "pendencia",
    "proximoPasso",
    "resposta",
    "resolvido",
  ],
  additionalProperties: false,
} as const;

export async function GET(request: Request) {

  const { usuario, demonstracao } =
    await autenticar(request);

  if (!usuario && !demonstracao) {
    return semSessao(request);
  }

  // O painel consulta isto para decidir se mostra o botão de resumir.
  return responder(request, {
    disponivel: hasAssistant(),
    humores: MOODS.map((m) => ({
      valor: m.value,
      emoji: m.emoji,
      rotulo: m.label,
    })),
  });
}

export async function POST(request: Request) {

  const { usuario, demonstracao } =
    await autenticar(request);

  if (!usuario && !demonstracao) {
    return semSessao(request);
  }

  if (!hasAssistant()) {
    return responder(
      request,
      {
        erro: "ANTHROPIC_API_KEY não configurada — o resumo precisa dela.",
      },
      503
    );
  }

  let corpo: Corpo;

  try {
    corpo = (await request.json()) as Corpo;
  } catch {
    return responder(
      request,
      { erro: "Corpo inválido." },
      400
    );
  }

  const mensagens = (corpo.mensagens ?? [])
    .filter(
      (m) => typeof m?.texto === "string" && m.texto.trim() !== ""
    )
    // As últimas: o fim da conversa é onde está o estado atual.
    .slice(-MAXIMO_MENSAGENS)
    .map((m) => ({
      de: m.de === "nos" ? "nos" : "cliente",
      texto: m.texto.trim().slice(0, MAXIMO_CARACTERES),
      hora: m.hora,
    }));

  if (mensagens.length < 2) {
    return responder(
      request,
      {
        erro: "Conversa curta demais para resumir — menos de duas mensagens legíveis.",
      },
      400
    );
  }

  const transcricao = mensagens
    .map(
      (m) =>
        `${m.de === "nos" ? "NÓS" : "CLIENTE"}${m.hora ? ` (${m.hora})` : ""}: ${m.texto}`
    )
    .join("\n");

  const cabecalho = [
    corpo.contato?.nome && `Contato: ${corpo.contato.nome}`,
    corpo.contexto &&
      `O que já sabemos deste cliente no CW Reputação:\n${corpo.contexto}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const client = new Anthropic();

  try {

    /**
     * Não é streaming: a resposta é curta e estruturada, e o painel
     * precisa dela inteira para desenhar os campos. Streaming aqui só
     * acrescentaria complexidade de reconstrução do JSON parcial.
     *
     * `effort: "low"` porque a tarefa é leitura e síntese de um texto
     * curto — não é o tipo de problema que melhora com mais deliberação,
     * e o painel é uma interação de segundos.
     */
    const resposta = await client.messages.create({
      model: "claude-opus-5",
      /**
       * O limite cobre raciocínio **e** texto juntos. Na Opus 5 o
       * raciocínio vem ligado por padrão, então um teto apertado
       * truncaria a resposta no meio — daí a folga.
       */
      max_tokens: 8000,
      system: SISTEMA,
      output_config: {
        effort: "low",
        format: {
          type: "json_schema",
          schema: ESQUEMA,
        },
      },
      messages: [
        {
          role: "user",
          content: `${cabecalho ? `${cabecalho}\n\n` : ""}Conversa:\n\n${transcricao}`,
        },
      ],
    });

    /**
     * Recusa vem com HTTP 200 e conteúdo vazio — ler `content[0]` sem
     * checar antes quebra justamente no caso em que a pessoa mais
     * precisa de uma mensagem clara.
     */
    if (resposta.stop_reason === "refusal") {
      return responder(
        request,
        {
          erro: "O modelo recusou resumir esta conversa.",
          categoria: resposta.stop_details?.category,
        },
        422
      );
    }

    if (resposta.stop_reason === "max_tokens") {
      return responder(
        request,
        {
          erro: "A conversa é longa demais para um resumo em uma passada.",
        },
        422
      );
    }

    const texto = resposta.content
      .filter((bloco) => bloco.type === "text")
      .map((bloco) => bloco.text)
      .join("");

    return responder(request, {
      ...JSON.parse(texto),
      mensagensLidas: mensagens.length,
      custo: {
        entrada: resposta.usage.input_tokens,
        saida: resposta.usage.output_tokens,
      },
    });

  } catch (erro) {

    const mensagem =
      erro instanceof Anthropic.RateLimitError
        ? "Limite de requisições atingido. Tente de novo em instantes."
        : erro instanceof Anthropic.AuthenticationError
          ? "Chave da API inválida."
          : erro instanceof Anthropic.APIError
            ? `Erro da API (${erro.status}).`
            : "Falha ao resumir a conversa.";

    return responder(request, { erro: mensagem }, 502);
  }
}

export function OPTIONS(request: Request) {
  return responderPreVoo(request);
}
