/**
 * O agente do assistente: ele escolhe certo, e mede certo?
 *
 *   npm run check:agente          (sem chamar o modelo)
 *   npm run check:agente -- --ia  (com a escolha de verdade)
 *
 * O assistente tinha dois modos e um buraco entre eles. As rotinas
 * determinísticas respondem exato e de graça — mas só as nove perguntas
 * que alguém previu. O caminho pela IA mandava um **retrato fixo** da
 * operação: se o número que a pergunta pedia não estivesse ali, o modelo
 * dizia que não sabia ou arredondava a partir do que tinha.
 *
 * O agente fecha o buraco publicando um catálogo de medições. O modelo
 * escolhe quais rodar; o servidor roda contra o Postgres, pelas mesmas
 * funções que as telas usam.
 *
 * **O que esta verificação protege.** Duas coisas, e as duas quebram em
 * silêncio:
 *
 * 1. **Toda medição roda sem estourar.** Uma que lança exceção some
 *    dentro do `try` da rota, e a resposta sai sem o número — com a
 *    mesma cara de uma resposta completa.
 *
 * 2. **O número do agente é o número da tela.** Se as duas contas
 *    divergirem, o assistente passa a contradizer o painel com a mesma
 *    confiança. É por isso que a medição delega para os serviços, e é
 *    isso que a comparação abaixo confere.
 */

import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import {
  CATALOGO,
  dadosParaMedir,
  escolherMedicoes,
  medir,
} from "../lib/services/assistant.agent";

import { fetchCases } from "../lib/services/case.repository";

import {
  getRange,
  getRawCounts,
  inRange,
  ptBR,
  scoreFrom,
} from "../lib/services/reputation.service";

import {
  naSituacao,
  seteDiasAtras,
} from "../lib/services/case.service";

const url =
  process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!url) {
  console.error(
    "\n  DATABASE_URL não definido — configure o banco antes.\n"
  );
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: url }),
});

const comIa = process.argv.includes("--ia");

let falhas = 0;

function ok(titulo: string, detalhe = "") {
  console.log(
    `  ok     ${titulo}${detalhe ? `\n         ${detalhe}` : ""}`
  );
}

function falhar(titulo: string, detalhe: string) {
  falhas += 1;
  console.log(`FALHA    ${titulo}\n         ${detalhe}`);
}

