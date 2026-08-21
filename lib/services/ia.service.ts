import Anthropic from "@anthropic-ai/sdk";

/**
 * De quem é a inteligência — e por que isso é configuração, não código.
 *
 * O resumo de conversa nasceu preso à Anthropic. Quando a chave não foi
 * preenchida, o recurso simplesmente não existia, e trocar de provedor
 * exigiria mexer na rota. Aqui o provedor é escolhido pela chave que
 * estiver definida, e a rota não sabe qual é.
 *
 * **A escolha não é só de preço.** O que passa por aqui é conversa real
 * de consumidor — nome, telefone, o problema que a pessoa está tendo.
 * Camada gratuita costuma vir com a contrapartida de o conteúdo poder
 * ser usado para treinar o modelo; camada paga, não. Quem decide é o
 * Isaac, e por isso as duas portas existem — mas o aviso fica escrito
 * onde a decisão é tomada, e não escondido num README.
 *
 * **Sem `server-only`, de propósito.** Aquele marcador impediria
 * `npm run check:ia` de exercitar este arquivo — e um provedor que só
 * dá para testar abrindo a extensão é um provedor que ninguém testa. O
 * risco que ele cobriria é baixo aqui: não há segredo embutido, só
 * leitura de `process.env`, que no navegador vem vazio.
 */

export type Provedor = "anthropic" | "gemini";

function chave(nome: string) {
  const valor = (process.env[nome] ?? "").trim();

  /**
   * Marcador do `.env.example` não conta como chave.
   *
   * Foi exatamente o que aconteceu: `ANTHROPIC_API_KEY` ficou com o
   * valor de exemplo `"sk-ant-..."`, e o recurso respondia 503 sem
   * ninguém entender por quê.
   */
  return valor === "" || valor.endsWith("...")
    ? ""
    : valor;
}

/**
 * Qual provedor está configurado.
 *
 * A Anthropic ganha quando as duas chaves existem: é a que já estava
 * aqui, e trocar de modelo muda o texto que a operação lê. Para inverter
 * a ordem, defina `IA_PROVEDOR=gemini`.
 */
export function provedorDeIA(): Provedor | null {

  const preferido = (
    process.env.IA_PROVEDOR ?? ""
  ).trim().toLowerCase();

  const temAnthropic =
    chave("ANTHROPIC_API_KEY").startsWith("sk-ant-");

  const temGemini = chave("GEMINI_API_KEY") !== "";

  if (preferido === "gemini" && temGemini) return "gemini";
  if (preferido === "anthropic" && temAnthropic) {
    return "anthropic";
  }

  if (temAnthropic) return "anthropic";
  if (temGemini) return "gemini";

  return null;
}

export function temIA() {
  return provedorDeIA() !== null;
}

export interface PedidoDeIA {
  sistema: string;
  prompt: string;
  /** JSON Schema do que se espera de volta. */
  esquema: Record<string, unknown>;
}

export interface RespostaDeIA {
  dados?: Record<string, unknown>;
  erro?: string;
  /** 422 para recusa/limite do modelo, 502 para falha de infraestrutura. */
  status?: number;
  provedor: Provedor;
  uso?: { entrada: number; saida: number };
}

/**
 * Pede uma resposta **estruturada**, no provedor que estiver ligado.
 *
 * Estruturada e não texto livre: o painel desenha campos, e um resumo
 * em prosa obrigaria a extrair humor e pendência com expressão regular
 * — que é onde esse tipo de integração começa a mentir.
 */
export async function pedirEstruturado(
  pedido: PedidoDeIA
): Promise<RespostaDeIA> {

  const provedor = provedorDeIA();

  if (!provedor) {
    return {
      provedor: "anthropic",
      status: 503,
      erro: "Nenhuma IA configurada. Defina ANTHROPIC_API_KEY ou GEMINI_API_KEY.",
    };
  }

  return provedor === "gemini"
    ? peloGemini(pedido)
    : pelaAnthropic(pedido);
}

/* ============================================================
   ANTHROPIC
============================================================ */

