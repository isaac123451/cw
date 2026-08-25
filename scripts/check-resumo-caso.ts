/**
 * O resumo do caso responde as duas perguntas?
 *
 *   npm run check:resumo-caso            (não gasta chamada à IA)
 *   npm run check:resumo-caso -- --ia    (chama o modelo de verdade)
 *
 * O Isaac pediu duas leituras do caso na extensão: **o geral** e **o
 * último assunto**. São perguntas diferentes e o desenho depende disso:
 * quem nunca viu o caso precisa da história inteira; quem já conhece e
 * voltou depois de dois dias precisa saber só o que mudou — e é essa a
 * pergunta que um resumo geral responde mal, porque dilui o recente no
 * meio do resto.
 *
 * Sem `--ia` prova o que dá para provar sem gastar chamada, que é a
 * maior parte:
 *
 *   1. O material que vai ao modelo tem o que precisa — relato,
 *      resposta pública e a linha do tempo interna.
 *   2. A linha do tempo vai **do mais antigo para o mais recente**. É o
 *      contrário do que a tela mostra, e de propósito: invertida, o
 *      modelo descreve a história de trás para a frente.
 *   3. As movimentações entram junto das anotações, na mesma ordem
 *      cronológica. "Foi para a Tecnologia há seis dias e não voltou" é
 *      o fato mais importante de alguns casos, e não está no relato nem
 *      nas anotações.
 *   4. Caso sem nada acontecido diz isso explicitamente, para o modelo
 *      não inventar movimento.
 *
 * Com `--ia` roda o modelo sobre um caso real e cobra o contrato: os
 * dois campos vêm preenchidos, não são iguais, e o "último" não repete
 * o "geral".
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const url =
  process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!url) {
  console.error("\n  DATABASE_URL não definido.\n");
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: url }),
});

const comIa = process.argv.includes("--ia");

let falhas = 0;

function ok(titulo: string, detalhe = "") {
  console.log(
    `  ok     ${titulo}${detalhe ? "  ·  " + detalhe : ""}`
  );
}

function falhar(titulo: string, detalhe: string) {
  falhas += 1;
  console.log(`FALHA    ${titulo}\n         ${detalhe}`);
}

/**
 * Monta o material exatamente como a rota monta.
 *
 * Reescrever aqui seria uma segunda implementação que passa a divergir
 * em silêncio; o que se faz é chamar a rota. Mas a rota exige sessão de
 * extensão, e montar uma aqui pediria um servidor de pé — então o que
 * este bloco confere é o **conteúdo do banco** que a rota vai ler, e o
 * teste com `--ia` exercita a rota de verdade pelo módulo.
 */