async function main() {

  console.log(
    "\n  AGENTE — ele escolhe certo, e mede certo?\n"
  );

  const cases = await fetchCases(prisma);

  const dados = await dadosParaMedir(prisma, cases);

  console.log(
    `  base: ${dados.cases.length} caso(s) · ${dados.nps.length} resposta(s) de NPS\n`
  );

  /* ---------------------------------------- 1. todas rodam ---- */

  for (const medicao of CATALOGO) {

    let saida = "";

    try {
      saida = medicao.rodar(
        dados,
        medicao.argumento ? "9" : undefined
      );
    } catch (erro) {
      falhar(
        `${medicao.nome} estourou`,
        erro instanceof Error ? erro.message : "erro"
      );
      continue;
    }

    /*
      Saída vazia é falha.

      Uma medição que devolve string vazia chega ao modelo como uma
      linha em branco — ele responde sem o dado e sem saber que não o
      recebeu, que é o mesmo que inventar.
    */
    if (saida.trim() === "") {
      falhar(
        `${medicao.nome} devolveu vazio`,
        "o modelo receberia uma linha em branco"
      );
      continue;
    }

    ok(medicao.nome, saida.slice(0, 110));
  }

  /* ------------------------------ 2. o número bate com a tela ---- */

  console.log("");

  const janela = getRange("6m", "vigente");

  const naJanela = dados.cases.filter((item) =>
    inRange(item, janela.start, janela.end)
  );

  const daTela = scoreFrom(getRawCounts(naJanela));

  const doAgente =
    CATALOGO.find((m) => m.nome === "reputacao")?.rodar(
      dados
    ) ?? "";

  const notaNoTexto = doAgente.match(
    /nota ([\d,]+) de 10/
  )?.[1];

  if (notaNoTexto === ptBR(daTela.raScore)) {
    ok(
      "a nota do agente é a mesma da tela",
      `${notaNoTexto} nos dois`
    );
  } else {
    falhar(
      "a nota do agente é a mesma da tela",
      `agente ${notaNoTexto}, tela ${ptBR(daTela.raScore)}`
    );
  }

  const corte = seteDiasAtras();

  const vencidasNaTela = dados.cases.filter((item) =>
    naSituacao(item, "vencidas", corte)
  ).length;

  const filaDoAgente =
    CATALOGO.find(
      (m) => m.nome === "fila_da_operacao"
    )?.rodar(dados) ?? "";

  const vencidasNoTexto = filaDoAgente.match(
    /vencidas há \+7 dias: (\d+)/
  )?.[1];

  if (Number(vencidasNoTexto) === vencidasNaTela) {
    ok(
      "as vencidas do agente são as do painel",
      `${vencidasNaTela} nos dois`
    );
  } else {
    falhar(
      "as vencidas do agente são as do painel",
      `agente ${vencidasNoTexto}, painel ${vencidasNaTela}`
    );
  }

  /* ------------------------------ 3. o argumento é respeitado ---- */

  const caminho = CATALOGO.find(
    (m) => m.nome === "caminho_para_nota"
  );

  const paraNove = caminho?.rodar(dados, "9") ?? "";
  const paraDez = caminho?.rodar(dados, "10") ?? "";

  if (paraNove !== paraDez) {
    ok(
      "o argumento muda o resultado",
      "nota 9 e nota 10 dão respostas diferentes"
    );
  } else {
    falhar(
      "o argumento muda o resultado",
      "nota 9 e nota 10 deram a mesma resposta — o argumento está sendo ignorado"
    );
  }

  const lixo = caminho?.rodar(dados, "banana") ?? "";

  if (lixo.includes("inválido")) {
    ok(
      "argumento sem sentido é recusado",
      lixo.slice(0, 70)
    );
  } else {
    falhar(
      "argumento sem sentido é recusado",
      `devolveu: ${lixo.slice(0, 90)}`
    );
  }

  /* ------------------------------ 4. o bloco final ---- */

  const bloco = medir(dados, [
    { nome: "reputacao" },
    { nome: "nps" },
    { nome: "inventada" },
  ]);

  if (bloco.includes("inventada: medição desconhecida")) {
    ok(
      "medição inventada vira aviso, não silêncio",
      "o modelo saberia que não recebeu o dado"
    );
  } else {
    falhar(
      "medição inventada vira aviso, não silêncio",
      bloco.slice(0, 120)
    );
  }

  /* ------------------------------ 5. a escolha, com o modelo ---- */

  if (!comIa) {
    console.log(
      "\n  Sem --ia: a escolha não foi exercitada. Rode com --ia para conferir.\n"
    );
  } else {

    console.log("\n  Pedindo ao modelo que escolha…\n");

    const casos: [string, string][] = [
      [
        "quantas avaliações preciso para chegar a 9,5?",
        "caminho_para_nota",
      ],
      [
        "estamos demorando muito para responder?",
        "espera_do_consumidor",
      ],
      ["como está o NPS?", "nps"],
      [
        "qual categoria está crescendo?",
        "causas_no_tempo",
      ],
    ];

    for (const [pergunta, esperada] of casos) {

      const escolhas = await escolherMedicoes(pergunta);

      const nomes = escolhas.map((e) => e.nome);

      if (nomes.includes(esperada)) {
        ok(
          `"${pergunta}"`,
          `escolheu ${nomes.join(", ") || "nada"}`
        );
      } else {
        falhar(
          `"${pergunta}"`,
          `escolheu ${nomes.join(", ") || "nada"}, esperava incluir ${esperada}`
        );
      }
    }

    /*
      Pergunta fora do assunto não deve escolher nada.

      É a mesma regra das rotinas determinísticas: preferir dizer que
      não sabe a responder com números que não têm relação.
    */
    const fora = await escolherMedicoes(
      "qual a previsão do tempo amanhã?"
    );

    if (fora.length === 0) {
      ok(
        '"qual a previsão do tempo amanhã?" → não mede nada',
        "não gasta consulta com o que não é da operação"
      );
    } else {
      falhar(
        '"qual a previsão do tempo amanhã?" → não mede nada',
        `escolheu ${fora.map((e) => e.nome).join(", ")}`
      );
    }
  }

  console.log(
    falhas === 0
      ? "\n  O agente mede o que a tela mede, e diz quando não sabe.\n"
      : `\n  ${falhas} ponto(s) a corrigir.\n`
  );

  await prisma.$disconnect();

  process.exit(falhas === 0 ? 0 : 1);
}

main().catch(async (erro) => {
  console.error("\n  Erro:", erro);
  await prisma.$disconnect();
  process.exit(1);
});
