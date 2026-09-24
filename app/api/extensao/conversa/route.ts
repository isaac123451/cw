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
import { retratarConversaSemIA } from "@/lib/services/motorProprio";
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
  /** "10:32, 14/09/2026" — dá o dia das promessas ("amanhã" conta dele). */
  carimbo?: string;
}

import { conferirSituacao } from "@/lib/models/resumoQueSitua";
import { estiloAprendido, exemplosParaIA, prometeSemRegistro, TONS, tonsSemIA, type EdicaoFeita, type Tom } from "@/lib/models/tonsDaResposta";
import { getPrisma } from "@/lib/prisma";
import { familiaDoTexto } from "@/lib/models/catalogoDeCausas";
import {
  conferirRascunho,
  REGRAS_DO_RASCUNHO,
  resumoDoRascunho,
} from "@/lib/models/rascunho";

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
- "tons" são três versões da mensagem de "Responder agora", o mesmo recado com o nome e a pendência real:
  - "acolhedora": reconhece o transtorno antes de qualquer coisa;
  - "objetiva": o que está sendo feito e quando, em duas frases;
  - "tecnica": o que foi verificado e o que falta, com os termos do sistema.
  Nenhum dos três promete prazo que não esteja prometido na conversa.
- "situacao" situa quem pega a conversa no meio, cada ponto com "citacao" — o trecho LITERAL, copiado sem mudar uma letra, da mensagem de onde saiu (citação que não estiver na conversa é descartada):
  - "quer": o que o cliente pede agora (o pedido que está valendo, não o primeiro da conversa);
  - "feito": o que a operação já fez;
  - "prometido": o que a operação prometeu, com "quando" se houver dia ou hora;
  - "falta": o que falta para resolver;
  - "risco": nível baixo, medio ou alto, e o porquê (Procon, cancelamento, prejuízo, promessa vencida, humor).
  No tamanho que a conversa pede: conversa curta, até dois itens por lista; longa, até cinco.
- "resposta" é o rascunho mais óbvio para esta conversa: cordial, específico, sem prometer prazo que a conversa não sustenta, sem inventar dado que não está ali. Se o certo for perguntar algo antes de resolver, o rascunho pergunta.
- "respostas" são exatamente três textos prontos, cada um para um caminho diferente que esta mesma conversa pode tomar. Sempre estes três, nesta ordem:
  1. titulo "Responder agora" — o que dizer com o que já se sabe. Reconhece o problema e diz o que está sendo feito.
  2. titulo "Pedir o que falta" — quando não dá para resolver sem algo do cliente: um print, um número de pedido, um horário. Pede uma coisa de cada vez e explica para quê.
  3. titulo "Confirmar e encerrar" — para quando o assunto está resolvido. Confirma o que foi feito e abre espaço para o cliente dizer se ficou de pé.
  Cada uma tem "quando" (uma frase dizendo em que situação usar) e "texto" (a mensagem pronta para revisar e enviar pelo WhatsApp).
- Os três são para o atendente **escolher e enviar**: escreva-os prontos, no tom de mensagem de WhatsApp — curtos, sem assinatura, sem formalidade de e-mail. Nada é enviado automaticamente.
- Nunca invente protocolo, valor, data ou nome que não apareça na conversa ou no contexto fornecido.
- Se a conversa for curta ou irrelevante demais para concluir algo, diga isso no resumo em vez de preencher com suposição. Mesmo assim escreva os três textos com o que houver — quem atende revisa antes de enviar.