async function pelaAnthropic(
  pedido: PedidoDeIA
): Promise<RespostaDeIA> {

  const client = new Anthropic();

  try {

    /**
     * Sem streaming: a resposta é curta e o painel precisa dela inteira
     * para desenhar os campos. `effort: "low"` porque a tarefa é leitura
     * e síntese de um texto curto — não é o tipo de problema que melhora
     * com mais deliberação, e o painel é interação de segundos.
     */
    const resposta = await client.messages.create({
      model: "claude-opus-5",

      /**
       * O teto cobre raciocínio **e** texto. Na Opus 5 o raciocínio vem
       * ligado por padrão, então um limite apertado truncaria a resposta
       * no meio.
       */
      max_tokens: 8000,
      system: pedido.sistema,
      output_config: {
        effort: "low",
        format: {
          type: "json_schema",
          schema: pedido.esquema,
        },
      },
      messages: [
        { role: "user", content: pedido.prompt },
      ],
    });

    /**
     * Recusa vem com HTTP 200 e conteúdo vazio — ler `content[0]` sem
     * checar quebraria justamente no caso em que a pessoa mais precisa
     * de uma mensagem clara.
     */
    if (resposta.stop_reason === "refusal") {
      return {
        provedor: "anthropic",
        status: 422,
        erro: "O modelo recusou resumir esta conversa.",
      };
    }

    if (resposta.stop_reason === "max_tokens") {
      return {
        provedor: "anthropic",
        status: 422,
        erro: "A conversa é longa demais para um resumo em uma passada.",
      };
    }

    const texto = resposta.content
      .filter((bloco) => bloco.type === "text")
      .map((bloco) => bloco.text)
      .join("");

    return {
      provedor: "anthropic",
      dados: JSON.parse(texto),
      uso: {
        entrada: resposta.usage.input_tokens,
        saida: resposta.usage.output_tokens,
      },
    };

  } catch (erro) {

    return {
      provedor: "anthropic",
      status: 502,
      erro:
        erro instanceof Anthropic.RateLimitError
          ? "Limite de requisições atingido. Tente de novo em instantes."
          : erro instanceof Anthropic.AuthenticationError
            ? "Chave da Anthropic inválida."
            : erro instanceof Anthropic.APIError
              ? `Erro da API (${erro.status}).`
              : "Falha ao resumir a conversa.",
    };
  }
}

/* ============================================================
   GEMINI
============================================================ */

/**
 * O modelo do Gemini — apelido por padrão, e isso é deliberado.
 *
 * O primeiro palpite aqui foi `gemini-2.0-flash`, e ele durou até a
 * primeira chamada: `404 — This model is no longer available`. A
 * família se renova rápido, e um nome fixo transforma o recurso em
 * defeito silencioso alguns meses depois de escrito.
 *
 * `gemini-flash-latest` aponta sempre para o flash corrente. O preço é
 * o comportamento poder mudar sozinho — mas para resumir conversa isso
 * significa a redação sair um pouco diferente, enquanto um 404 significa
 * o botão parar de funcionar. Quem quiser previsibilidade fixa a versão
 * em `GEMINI_MODELO` (`npm run check:ia` lista o que a conta enxerga).
 */
const MODELO_GEMINI =
  process.env.GEMINI_MODELO?.trim() ||
  "gemini-flash-latest";

/**
 * A reserva, para quando o apelido estiver em fila.
 *
 * Medido na primeira integração: `gemini-flash-latest` respondeu
 * `503 — high demand` enquanto `gemini-3.6-flash` respondia normalmente
 * no mesmo minuto. O apelido concentra a demanda de todo mundo que não
 * fixou versão, então é o mais sujeito a congestionar.
 *
 * Uma segunda tentativa, só em falha transitória, resolve sem custo no
 * caminho feliz — e mantém a vantagem do apelido, que é nunca virar 404
 * quando a família se renova.
 */
const RESERVA_GEMINI =
  process.env.GEMINI_MODELO_RESERVA?.trim() ||
  "gemini-3.6-flash";

/**
 * O `responseSchema` do Gemini é um subconjunto do JSON Schema.
 *
 * Ele aceita `type`, `properties`, `required`, `items`, `enum` e
 * `description` — e **recusa a requisição inteira** diante de chaves
 * que não conhece, como `additionalProperties`. Podar aqui é o que
 * permite manter um esquema só para os dois provedores.
 */
function paraGemini(
  esquema: Record<string, unknown>
): Record<string, unknown> {

  const aceitas = [
    "type",
    "properties",
    "required",
    "items",
    "enum",
    "description",
    "nullable",
  ];

  const saida: Record<string, unknown> = {};

  for (const [chaveDoCampo, valor] of Object.entries(
    esquema
  )) {

    if (!aceitas.includes(chaveDoCampo)) continue;

    if (chaveDoCampo === "properties" && valor) {

      const props: Record<string, unknown> = {};

      for (const [nome, sub] of Object.entries(
        valor as Record<string, Record<string, unknown>>
      )) {
        props[nome] = paraGemini(sub);
      }

      saida.properties = props;
      continue;
    }

    if (chaveDoCampo === "items" && valor) {
      saida.items = paraGemini(
        valor as Record<string, unknown>
      );
      continue;
    }

    saida[chaveDoCampo] = valor;
  }

  /**
   * O `enum` do Gemini **só aceita texto**.
   *
   * Medido: um campo inteiro com `enum: [1,2,3,4,5]` faz a requisição
   * inteira voltar 400 —
   * `Invalid value at '...enum[0]' (TYPE_STRING), 1`. E é justamente a
   * forma da régua de humor, que o resumo de conversa usa.
   *
   * Trocar o campo para texto mudaria o contrato para os dois
   * provedores. Então o enum sai do esquema e entra na **descrição**: o
   * modelo continua sabendo quais valores valem, e o tipo continua
   * inteiro dos dois lados. Se ele responder fora da lista, quem
   * reclama é a tela — não o provedor —, o que é melhor do que não
   * conseguir chamar.
   */
  if (
    Array.isArray(saida.enum) &&
    saida.type !== "string"
  ) {

    const valores = (saida.enum as unknown[]).join(", ");

    delete saida.enum;

    saida.description = [
      saida.description,
      `Valores aceitos: ${valores}.`,
    ]
      .filter(Boolean)
      .join(" ");
  }

  return saida;
}

