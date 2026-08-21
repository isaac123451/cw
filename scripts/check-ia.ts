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
  pedirEstruturado,
  provedorDeIA,
} from "../lib/services/ia.service";

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

  const provedor = provedorDeIA();

  console.log("\nProvedor ativo:", provedor ?? "NENHUM");

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
  const resultado = await pedirEstruturado({
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
  });

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
      ? `\n${resultado.provedor} está funcionando. O botão "Resumir conversa" da extensão vai responder.\n`
      : "\n  O provedor respondeu, mas fora do formato pedido — o painel não conseguiria desenhar os campos.\n"
  );

  process.exitCode = respeitouOEsquema ? 0 : 1;
}

main().catch((erro) => {
  console.error("\n  Falhou:", erro);
  process.exit(1);
});
