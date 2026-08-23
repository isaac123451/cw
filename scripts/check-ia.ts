/**
 * Diz qual IA está ligada — e prova, com uma chamada de verdade.
 *
 *   npm run check:ia
 *
 * Existe porque o sintoma de chave errada é péssimo: o botão "Resumir
 * conversa" da extensão simplesmente não fazia nada, e o motivo real
 * (`ANTHROPIC_API_KEY` com o valor de exemplo do `.env.example`) só
 * apareceu depois de ler o código. Aqui a resposta vem em duas linhas.
 *
 * Nunca imprime a chave — só o provedor, o tamanho e o veredito.
 */
import "dotenv/config";

import {
  lerEventos,
  pedirEstruturado,
  provedorDeIA,
} from "../lib/services/ia.service";
import { lerConfigDeIA } from "../lib/services/iaConfig.service";

function retrato(nome: string) {

  const valor = (process.env[nome] ?? "").trim();

  if (valor === "") return "ausente";

  if (valor.endsWith("...")) {
    return `MARCADOR do .env.example (${valor.length} caracteres) — não vale como chave`;
  }

  return `definida (${valor.length} caracteres)`;
}

async function main() {

  console.log("\nChaves\n");

  console.log(
    "  ANTHROPIC_API_KEY  ",
    retrato("ANTHROPIC_API_KEY")
  );
  console.log(
    "  GEMINI_API_KEY     ",
    retrato("GEMINI_API_KEY")
  );
  console.log(
    "  IA_PROVEDOR        ",
    (process.env.IA_PROVEDOR ?? "").trim() ||
      "(não definido — vale a ordem padrão)"
  );

  /**
   * O que está **valendo**, e não o que o `.env` sugere.
   *
   * A escolha de provedor e de velocidade virou configuração de tela,
   * gravada no banco. Um script que reportasse só as variáveis passaria
   * a mentir no dia em que alguém trocasse o perfil — e é justamente
   * este script que se roda para entender por que está lento.
   */
  const config = await lerConfigDeIA();

  const provedor = provedorDeIA(
    config.provedorPreferido
  );

  console.log("\nProvedor ativo:", provedor ?? "NENHUM");

  console.log(
    "Velocidade:    ",
    `${config.perfil} (${config.origem === "banco" ? "escolhida na tela" : "vinda do ambiente"})`
  );

  console.log(
    "Modelos:       ",
    `${config.modelo} · rápido: ${config.modeloRapido} · reserva: ${config.modeloReserva}`
  );

  console.log(
    "Prazos:        ",
    `corrida em ${Math.round(config.hedgeMs / 1000)}s · desiste em ${Math.round(config.prazoMs / 1000)}s`
  );

  if (!provedor) {
    console.log(
      "\n  O resumo de conversa fica desligado até uma das chaves existir.\n"
    );
    process.exit(1);
  }

  console.log(
    "\nChamando de verdade, com saída estruturada…\n"
  );

  /**
   * Um esquema minúsculo, mas com as três coisas que quebram na
   * prática: um enum, um inteiro e um campo obrigatório. Se o provedor
   * respeita isto, respeita o esquema do resumo.
   */
  const pedido = {
    sistema:
      "Você classifica mensagens curtas de clientes de um sistema para restaurantes. Responda em português do Brasil.",
    prompt:
      'Mensagem do cliente: "o pedido não chegou e ninguém me responde há dois dias".',
    esquema: {
      type: "object",
      properties: {
        assunto: {
          type: "string",
          description: "O tema em até cinco palavras.",
        },
        humor: {
          type: "integer",
          enum: [1, 2, 3, 4, 5],
          description:
            "1 irritado, 3 neutro, 5 encantado.",
        },
        urgente: { type: "boolean" },
      },
      required: ["assunto", "humor", "urgente"],
    },
  };

  /**
   * O tempo entra no relatório porque o defeito era ele.
   *
   * "Está configurado" não é a pergunta inteira: a IA já esteve ligada
   * e respondendo em 40 segundos, o que na prática é a mesma coisa que
   * desligada — ninguém espera isso com o cliente na linha. Sem o
   * número aqui, uma regressão de latência volta calada.
   */
  const marca = Date.now();

  const resultado = await pedirEstruturado(pedido);

  const msDaPadrao = Date.now() - marca;

  if (resultado.erro) {
    console.log("  FALHOU:", resultado.erro);
    console.log(
      "\n  Provedor tentado:",
      resultado.provedor,
      "· status",
      resultado.status
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    "  resposta:",
    JSON.stringify(resultado.dados)
  );

  console.log(
    "  tokens:  ",
    `${resultado.uso?.entrada ?? 0} de entrada, ${resultado.uso?.saida ?? 0} de saída`
  );

  console.log(
    "  tempo:   ",
    `${(msDaPadrao / 1000).toFixed(1)} s`
  );

  /**
   * O mesmo pedido pela via rápida.
   *
   * É a que o "Resumir conversa" usa — resumir é ler e condensar, e o
   * modelo menor faz igual. Ter os dois números lado a lado é o que
   * mostra se a escolha ainda se paga.
   */
  const marcaRapida = Date.now();

  const rapido = await pedirEstruturado({
    ...pedido,
    rapido: true,
  });

  console.log(
    "\n  pela via rápida:",
    rapido.erro
      ? `FALHOU — ${rapido.erro}`
      : `${((Date.now() - marcaRapida) / 1000).toFixed(1)} s · ${JSON.stringify(rapido.dados)}`
  );

  const dados = resultado.dados ?? {};

  const respeitouOEsquema =
    typeof dados.assunto === "string" &&
    [1, 2, 3, 4, 5].includes(dados.humor as number) &&
    typeof dados.urgente === "boolean";

  console.log(
    "\n  Esquema respeitado:",
    respeitouOEsquema ? "sim" : "NÃO"
  );

  console.log(
    respeitouOEsquema
      ? `\n${resultado.provedor} está funcionando. O botão "Resumir conversa" da extensão vai responder.`
      : "\n  O provedor respondeu, mas fora do formato pedido — o painel não conseguiria desenhar os campos."
  );

  /**
   * O resumo e o assistente usam vias diferentes.
   *
   * O resumo pede uma resposta inteira; o assistente **escuta um fluxo**.
   * Provar só o primeiro deixou passar o defeito que emudeceu o segundo
   * por completo — ver `conferirStreaming`.
   */
  const streamingOk = await conferirStreaming();

  process.exitCode =
    respeitouOEsquema && streamingOk ? 0 : 1;
}


/**
 * O separador de eventos do SSE — a prova mais barata deste arquivo.
 *
 * **Este `` derrubou o assistente inteiro em silêncio.** O Gemini
 * separa os eventos com `

`; o leitor dividia por `

`, nenhum
 * evento fechava, e a tela recebia HTTP 200 com zero caracteres. Sem
 * erro, sem aviso, sem onde olhar — a mesma classe de defeito do leitor
 * do WhatsApp.
 *
 * Roda sem gastar chamada de modelo: alimenta o decodificador com bytes
 * escritos à mão, nas duas convenções. É por isso que ele foi exportado.
 */
async function conferirStreaming() {

  const eventos = (sep: string) =>
    [
      `data: ${JSON.stringify({
        candidates: [
          { content: { parts: [{ text: "oi" }] } },
        ],
      })}`,
      `data: ${JSON.stringify({
        candidates: [
          { content: { parts: [{ text: " mundo" }] } },
        ],
        usageMetadata: {
          promptTokenCount: 7,
          candidatesTokenCount: 2,
        },
      })}`,
      "",
    ].join(sep);

  async function ler(corpo: string) {

    const bytes = new TextEncoder().encode(corpo);

    const fluxo = new ReadableStream<Uint8Array>({
      start(controle) {
        // Em dois pedaços, para exercitar a sobra entre leituras.
        controle.enqueue(bytes.slice(0, 60));
        controle.enqueue(bytes.slice(60));
        controle.close();
      },
    });

    let texto = "";
    let uso = { entrada: 0, saida: 0 };

    for await (const p of lerEventos(fluxo.getReader())) {
      if (p.tipo === "delta") texto += p.texto;
      if (p.tipo === "fim") uso = p.uso;
    }

    return { texto, uso };
  }

  console.log(
    "\n\nStreaming — separador de eventos\n"
  );

  const CR = String.fromCharCode(13);
  const LF = String.fromCharCode(10);

  const comCr = await ler(
    eventos(CR + LF + CR + LF)
  );

  const semCr = await ler(eventos(LF + LF));

  const casos: [string, boolean][] = [
    [
      "Gemini (CRLF CRLF) devolve o texto",
      comCr.texto === "oi mundo",
    ],
    [
      "e devolve o uso",
      comCr.uso.entrada === 7 && comCr.uso.saida === 2,
    ],
    [
      "Anthropic (LF LF) devolve o texto",
      semCr.texto === "oi mundo",
    ],
  ];

  let ok = true;

  for (const [nome, passou] of casos) {
    if (!passou) ok = false;
    console.log(
      `${passou ? "  ok  " : "FALHA "} ${nome}`
    );
  }

  console.log(
    ok
      ? "\n  O assistente recebe o que o modelo escreve.\n"
      : "\n  O decodificador de SSE está perdendo eventos — o assistente responderia vazio.\n"
  );

  return ok;
}

main().catch((erro) => {
  console.error("\n  Falhou:", erro);
  process.exit(1);
});