/**
 * Chamada por HTTP, sem SDK.
 *
 * Uma dependência a mais para uma única requisição não se paga, e o
 * endpoint do Gemini é estável o bastante para ser chamado direto.
 */
async function peloGemini(
  pedido: PedidoDeIA
): Promise<RespostaDeIA> {

  const primeira = await chamarGemini(
    pedido,
    MODELO_GEMINI
  );

  /**
   * Só falha transitória tenta de novo, e só uma vez.
   *
   * Cota estourada (429) e esquema inválido (400) não melhoram com
   * repetição — repetir ali só gastaria a cota que já acabou.
   */
  if (
    primeira.status !== 503 ||
    RESERVA_GEMINI === MODELO_GEMINI
  ) {
    return primeira;
  }

  const segunda = await chamarGemini(
    pedido,
    RESERVA_GEMINI
  );

  return segunda.erro ? primeira : segunda;
}

async function chamarGemini(
  pedido: PedidoDeIA,
  modelo: string
): Promise<RespostaDeIA> {

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`;

  try {

    const resposta = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": chave("GEMINI_API_KEY"),
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: pedido.sistema }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: pedido.prompt }],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: paraGemini(pedido.esquema),
        },
      }),
    });

    if (!resposta.ok) {

      const detalhe = await resposta.text();

      /**
       * Três falhas com causas e respostas diferentes.
       *
       * O 503 é o mais comum na camada gratuita e o mais confundível:
       * é fila, não erro de configuração. Dizer "erro do Gemini" ali
       * manda a pessoa conferir a chave à toa — a resposta certa é
       * clicar de novo em alguns segundos.
       *
       * O 404 acontece quando o modelo fixado em `GEMINI_MODELO` é
       * aposentado; foi assim que `gemini-2.0-flash` saiu do ar.
       */
      const transitorio =
        resposta.status === 503 ||
        resposta.status === 500;

      return {
        provedor: "gemini",
        status: transitorio
          ? 503
          : resposta.status === 429
            ? 429
            : 502,
        erro: transitorio
          ? "O Gemini está congestionado neste momento. Tente de novo em alguns segundos."
          : resposta.status === 429
            ? "Cota do Gemini esgotada. A camada gratuita tem limite por minuto e por dia."
            : resposta.status === 404
              ? `O modelo "${modelo}" não existe mais. Rode "npm run check:ia" para ver os disponíveis e ajuste GEMINI_MODELO.`
              : `O Gemini respondeu ${resposta.status}. ${detalhe.slice(0, 160)}`,
      };
    }

    const corpo = (await resposta.json()) as {
      candidates?: {
        content?: { parts?: { text?: string }[] };
        finishReason?: string;
      }[];
      usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
      };
    };

    const candidato = corpo.candidates?.[0];

    /**
     * "SAFETY" e "RECITATION" chegam com HTTP 200 e sem texto — o mesmo
     * padrão da recusa da Anthropic, e pelo mesmo motivo precisa de
     * mensagem própria.
     */
    if (
      candidato?.finishReason &&
      candidato.finishReason !== "STOP"
    ) {
      return {
        provedor: "gemini",
        status: 422,
        erro: `O Gemini não concluiu o resumo (${candidato.finishReason}).`,
      };
    }

    const texto = (candidato?.content?.parts ?? [])
      .map((parte) => parte.text ?? "")
      .join("");

    if (!texto.trim()) {
      return {
        provedor: "gemini",
        status: 502,
        erro: "O Gemini respondeu sem conteúdo.",
      };
    }

    return {
      provedor: "gemini",
      dados: JSON.parse(texto),
      uso: {
        entrada:
          corpo.usageMetadata?.promptTokenCount ?? 0,
        saida:
          corpo.usageMetadata?.candidatesTokenCount ?? 0,
      },
    };

  } catch {
    return {
      provedor: "gemini",
      status: 502,
      erro: "Falha ao falar com o Gemini.",
    };
  }
}
