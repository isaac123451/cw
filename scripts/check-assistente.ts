/**
 * O assistente responde o que a base sabe?
 *
 *   npm run check:assistente
 *
 * A queixa do Isaac foi precisa: **ele recusava perguntas que a base
 * responde**. "Quantas avaliações faltam para a nota 9" é conta, não
 * consulta a sistema externo — e caía num resumo genérico.
 *
 * A causa era estrutural, não de conteúdo: a assinatura da rotina era
 * `(input) => resposta`, sem a pergunta. Nenhuma habilidade tinha como
 * ler o "9". A pergunta do exemplo era impossível de responder por
 * construção.
 *
 * Este script cobra três coisas, sobre a base real:
 *
 *   1. Cada pergunta cai na rotina certa — e não no "não entendi".
 *   2. O número que o assistente dá é **o mesmo** que a calculadora dá.
 *      Duas contas em paralelo é como duas telas passam a discordar, e
 *      aqui a discordância seria sobre quanto trabalho fazer no mês.
 *   3. O que ele não sabe, ele diz que não sabe — em vez de devolver um
 *      resumo que parece resposta.
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { toCaseModel } from "../lib/services/case.mapper";

import {
  ask,
  type AssistantInput,
} from "../lib/services/assistant.service";

import { buildOperationSnapshot } from "../lib/services/assistant.context";

import {
  evaluationsToReach,
  getRange,
  getRawCounts,
  inRange,
  pendingEvaluations,
  scoreBands,
  scoreFrom,
} from "../lib/services/reputation.service";

const url =
  process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!url) {
  console.error("\n  DATABASE_URL não definido.\n");
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: url }),
});

let falhas = 0;

function ok(titulo: string, detalhe = "") {
  console.log(
    `  ok     ${titulo}${detalhe ? "\n         " + detalhe : ""}`
  );
}

function falhar(titulo: string, detalhe: string) {
  falhas += 1;
  console.log(`FALHA    ${titulo}\n         ${detalhe}`);
}

async function main() {

  console.log(
    "\n  ASSISTENTE — ele responde o que a base sabe?\n"
  );

  const linhas = await prisma.case.findMany({
    include: {
      category: { select: { name: true } },
      subcategory: { select: { name: true } },
      owner: { select: { name: true } },
      team: { select: { name: true } },
      tags: {
        include: { tag: { select: { name: true } } },
      },
    },
  });

  const cases = linhas.map((r) => toCaseModel(r));

  /*
    O NPS entra na entrada porque as rotinas novas dependem dele.

    Com `nps` ausente elas respondem "não recebi esse dado", que é a
    resposta certa mas não exercita a conta. Aqui vem do banco, como na
    tela.
  */
  const respostas = await prisma.npsResponse.findMany({
    select: {
      score: true,
      status: true,
      churnRisk: true,
      respondedAt: true,
      customer: true,
      comment: true,
    },
  });

  const entrada: AssistantInput = {
    cases,
    nps: respostas.map((r) => ({
      score: r.score,
      status: r.status,
      churnRisk: r.churnRisk,
      respondedAt: r.respondedAt.toISOString(),
      customer: r.customer,
      comment: r.comment,
    })),
    tasks: [],
    impacts: [],
    rules: [],
  };

  const range = getRange("6m", "vigente");

  const base = getRawCounts(
    cases.filter((c) =>
      inRange(c, range.start, range.end)
    )
  );

  const atual = scoreFrom(base);

  console.log(
    `  base: ${cases.length} reclamações · janela de 6 meses com ${base.received} · nota ${atual.raScore}\n`
  );

  /* ----------------------------------------------------------
     1. Cada pergunta cai na rotina certa.
  ---------------------------------------------------------- */

  const esperado: [string, string][] = [
    [
      "quantas avaliações faltam para a nota 9?",
      "meta-de-nota",
    ],
    [
      "quantas avaliações preciso para chegar na nota 8,5",
      "meta-de-nota",
    ],
    ["como subir a nota?", "meta-de-nota"],
    ["como está a nota hoje?", "nota"],
    [
      "quais reclamações estão sem resposta?",
      "sem-resposta",
    ],

    /*
      As rotinas novas, e por que cada uma existe.

      "como está o NPS" caía em "nota" antes — as duas frentes falam
      em nota, e o assistente respondia sobre o Reclame Aqui com a
      mesma segurança de uma resposta certa.
    */
    ["como está o NPS?", "nps"],
    ["quantos detratores temos?", "nps"],
    ["quem precisa de retenção?", "retencao"],
    ["estamos demorando muito para responder?", "tempo-resposta"],
  ];

  for (const [pergunta, rotina] of esperado) {

    const r = ask(pergunta, entrada);

    if (r.intent === rotina) {
      ok(
        `"${pergunta}"  →  ${r.intent}`,
        r.paragraphs[0].slice(0, 110)
      );
    } else {
      falhar(
        `"${pergunta}"`,
        `caiu em "${r.intent}", esperava "${rotina}". Primeira frase: ${r.paragraphs[0].slice(0, 90)}`
      );
    }
  }

  /* ----------------------------------------------------------
     2. O número bate com o da calculadora.
  ---------------------------------------------------------- */

  const proxima = [...scoreBands]
    .sort((a, b) => a.min - b.min)
    .find((b) => b.min > atual.raScore);

  const metas = [9, 8.5, proxima?.min ?? 10].filter(
    (m) => m > atual.raScore
  );

  for (const meta of metas) {

    const daCalculadora = evaluationsToReach(base, {
      label: `nota ${meta}`,
      range: "",
      color: "",
      min: meta,
    });

    const resposta = ask(
      `quantas avaliações faltam para a nota ${String(meta).replace(".", ",")}?`,
      entrada
    );

    const texto = resposta.paragraphs.join(" ");

    const numeros: string[] =
      texto.match(/\d+/g) ?? [];

    const bate = daCalculadora.reachable
      ? numeros.includes(String(daCalculadora.needed))
      : /não dá para chegar/i.test(texto);

    if (bate) {
      ok(
        `meta ${meta}: assistente e calculadora concordam`,
        daCalculadora.reachable
          ? `${daCalculadora.needed} avaliação(ões), projetando ${daCalculadora.projected}`
          : `inalcançável no período — os dois dizem o mesmo`
      );
    } else {
      falhar(
        `meta ${meta}: assistente e calculadora discordam`,
        `calculadora: ${daCalculadora.reachable ? daCalculadora.needed + " avaliações" : "inalcançável"} · assistente: ${texto.slice(0, 140)}`
      );
    }
  }

  /* ----------------------------------------------------------
     3. O que ele não sabe, ele diz que não sabe.
  ---------------------------------------------------------- */

  const foraDoEscopo = [
    "qual a previsão do tempo amanhã?",
    "quem ganhou o jogo ontem",
  ];

  for (const pergunta of foraDoEscopo) {

    const r = ask(pergunta, entrada);

    const admite =
      r.intent === "nao-entendi" &&
      /não entendi/i.test(r.paragraphs[0]);

    if (admite) {
      ok(
        `"${pergunta}" → admite que não sabe`,
        r.paragraphs[0].slice(0, 90)
      );
    } else {
      falhar(
        `"${pergunta}"`,
        `respondeu com "${r.intent}": ${r.paragraphs[0].slice(0, 110)}. Resumo genérico parece resposta — quem lê vai embora achando que perguntou certo.`
      );
    }
  }

  /* ----------------------------------------------------------
     3b. O retrato enviado ao modelo carrega as contas prontas.

     A tela /assistente não usa as rotinas locais: ela manda um retrato
     da operação para o Claude e pede que ele responda **só** com o que
     estiver ali. Era por isso que ele recusava — e recusava certo,
     porque o retrato trazia indicador cru e nenhuma projeção.

     A conta não pode ficar com o modelo: aritmética é o erro mais
     conhecido de modelo de linguagem, e aqui o número vira decisão de
     quanto trabalho a operação faz no mês.
  ---------------------------------------------------------- */

  const retrato = buildOperationSnapshot({
    cases,
    tasks: [],
    impacts: [],
    rules: [],
    establishments: [],
  });

  const temSecao = /Simulações já calculadas/.test(
    retrato
  );

  const temTeto = new RegExp(
    `ainda SEM avaliação: ${pendingEvaluations(base)}`
  ).test(retrato);

  if (temSecao && temTeto) {
    ok(
      "o retrato enviado ao modelo traz as simulações prontas",
      `teto de ${pendingEvaluations(base)} avaliações declarado`
    );
  } else {
    falhar(
      "o retrato enviado ao modelo traz as simulações prontas",
      `seção presente: ${temSecao} · teto correto: ${temTeto}. Sem isso o modelo recusa a pergunta, e recusa com razão.`
    );
  }

  /**
   * E o número do retrato é o mesmo da calculadora — senão o
   * assistente e a tela diriam coisas diferentes sobre o mesmo mês.
   */
  const proximaFaixa = [...scoreBands]
    .sort((a, b) => a.min - b.min)
    .find((b) => b.min > atual.raScore);

  if (proximaFaixa) {

    const esperadoNoRetrato = evaluationsToReach(
      base,
      proximaFaixa
    );

    const citado = esperadoNoRetrato.reachable
      ? retrato.includes(
          `faltam ${esperadoNoRetrato.needed} avaliação(ões)`
        )
      : /NÃO alcançável/.test(retrato);

    if (citado) {
      ok(
        `o retrato cita o número da calculadora para "${proximaFaixa.label}"`,
        esperadoNoRetrato.reachable
          ? `${esperadoNoRetrato.needed} avaliações`
          : "declarado inalcançável"
      );
    } else {
      falhar(
        `o retrato cita o número da calculadora para "${proximaFaixa.label}"`,
        `a calculadora diz ${esperadoNoRetrato.needed}, e o retrato não traz esse número`
      );
    }
  } else {
    ok(
      "a nota já está na faixa mais alta",
      `${atual.raScore} — o retrato declara isso em vez de inventar meta`
    );
  }

  /* ----------------------------------------------------------
     4. Nenhuma resposta promete o impossível.
  ---------------------------------------------------------- */

  const impossivel = ask(
    "quantas avaliações faltam para a nota 10?",
    entrada
  );

  const texto = impossivel.paragraphs.join(" ");

  const honesta =
    /não dá para chegar/i.test(texto) ||
    /faltam \d+/i.test(texto);

  if (honesta) {
    ok(
      "meta 10 recebe resposta honesta",
      texto.slice(0, 130)
    );
  } else {
    falhar(
      "meta 10 recebe resposta honesta",
      texto.slice(0, 160)
    );
  }

  console.log(
    falhas === 0
      ? "\n  Toda pergunta que a base responde tem resposta, com o mesmo número da calculadora.\n"
      : `\n  ${falhas} problema(s) no assistente.\n`
  );
}

main()
  .catch((erro) => {
    console.error("\n  Erro:", erro);
    falhas += 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(falhas === 0 ? 0 : 1);
  });