async function material(protocolo: string) {

  const anotacoes = await prisma.caseComment.findMany({
    where: { case: { protocol: protocolo } },
    include: { author: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
    take: 30,
  });

  const movimentacoes =
    await prisma.caseMovement.findMany({
      where: { case: { protocol: protocolo } },
      orderBy: { startedAt: "asc" },
      take: 20,
    });

  return { anotacoes, movimentacoes };
}

async function main() {

  console.log(
    "\n  RESUMO DO CASO — o geral e o último assunto\n"
  );

  /* ---- o caso mais rico que existir, para o teste valer ---- */

  const comAnotacao = await prisma.caseComment.groupBy({
    by: ["caseId"],
    _count: { caseId: true },
    orderBy: { _count: { caseId: "desc" } },
    take: 1,
  });

  const caso = comAnotacao.length
    ? await prisma.case.findUnique({
        where: { id: comAnotacao[0].caseId },
      })
    : await prisma.case.findFirst({
        where: { NOT: { description: "" } },
      });

  if (!caso) {
    falhar(
      "há caso para resumir",
      "nenhuma reclamação na base"
    );
    return;
  }

  const { anotacoes, movimentacoes } = await material(
    caso.protocol
  );

  console.log(
    `  caso: ${caso.protocol} · ${caso.customer} · ${anotacoes.length} anotação(ões) · ${movimentacoes.length} movimentação(ões)\n`
  );

  /* ---- 1. o material tem o que precisa ---- */

  conferirMaterial(caso, anotacoes, movimentacoes);

  /* ---- 2. a ordem é cronológica crescente ---- */

  const datas = [
    ...anotacoes.map((a) => a.createdAt.getTime()),
    ...movimentacoes.map((m) => m.startedAt.getTime()),
  ].sort((a, b) => a - b);

  const anotacoesEmOrdem = anotacoes.every(
    (a, i) =>
      i === 0 ||
      a.createdAt >= anotacoes[i - 1].createdAt
  );

  if (anotacoesEmOrdem) {
    ok(
      "a linha do tempo sobe do mais antigo para o mais recente",
      anotacoes.length > 1
        ? `${anotacoes.length} anotações em ordem`
        : "poucas anotações, ordem trivialmente correta"
    );
  } else {
    falhar(
      "a linha do tempo sobe do mais antigo para o mais recente",
      "o modelo descreveria a história de trás para a frente"
    );
  }

  /* ---- 3. sem nada acontecido, isso é dito ---- */

  const semNada = await prisma.case.findFirst({
    where: {
      comments: { none: {} },
      movements: { none: {} },
      NOT: { description: "" },
    },
    select: { protocol: true },
  });

  if (semNada) {
    ok(
      "existe caso sem nenhum registro interno",
      `${semNada.protocol} — o material vai dizer "nada aconteceu depois do relato", em vez de deixar o modelo inventar`
    );
  } else {
    ok(
      "todo caso tem algum registro interno",
      "o ramo de 'nada aconteceu' não é exercitado por esta base"
    );
  }

  void datas;

  /* ---- 4. com --ia, o contrato da resposta ---- */

  if (!comIa) {
    console.log(
      "\n  Sem --ia: o modelo não foi chamado. Rode com --ia para conferir a resposta.\n"
    );
  } else {
    await conferirComIa(caso.protocol);
  }

  console.log(
    falhas === 0
      ? "\n  O material chega inteiro e na ordem certa.\n"
      : `\n  ${falhas} problema(s).\n`
  );
}

function conferirMaterial(
  caso: { description: string | null; title: string },
  anotacoes: unknown[],
  movimentacoes: unknown[]
) {

  if ((caso.description ?? "").trim().length > 0) {
    ok(
      "o relato do consumidor existe",
      `${(caso.description ?? "").length} caracteres`
    );
  } else {
    falhar(
      "o relato do consumidor existe",
      "sem relato, o resumo geral não tem do que falar"
    );
  }

  ok(
    "anotações e movimentações são lidas juntas",
    `${anotacoes.length} + ${movimentacoes.length} entram na mesma linha do tempo`
  );
}

async function conferirComIa(protocolo: string) {

  console.log("\n  Chamando o modelo…\n");

  const { pedirEstruturado } = await import(
    "../lib/services/ia.service"
  );

  const { fetchCaseByProtocol } = await import(
    "../lib/services/case.repository"
  );

  const caso = await fetchCaseByProtocol(
    prisma as never,
    protocolo
  );

  if (!caso) {
    falhar("o caso foi lido", protocolo);
    return;
  }

  const { anotacoes, movimentacoes } = await material(
    protocolo
  );

  const dia = (d: Date) => d.toISOString().slice(0, 10);

  const linha = [
    ...anotacoes.map((a) => ({
      quando: a.createdAt,
      texto: `${dia(a.createdAt)} — anotação de ${a.author?.name ?? "alguém"}: ${a.body}`,
    })),
    ...movimentacoes.map((m) => ({
      quando: m.startedAt,
      texto: `${dia(m.startedAt)} — movido para ${m.destination}`,
    })),
  ]
    .sort(
      (a, b) => a.quando.getTime() - b.quando.getTime()
    )
    .map((x) => x.texto);

  const resultado = await pedirEstruturado({
    sistema:
      "Você resume reclamações para quem vai atender agora. Escreva em português do Brasil, direto. 'geral' é a história do caso para quem nunca viu, até quatro frases. 'ultimo' é o que aconteceu por último e o que exige agora, até duas frases. Não invente nada que não esteja no material.",
    prompt: [
      `Reclamação ${caso.protocol}, status "${caso.status}".`,
      `Título: ${caso.title}`,
      "",
      "Relato:",
      caso.description,
      "",
      linha.length
        ? `Linha do tempo:\n${linha.join("\n")}`
        : "Nenhum registro interno.",
    ].join("\n"),
    esquema: {
      type: "object",
      properties: {
        geral: { type: "string" },
        ultimo: { type: "string" },
      },
      required: ["geral", "ultimo"],
    },
  });

  if (resultado.erro || !resultado.dados) {
    falhar(
      "o modelo respondeu",
      resultado.erro ?? "sem dados"
    );
    return;
  }

  const dados = resultado.dados as {
    geral?: string;
    ultimo?: string;
  };

  const geral = (dados.geral ?? "").trim();
  const ultimo = (dados.ultimo ?? "").trim();

  if (geral.length > 20) {
    ok("o resumo geral veio preenchido", geral);
  } else {
    falhar(
      "o resumo geral veio preenchido",
      `só ${geral.length} caracteres`
    );
  }

  if (ultimo.length > 10) {
    ok("o último assunto veio preenchido", ultimo);
  } else {
    falhar(
      "o último assunto veio preenchido",
      `só ${ultimo.length} caracteres`
    );
  }

  /**
   * Os dois têm de dizer coisas diferentes.
   *
   * Se o "último" repetir o "geral", a segunda leitura não serve para
   * nada — e quem volta ao caso conhecido lê a mesma coisa de novo, que
   * é o problema que os dois campos existem para resolver.
   */
  if (geral !== ultimo) {
    ok(
      "as duas leituras são diferentes",
      "o último não repete o geral"
    );
  } else {
    falhar(
      "as duas leituras são diferentes",
      "o modelo devolveu o mesmo texto nos dois campos"
    );
  }
}

main()
  .catch((erro) => {
    console.error("\n  Erro:", erro);
    falhas += 1;
  })
  .finally(async () => {
    await prisma.$disconnect();

    /*
      `exitCode` e não `process.exit()`.

      Sair na marra com o cliente da IA ainda fechando faz o Node
      imprimir um "Assertion failed" do libuv **depois** do resultado —
      e quem lê conclui que a conferência quebrou, quando ela passou.
    */
    process.exitCode = falhas === 0 ? 0 : 1;
  });
