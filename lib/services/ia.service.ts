import Anthropic from "@anthropic-ai/sdk";

import {
  type ConfigDeIA,
  lerConfigDeIA,
} from "@/lib/services/iaConfig.service";

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
export function provedorDeIA(
  /**
   * A preferência já resolvida (banco > ambiente).
   *
   * Sem argumento, cai no ambiente — é o caminho de quem chama isto de
   * um script ou de uma tela que só quer saber "tem IA ligada?".
   */
  preferencia?: string
): Provedor | null {

  const preferido = (
    preferencia ??
    process.env.IA_PROVEDOR ??
    ""
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

/**
 * O outro provedor, quando existe um configurado.
 *
 * **Por que existe.** Medido em 26/08/2026: a única chave configurada é
 * a do Gemini, e o `check:ia` daquele momento voltou 503 — "O Gemini
 * está congestionado neste momento". Quando isso acontece, o resumo da
 * extensão simplesmente não sai, e para quem está atendendo a
 * ferramenta parece quebrada.
 *
 * A plataforma sempre soube falar com dois provedores, mas escolhia
 * **um** e parava ali. Ter a segunda chave e não usá-la numa hora
 * dessas é desperdício de uma redundância que já está paga.
 *
 * Devolve `null` quando só há um configurado — que é o caso hoje, e é
 * por isso que o `check:ia` diz na cara qual chave falta.
 */
export function provedorReserva(
  emUso: Provedor,
  preferencia?: string
): Provedor | null {

  const outro: Provedor =
    emUso === "gemini" ? "anthropic" : "gemini";

  /*
    A mesma checagem de chave do seletor, e não uma segunda.

    `provedorDeIA` com a preferência invertida responde exatamente
    "esse outro está utilizável?" sem duplicar a regra do marcador do
    .env.example, que já enganou uma vez.
  */
  return provedorDeIA(outro) === outro &&
    outro !== provedorDeIA(preferencia)
    ? outro
    : null;
}

export interface PedidoDeIA {
  sistema: string;
  prompt: string;
  /** JSON Schema do que se espera de volta. */
  esquema: Record<string, unknown>;
  /**
   * A tarefa vale mais rápida do que profunda?
   *
   * Resumir uma conversa é ler e condensar: o modelo menor faz igual e
   * responde em **um segundo** em vez de dez (medido). Triagem, não —
   * ali a decisão "dá para responder agora ou precisa apurar" é o
   * julgamento inteiro, e é o que o modelo maior faz melhor.
   */
  rapido?: boolean;
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

  /**
   * O perfil de velocidade vem da configuração, não de constante.
   *
   * "A IA está demorando" é reclamação da operação, e a resposta
   * estava numa variável de ambiente que a operação não abre. Agora a
   * escolha é na tela, e é lida aqui.
   */
  const config = await lerConfigDeIA();

  const provedor = provedorDeIA(
    config.provedorPreferido
  );

  if (!provedor) {
    return {
      provedor: "anthropic",
      status: 503,
      erro: "Nenhuma IA configurada. Defina ANTHROPIC_API_KEY ou GEMINI_API_KEY.",
    };
  }

  const primeira =
    provedor === "gemini"
      ? await peloGemini(pedido, config)
      : await pelaAnthropic(pedido, config);

  /*
    Deu certo, ou a culpa é do pedido: entrega como está.

    Só falha de infraestrutura justifica tentar de novo. 422 é recusa
    ou limite do modelo — repetir no outro provedor daria a mesma
    recusa, com o dobro do tempo de espera.
  */
  if (!primeira.erro || primeira.status === 422) {
    return primeira;
  }

  const reserva = provedorReserva(
    provedor,
    config.provedorPreferido
  );

  if (!reserva) return primeira;

  /**
   * A segunda tentativa, no outro provedor.
   *
   * O 503 de congestionamento do Gemini é o caso real: sem isto o
   * resumo da extensão simplesmente não sai, e quem está atendendo vê
   * uma ferramenta quebrada. A chave do outro provedor já está
   * configurada — não usá-la numa hora dessas é desperdiçar uma
   * redundância paga.
   *
   * Se a segunda também falhar, quem volta é a **primeira** resposta:
   * ela descreve o provedor que a operação escolheu, e é o erro que
   * faz sentido investigar.
   */
  const segunda =
    reserva === "gemini"
      ? await peloGemini(pedido, config)
      : await pelaAnthropic(pedido, config);

  return segunda.erro ? primeira : segunda;
}

/* ============================================================
   ANTHROPIC
============================================================ */

async function pelaAnthropic(
  pedido: PedidoDeIA,
  config: ConfigDeIA
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
        /**
         * O esforço acompanha o perfil escolhido na tela.
         *
         * Era `"low"` fixo, com a justificativa de que resumir não
         * melhora com deliberação. Continua verdade para resumir — mas
         * a mesma função atende a triagem, onde a decisão "responder ou
         * apurar" é o julgamento inteiro. Quem escolhe "Profundo" está
         * pedindo exatamente isso.
         */
        effort: pedido.rapido ? "low" : config.esforco,
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
 * Modelo, prazo e corrida vêm de `iaConfig.service.ts`.
 *
 * Eram constantes aqui, lidas do ambiente. Mudaram de lugar porque a
 * escolha deixou de ser de quem programa: "a IA está demorando" é uma
 * reclamação da operação, e a resposta estava numa variável que a
 * operação não abre. Os três perfis, e os tempos medidos que os
 * justificam, moram lá.
 */

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
  pedido: PedidoDeIA,
  config: ConfigDeIA
): Promise<RespostaDeIA> {

  /**
   * As duas se cobrem.
   *
   * Quem pede rápido começa pelo menor e tem o maior como reserva; quem
   * não pede começa pelo maior e tem o menor como reserva. Nos dois
   * casos a reserva é um modelo **medido como saudável**, e não o
   * apelido que costuma estar em fila.
   */
  const principal = pedido.rapido
    ? config.modeloRapido
    : config.modelo;

  const reserva = pedido.rapido
    ? config.modelo
    : config.modeloRapido;

  const resultado = await comReserva(
    pedido,
    principal,
    reserva,
    config
  );

  /**
   * Modelo aposentado é a única falha que o apelido resolve.
   *
   * Ele é o que nunca vira 404 — e é exatamente por isso que não serve
   * de principal: quem nunca 404 é quem todo mundo chama.
   */
  if (
    resultado.erro &&
    resultado.status === 502 &&
    resultado.erro.includes("não existe mais")
  ) {
    return chamarGemini(
      pedido,
      config.modeloReserva,
      config
    );
  }

  return resultado;
}

function espera(ms: number) {
  return new Promise<void>((resolver) =>
    setTimeout(resolver, ms)
  );
}

/**
 * A primeira que responder **bem** ganha; nula se nenhuma responder.
 *
 * Erro não vence corrida: um 404 que volta em 300 ms não pode
 * atropelar a chamada boa que ainda está a caminho.
 */
function primeiraBoa(
  tentativas: Promise<RespostaDeIA>[]
): Promise<RespostaDeIA | null> {

  return new Promise((resolver) => {

    let restantes = tentativas.length;

    const desistir = () => {
      restantes -= 1;
      if (restantes === 0) resolver(null);
    };

    for (const tentativa of tentativas) {
      tentativa
        .then((resposta) => {
          if (!resposta.erro) return resolver(resposta);
          desistir();
        })
        .catch(desistir);
    }
  });
}

/**
 * Chamada com reserva em paralelo.
 *
 * A principal sai na frente sozinha. Se ela responder bem dentro do
 * `HEDGE_MS`, acabou — o caminho feliz custa uma chamada, como antes.
 * Se demorar (ou falhar rápido), a reserva parte **sem cancelar a
 * primeira**, e vale quem chegar bem primeiro.
 *
 * A alternativa que estava aqui era sequencial: esperar a principal
 * estourar os 30 s e só então tentar a reserva — os 40 segundos que a
 * operação sentia. Somar prazos onde dava para sobrepor é o que
 * transformava uma fila do provedor em espera do atendente.
 */
async function comReserva(
  pedido: PedidoDeIA,
  principal: string,
  reserva: string,
  config: ConfigDeIA
): Promise<RespostaDeIA> {

  const daPrincipal = chamarGemini(
    pedido,
    principal,
    config
  );

  /**
   * Corrida desligada é uma escolha, não um caso degenerado.
   *
   * O perfil "Profundo" zera o `hedgeMs` de propósito: ali a pressa é
   * o que atrapalha, e chamar um modelo menor no meio do caminho
   * entregaria justamente a resposta rasa que se estava evitando.
   */
  if (reserva === principal || config.hedgeMs <= 0) {
    return daPrincipal;
  }

  const cedo = await Promise.race([
    daPrincipal,
    espera(config.hedgeMs).then(
      () => "demorou" as const
    ),
  ]);

  if (cedo !== "demorou" && !cedo.erro) return cedo;

  const daReserva = chamarGemini(
    pedido,
    reserva,
    config
  );

  const boa = await primeiraBoa([
    daPrincipal,
    daReserva,
  ]);

  /**
   * Nenhuma deu certo: vale o erro da principal.
   *
   * É o que descreve a instalação — chave errada, cota estourada,
   * esquema inválido. O erro da reserva costuma ser o mesmo motivo
   * dito de outro jeito.
   */
  return boa ?? (await daPrincipal);
}

async function chamarGemini(
  pedido: PedidoDeIA,
  modelo: string,
  config: ConfigDeIA
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
      signal: AbortSignal.timeout(config.prazoMs),
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

  } catch (erro) {

    /**
     * Estourar o prazo é falha transitória, e por isso devolve 503:
     * é o código que faz `peloGemini` tentar a reserva, em vez de
     * desistir de uma vez.
     */
    const expirou =
      erro instanceof Error &&
      (erro.name === "TimeoutError" ||
        erro.name === "AbortError");

    return {
      provedor: "gemini",
      status: expirou ? 503 : 502,
      erro: expirou
        ? `O Gemini não respondeu em ${Math.round(config.prazoMs / 1000)} segundos. A camada gratuita fica em fila nos horários de pico.`
        : "Falha ao falar com o Gemini.",
    };
  }
}

/* ============================================================
   CONVERSA EM FLUXO
============================================================ */

export interface Turno {
  role: "user" | "assistant";
  content: string;
}

export type PedacoDaConversa =
  | { tipo: "delta"; texto: string }
  | {
      tipo: "fim";
      uso: { entrada: number; saida: number };
    }
  | { tipo: "erro"; mensagem: string };

/**
 * O assistente, no provedor que estiver ligado.
 *
 * Em fluxo porque a resposta é longa e lida enquanto chega — esperar o
 * texto inteiro para então mostrar transforma vinte segundos de leitura
 * em vinte segundos de tela parada.
 *
 * O retrato da operação vai na **instrução de sistema**, e não como
 * primeiro turno: é a única forma que os dois provedores tratam igual, e
 * na Anthropic continua sendo o trecho estável que o cache de prompt
 * aproveita entre perguntas.
 */
export async function* conversar(pedido: {
  sistema: string;
  turnos: Turno[];
}): AsyncGenerator<PedacoDaConversa> {

  const config = await lerConfigDeIA();

  const provedor = provedorDeIA(
    config.provedorPreferido
  );

  if (!provedor) {
    yield {
      tipo: "erro",
      mensagem:
        "Nenhuma IA configurada. Defina ANTHROPIC_API_KEY ou GEMINI_API_KEY.",
    };
    return;
  }

  if (provedor === "gemini") {
    yield* conversarNoGemini(pedido, config);
    return;
  }

  yield* conversarNaAnthropic(pedido, config);
}

async function* conversarNaAnthropic(
  pedido: {
    sistema: string;
    turnos: Turno[];
  },
  config: ConfigDeIA
): AsyncGenerator<PedacoDaConversa> {

  const client = new Anthropic();

  try {

    const fluxo = client.messages.stream({
      model: "claude-opus-5",

      // Cobre o raciocínio adaptativo (ligado por padrão) mais o texto.
      max_tokens: 16000,

      system: [
        {
          type: "text",
          text: pedido.sistema,
          cache_control: { type: "ephemeral" },
        },
      ],
      // O esforço acompanha o perfil de velocidade escolhido na tela.
      output_config: { effort: config.esforco },
      messages: pedido.turnos.map((t) => ({
        role: t.role,
        content: t.content,
      })),
    });

    /**
     * Fila entre o evento e o gerador.
     *
     * O SDK entrega os deltas por callback e o gerador precisa
     * devolvê-los por `yield` — sem a fila, um dos dois lados teria de
     * bloquear o outro.
     */
    const pendentes: string[] = [];
    let acabou = false;
    let acordar: (() => void) | null = null;

    fluxo.on("text", (delta) => {
      pendentes.push(delta);
      acordar?.();
    });

    const finalizacao = fluxo
      .finalMessage()
      .finally(() => {
        acabou = true;
        acordar?.();
      });

    while (!acabou || pendentes.length > 0) {

      if (pendentes.length === 0) {
        await new Promise<void>((resolver) => {
          acordar = resolver;
        });
        acordar = null;
        continue;
      }

      yield { tipo: "delta", texto: pendentes.shift()! };
    }

    const final = await finalizacao;

    if (final.stop_reason === "refusal") {
      yield {
        tipo: "erro",
        mensagem:
          "O modelo recusou responder a esta pergunta.",
      };
      return;
    }

    yield {
      tipo: "fim",
      uso: {
        entrada: final.usage.input_tokens,
        saida: final.usage.output_tokens,
      },
    };

  } catch (erro) {

    yield {
      tipo: "erro",
      mensagem:
        erro instanceof Anthropic.RateLimitError
          ? "Limite de requisições atingido. Tente de novo em instantes."
          : erro instanceof Anthropic.AuthenticationError
            ? "Chave da Anthropic inválida."
            : erro instanceof Anthropic.APIError
              ? `Erro da API (${erro.status}).`
              : "Falha ao falar com o modelo.",
    };
  }
}

/**
 * O assistente no Gemini, com prazo para **começar** a responder.
 *
 * Streaming esconde a lentidão de um jeito perverso: a requisição é
 * aceita, a conexão fica aberta, e a tela mostra o cursor piscando
 * enquanto o modelo está numa fila do outro lado. Não havia prazo
 * nenhum aqui — a conversa podia ficar pendurada o quanto o provedor
 * quisesse, e foi isso que a operação sentiu como "o assistente
 * demora muito".
 *
 * Agora a régua é o **primeiro pedaço de texto**. Se ele não chega no
 * `HEDGE_MS`, a chamada é abortada e refeita no modelo menor — que
 * responde em um segundo. Como nada tinha sido escrito na tela ainda,
 * a troca é invisível: ninguém vê meia resposta de um modelo emendada
 * na metade do outro.
 */
async function* conversarNoGemini(
  pedido: {
    sistema: string;
    turnos: Turno[];
  },
  config: ConfigDeIA
): AsyncGenerator<PedacoDaConversa> {

  /**
   * Com a corrida desligada, o prazo do primeiro pedaço é o prazo
   * inteiro: o perfil "Profundo" pede para deixar o modelo pensar, e
   * trocar de modelo aos seis segundos seria o contrário disso.
   */
  const prazoDoPrimeiro =
    config.hedgeMs > 0 ? config.hedgeMs : config.prazoMs;

  const principal = await abrirFluxoGemini(
    pedido,
    config.modelo,
    prazoDoPrimeiro
  );

  if (principal.fluxo) {
    yield* principal.fluxo;
    return;
  }

  if (config.hedgeMs <= 0) {
    yield {
      tipo: "erro",
      mensagem:
        principal.erro ??
        "Falha ao falar com o Gemini.",
    };
    return;
  }

  const reserva = await abrirFluxoGemini(
    pedido,
    config.modeloRapido,
    config.prazoMs
  );

  if (reserva.fluxo) {
    yield* reserva.fluxo;
    return;
  }

  yield {
    tipo: "erro",
    mensagem:
      reserva.erro ??
      principal.erro ??
      "Falha ao falar com o Gemini.",
  };
}

interface FluxoAberto {
  fluxo?: AsyncGenerator<PedacoDaConversa>;
  erro?: string;
}

/**
 * Abre o fluxo e só o devolve depois do primeiro pedaço chegar.
 *
 * É o que permite trocar de modelo sem a pessoa ver: enquanto o
 * primeiro pedaço não veio, nada foi escrito, e desistir não deixa
 * rastro na tela.
 */
async function abrirFluxoGemini(
  pedido: { sistema: string; turnos: Turno[] },
  modelo: string,
  prazoDoPrimeiro: number
): Promise<FluxoAberto> {

  /**
   * `alt=sse` é o que faz o Gemini devolver eventos.
   *
   * Sem ele, `streamGenerateContent` devolve um array JSON inteiro no
   * fim — que é o oposto de fluxo, e daria a mesma tela parada que
   * motivou o streaming.
   */
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:streamGenerateContent?alt=sse`;

  const controle = new AbortController();

  let resposta: Response;

  try {
    resposta = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": chave("GEMINI_API_KEY"),
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: pedido.sistema }],
        },
        contents: pedido.turnos.map((t) => ({
          // O Gemini chama de "model" o que a Anthropic chama de
          // "assistant"; o papel do usuário tem o mesmo nome.
          role: t.role === "assistant" ? "model" : "user",
          parts: [{ text: t.content }],
        })),
      }),
      signal: controle.signal,
    });
  } catch {
    return { erro: "Falha ao falar com o Gemini." };
  }

  if (!resposta.ok || !resposta.body) {

    controle.abort();

    return {
      erro:
        resposta.status === 503
          ? "O Gemini está congestionado neste momento. Tente de novo em alguns segundos."
          : resposta.status === 429
            ? "Cota do Gemini esgotada. A camada gratuita tem limite por minuto e por dia."
            : resposta.status === 404
              ? `O modelo "${modelo}" não existe mais.`
              : `O Gemini respondeu ${resposta.status}.`,
    };
  }

  const pedacos = lerEventos(resposta.body.getReader());

  const primeiro = await Promise.race([
    pedacos.next(),
    espera(prazoDoPrimeiro).then(
      () => "demorou" as const
    ),
  ]);

  if (primeiro === "demorou") {

    controle.abort();

    return {
      erro: `O Gemini não começou a responder em ${Math.round(prazoDoPrimeiro / 1000)} segundos.`,
    };
  }

  if (primeiro.done) {
    return { erro: "O Gemini respondeu sem conteúdo." };
  }

  // Numa const: dentro do gerador o estreitamento de `primeiro` se perde.
  const abertura = primeiro.value;

  async function* comOPrimeiro() {
    yield abertura;
    yield* pedacos;
  }

  return { fluxo: comOPrimeiro() };
}

/**
 * Decodifica o SSE do Gemini em pedaços de conversa.
 *
 * **Exportada de propósito**, e não por acaso: o separador de eventos
 * derrubou o assistente inteiro em silêncio, e uma regra assim precisa
 * de prova. `npm run check:ia` exercita esta função com os dois
 * separadores, sem gastar chamada de modelo.
 */
export async function* lerEventos(
  leitor: ReadableStreamDefaultReader<Uint8Array>
): AsyncGenerator<PedacoDaConversa> {

  const decodificador = new TextDecoder();

  let sobra = "";
  let entrada = 0;
  let saida = 0;

  while (true) {

    let leitura;

    try {
      leitura = await leitor.read();
    } catch {
      // Fluxo abortado (troca de modelo) ou conexão caída.
      break;
    }

    if (leitura.done) break;

    sobra += decodificador.decode(leitura.value, {
      stream: true,
    });

    /**
     * Um evento por linha em branco dupla — **com ou sem `\r`**.
     *
     * Este `\r?` era o defeito inteiro do assistente. O Gemini separa
     * os eventos com `\r\n\r\n`, e o leitor dividia por `\n\n`: nenhum
     * evento fechava nunca, o fluxo era consumido inteiro sem render
     * nada, e o que chegava à tela era **HTTP 200 com zero caracteres**.
     * Sem erro e sem aviso — o assistente simplesmente não respondia, e
     * não havia onde olhar.
     *
     * Medido em 23/08 na mesma resposta: 4 eventos dividindo por
     * `\r\n\r\n`, **1** dividindo por `\n\n`.
     *
     * O SSE permite as duas formas, então o leitor aceita as duas — a
     * Anthropic manda sem `\r`, e trocar de provedor não pode voltar a
     * quebrar isto.
     *
     * O pedaço final pode vir cortado no meio, por isso a sobra volta
     * para a próxima volta.
     */
    const partes = sobra.split(/\r?\n\r?\n/);

    sobra = partes.pop() ?? "";

    for (const parte of partes) {

      const linha = parte
        .split(/\r?\n/)
        .find((l) => l.startsWith("data:"));

      if (!linha) continue;

      const cru = linha.slice(5).trim();

      if (cru === "" || cru === "[DONE]") continue;

      try {

        const evento = JSON.parse(cru);

        const texto = (
          evento.candidates?.[0]?.content?.parts ?? []
        )
          .map((p: { text?: string }) => p.text ?? "")
          .join("");

        if (texto) yield { tipo: "delta", texto };

        if (evento.usageMetadata) {
          entrada =
            evento.usageMetadata.promptTokenCount ??
            entrada;
          saida =
            evento.usageMetadata.candidatesTokenCount ??
            saida;
        }

      } catch {
        // Pedaço inválido não derruba a conversa inteira.
      }
    }
  }

  yield { tipo: "fim", uso: { entrada, saida } };
}