${REGRAS_DO_RASCUNHO}`;

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

    /**
     * As três respostas moram **aqui**, no resumo — e não no dossiê.
     *
     * O dossiê também tem as suas, e por um bom tempo eram só dele. O
     * Isaac corrigiu: "as respostas não é necessariamente para o
     * dossiê, mas sim para o resumo e assim enviar ao cliente ao que
     * faça sentido". Faz sentido: o dossiê é para entender um caso, e
     * quem o abre está estudando. O resumo é para responder — quem
     * clicou em "Resumir" está com o cliente na linha e a próxima coisa
     * que vai fazer é escrever. Oferecer um único rascunho ali obriga a
     * pessoa a reescrever quando o caminho da conversa é outro.
     */
    respostas: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        properties: {
          titulo: { type: "string" },
          quando: { type: "string" },
          texto: { type: "string" },
        },
        required: ["titulo", "quando", "texto"],
        additionalProperties: false,
      },
    },
    tons: {
      type: "object",
      properties: {
        acolhedora: { type: "string" },
        objetiva: { type: "string" },
        tecnica: { type: "string" },
      },
      required: ["acolhedora", "objetiva", "tecnica"],
      additionalProperties: false,
    },
    situacao: {
      type: "object",
      properties: {
        quer: { type: "object", properties: { texto: { type: "string" }, citacao: { type: "string" } }, required: ["texto", "citacao"], additionalProperties: false },
        feito: { type: "array", items: { type: "object", properties: { texto: { type: "string" }, citacao: { type: "string" } }, required: ["texto", "citacao"], additionalProperties: false } },
        prometido: { type: "array", items: { type: "object", properties: { texto: { type: "string" }, quando: { type: "string" }, citacao: { type: "string" } }, required: ["texto", "quando", "citacao"], additionalProperties: false } },
        falta: { type: "string" },
        risco: { type: "object", properties: { nivel: { type: "string", enum: ["baixo", "medio", "alto"] }, porque: { type: "string" } }, required: ["nivel", "porque"], additionalProperties: false },
      },
      required: ["quer", "feito", "prometido", "falta", "risco"],
      additionalProperties: false,
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
    "respostas",
    "tons",
    "situacao",
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

  /*
    O painel consulta isto para decidir se mostra o botão de resumir.

    Sempre `true` desde o motor próprio (Fase 16 do roadmap 2.0): sem
    nenhuma IA externa configurada — ou com as configuradas fora do ar —
    a leitura ainda sai, pelas regras de `lib/services/motorProprio.ts`.
    `provedor` continua dizendo qual delas responderia primeiro, para
    quem olha o popup entender a diferença.
  */
  return responder(request, {
    disponivel: true,
    provedor: provedorDeIA() ?? "motor-proprio",
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
      de: m.de === "nos" ? ("nos" as const) : ("cliente" as const),
      texto: m.texto.trim().slice(0, MAXIMO_CARACTERES),
      hora: m.hora,
      carimbo: typeof m.carimbo === "string" ? m.carimbo.slice(0, 40) : undefined,
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

  /*
    O jeito de quem vai enviar (Fase 28): as últimas edições desta pessoa
    nos rascunhos. Sem a tabela (antes do db:push), segue sem estilo.
  */
  let edicoes: EdicaoFeita[] = [];
  const prisma = getPrisma();
  if (usuario && prisma) {
    edicoes = await prisma.edicaoDeResposta
      .findMany({ where: { userId: usuario.id }, orderBy: { criadaEm: "desc" }, take: 5, select: { tom: true, original: true, editada: true } })
      .catch(() => []);
  }
  const estilo = estiloAprendido(edicoes);

  const cabecalho = [
    corpo.contato?.nome && `Contato: ${corpo.contato.nome}`,
    exemplosParaIA(estilo),
    corpo.contexto &&
      `O que já sabemos deste cliente no CW Reputação:\n${corpo.contexto}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  let resultado = await pedirEstruturado({
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

  /*
    Sem provedor configurado, ou os configurados fora do ar (o 503 do
    Gemini congestionado é o caso real, medido em 26/08/2026): o motor
    próprio entra no lugar do erro, com o mesmo formato de resposta —
    resumo, assunto, humor, pendência, próximo passo e três rascunhos —
    lido pelas regras de `lib/services/motorProprio.ts`. Nunca inventa o
    que a conversa não diz; é mais raso que a IA, não menos confiável.
  */
  if (resultado.erro || !resultado.dados) {
    resultado = {
      provedor: "motor-proprio",
      /* O retrato tem os oito campos do mesmo esquema que a IA preenche — só o tipo de `dados` é genérico. */
      dados: retratarConversaSemIA(mensagens, { nome: corpo.contato?.nome }) as unknown as Record<string, unknown>,
    };
  }

  if (resultado.erro || !resultado.dados) {
    return responder(
      request,
      { erro: resultado.erro, provedor: resultado.provedor },
      resultado.status ?? 502
    );
  }

  /**
   * Cada rascunho passa pela mesma conferência do texto digitado à mão.
   *
   * São três textos, e a conferência é de cada um: o "Responder agora"
   * pode estar impecável e o "Confirmar e encerrar" ter esquecido o nome.
   * Um aviso no bloco inteiro não diria de qual dos três está falando.
   *
   * Aqui a conversa é privada — dado pessoal pode circular entre a
   * operação e o cliente —, então a conferência olha o nome, o
   * acolhimento e a promessa de prazo, e não a LGPD da resposta pública.
   */
  const dados = resultado.dados as {
    resposta?: string;
    respostas?: { titulo?: string; quando?: string; texto?: string }[];
    situacao?: Parameters<typeof conferirSituacao>[0];
    tons?: Partial<Record<Tom, string>>;
    assunto?: string;
  };

  /*
    A situação (Fase 28): a da IA conferida — citação que não está na
    conversa sai, a data das promessas vem das mensagens, o risco nunca
    fica abaixo do que as regras veem. Sem IA, as regras preenchem.
  */
  const situacao = conferirSituacao(dados.situacao, mensagens, new Date());

  /*
    Os três tons (Fase 28): os da IA, ou os das regras com o estilo
    aprendido. Cada um passa pela conferência — e por uma a mais: prazo
    que a conversa não registra é promessa nova, feita sem querer.
  */
  const daIA = dados.tons && TONS.every((t) => typeof dados.tons?.[t.id] === "string" && dados.tons[t.id]!.trim()) ? dados.tons : null;
  /* O tema pelo catálogo de causas ("impressão de pedidos") diz mais que o assunto genérico do motor ("Sistema"). */
  const tema = familiaDoTexto(mensagens.filter((m) => m.de === "cliente").map((m) => m.texto).join("\n"))?.nome ?? String(dados.assunto ?? "o seu pedido");
  const semIA = tonsSemIA({ nome: corpo.contato?.nome, assunto: tema, situacao, estilo });
  const prazoConhecido = situacao.prometido.some((p) => p.quando);
  const tons = TONS.map((t, i) => {
    const texto = daIA ? String(daIA[t.id]) : semIA[i].texto;
    const conferencia = conferirRascunho(texto, { nome: corpo.contato?.nome, publico: false, prazoConhecido });
    if (prometeSemRegistro(texto, situacao) && !conferencia.some((a) => a.tipo === "promete-prazo")) {
      conferencia.push({ tipo: "promete-prazo", tom: "atencao", texto: "Fala em prazo que a conversa não registra — é uma promessa nova. Confirme antes de enviar." });
    }
    return { tom: t.id, rotulo: t.rotulo, quando: t.quando, texto, conferencia };
  });

  const conferir = (texto: string) =>
    conferirRascunho(texto, { nome: corpo.contato?.nome, publico: false });

  const respostas = Array.isArray(dados.respostas)
    ? dados.respostas.map((r) => {
        const conferencia = conferir(String(r.texto ?? ""));
        return {
          ...r,
          conferencia,
          resumoDaConferencia: resumoDoRascunho(conferencia),
        };
      })
    : dados.respostas;

  const conferencia = conferir(String(dados.resposta ?? ""));

  return responder(request, {
    ...resultado.dados,
    situacao,
    tons,
    estiloAprendido: Boolean(estilo.saudacao || estilo.despedida || estilo.exemplos.length),
    respostas,
    conferencia,
    resumoDaConferencia: resumoDoRascunho(conferencia),
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
