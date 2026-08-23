import {
  autenticar,
  responder,
  responderPreVoo,
  semSessao,
} from "@/lib/api/extensao";

import {
  pedirEstruturado,
  provedorDeIA,
} from "@/lib/services/ia.service";
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
    disponivel: Boolean(provedorDeIA()),
    provedor: provedorDeIA(),
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

  if (!provedorDeIA()) {
    return responder(
      request,
      {
        erro: "Nenhuma IA configurada. Defina ANTHROPIC_API_KEY ou GEMINI_API_KEY (a do Gemini tem camada gratuita).",
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

  const resultado = await pedirEstruturado({
    sistema: SISTEMA,
    prompt: `${cabecalho ? `${cabecalho}

` : ""}Conversa:

${transcricao}`,
    esquema: ESQUEMA,

    /**
     * Resumir é ler e condensar — o modelo menor faz igual.
     *
     * E aqui a velocidade é o recurso: quem clica em "Resumir" está com
     * o cliente na linha. Medido, o mesmo pedido leva ~1 s no modelo
     * pequeno e ~10 s no grande, quando este não está em fila. Um
     * resumo que chega depois da conversa acabar não serviu para nada.
     */
    rapido: true,
  });

  if (resultado.erro || !resultado.dados) {
    return responder(
      request,
      { erro: resultado.erro, provedor: resultado.provedor },
      resultado.status ?? 502
    );
  }

  return responder(request, {
    ...resultado.dados,
    mensagensLidas: mensagens.length,

    /**
     * Qual provedor respondeu vai junto.
     *
     * O texto muda de modelo para modelo, e sem saber quem respondeu
     * fica impossível dizer se um resumo ruim é a conversa ou o
     * provedor que está configurado.
     */
    provedor: resultado.provedor,
    custo: resultado.uso,
  });
}

export function OPTIONS(request: Request) {
  return responderPreVoo(request);
}
