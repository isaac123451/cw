/**
 * Atualiza o que é fato do portal, e só isso.
 *
 *   npm run ra:atualizar -- --base <arquivo.xlsx>            (simula)
 *   npm run ra:atualizar -- --base <arquivo.xlsx> --gravar
 *
 * **O buraco que isto fecha.** A importação incremental cria o que
 * falta e **não regrava o que já existe** — de propósito, para não
 * desfazer o que a operação moveu no quadro. Mas isso deixa um vazio:
 * uma reclamação que já estava aqui e foi respondida, avaliada ou
 * resolvida **no portal** continua aparecendo como se nada tivesse
 * acontecido. Foi o sintoma que o Isaac descreveu: "ta dando 21
 * pendentes e nem tem isso tudo".
 *
 * **A regra que separa uma coisa da outra.** Existem dois donos para os
 * campos de uma reclamação:
 *
 * - O **portal** é dono do que o consumidor e o público fizeram:
 *   resposta pública e sua data, avaliação, nota, se foi resolvida, se
 *   voltaria a fazer negócio. Isso a operação não inventa e não deveria
 *   editar — quem manda é o Reclame Aqui.
 * - A **operação** é dona do que ela decidiu: coluna do quadro,
 *   responsável, time, etiquetas, prioridade, rascunho, dossiê.
 *
 * Este script toca **apenas o primeiro grupo**, e a lista está escrita
 * abaixo como código, não como intenção. Regravar o segundo grupo
 * apagaria trabalho — e é exatamente por isso que a importação
 * incremental se recusa a atualizar qualquer coisa.
 *
 * **Sem `--gravar` ele só mostra.** Cada mudança aparece campo a campo,
 * com o valor de antes e o de depois, para dar para conferir antes de
 * aceitar.
 */
import "dotenv/config";

import { readFileSync } from "node:fs";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import {
  parseReclameAqui,
  RELATO_SINTETICO,
  RESPOSTA_SINTETICA,
} from "../lib/services/raImport.service";

const url =
  process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!url) {
  console.error("\n  DATABASE_URL não definido.\n");
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: url }),
});

const args = process.argv.slice(2);

const arquivo = args[args.indexOf("--base") + 1];

const gravar = args.includes("--gravar");

if (!args.includes("--base") || !arquivo) {
  console.error(
    "\n  Falta --base <arquivo.xlsx>.\n"
  );
  process.exit(1);
}

/**
 * Os campos do portal. Nada fora desta lista é tocado.
 *
 * Escrita como constante e não embutida no código de gravação porque é
 * a decisão de segurança deste script: alguém que acrescente um campo
 * aqui está declarando "o portal é dono disto", e é uma linha que se lê
 * numa revisão.
 */
const DO_PORTAL = [
  "publicResponse",
  "publicResponseAt",
  "evaluated",
  "score",
  "resolved",
  "wouldDoBusiness",
  "evaluatedAt",
] as const;

/*
  Tempo de resposta e de solucao ficam de fora.

  Nao por descuido: sao **derivados** das datas acima, e no banco moram
  em outras colunas (`responseMinutes`, `solutionMinutes`, em numero).
  Gravar os dois lados abriria a porta para eles discordarem — uma data
  dizendo uma coisa e o tempo, outra. Com as datas certas, o tempo se
  recalcula; sem elas, o tempo sozinho nao prova nada.
*/

type CampoDoPortal = (typeof DO_PORTAL)[number];

function comparavel(valor: unknown) {

  if (valor === null || valor === undefined) return "";

  if (valor instanceof Date) {
    return valor.toISOString();
  }

  return String(valor).trim();
}

async function main() {

  console.log(
    "\n  ATUALIZAÇÃO — só o que é fato do portal\n"
  );

  const r = parseReclameAqui(readFileSync(arquivo), {
    keepPii: true,
  });

  console.log(
    `  arquivo: ${r.cases.length} reclamação(ões)\n`
  );

  const noBanco = await prisma.case.findMany({
    select: {
      id: true,
      protocol: true,
      externalId: true,
      publicResponse: true,
      publicResponseAt: true,
      evaluated: true,
      score: true,
      resolved: true,
      wouldDoBusiness: true,
      evaluatedAt: true,
    },
  });

  const porChave = new Map<string, (typeof noBanco)[number]>();

  for (const c of noBanco) {
    porChave.set(c.protocol, c);
    if (c.externalId) porChave.set(c.externalId, c);
  }

  let mudariam = 0;
  let semMudanca = 0;
  let naoEncontradas = 0;

  const porCampo = new Map<string, number>();

  const paraGravar: {
    id: string;
    protocolo: string;
    dados: Record<string, unknown>;
  }[] = [];

  for (const doArquivo of r.cases) {

    const atual = porChave.get(doArquivo.protocol);

    if (!atual) {
      naoEncontradas += 1;
      continue;
    }

    const dados: Record<string, unknown> = {};
    const diferencas: string[] = [];

    for (const campo of DO_PORTAL) {

      const novo = (
        doArquivo as unknown as Record<
          CampoDoPortal,
          unknown
        >
      )[campo];

      /*
        Campo ausente no arquivo não apaga o que está no banco.

        A planilha às vezes vem sem uma coluna; tratar ausência como
        "vazio" transformaria um relatório incompleto numa limpeza de
        dados que ninguém pediu.
      */
      if (novo === undefined || novo === null || novo === "") {
        continue;
      }

      /**
       * Marcador nao substitui conteudo.
       *
       * Esta planilha diz **se** a empresa respondeu, nao **o que** ela
       * respondeu — o leitor preenche com um texto sintetico para o
       * indice de resposta nao contar errado. Grava-lo por cima trocaria
       * a resposta de verdade, de 600 caracteres, pelos 38 do marcador.
       *
       * A simulacao pegou isso em 334 reclamacoes antes de qualquer
       * escrita. Sem esta recusa, o modo `--gravar` teria apagado o
       * trabalho de meses de atendimento numa linha de comando.
       */
      if (
        novo === RESPOSTA_SINTETICA ||
        novo === RELATO_SINTETICO
      ) {
        continue;
      }

      const velho = (
        atual as unknown as Record<string, unknown>
      )[campo];

      const a = comparavel(velho);

      const b =
        campo === "publicResponseAt" ||
        campo === "evaluatedAt"
          ? comparavel(new Date(String(novo)))
          : comparavel(novo);

      if (a === b) continue;

      dados[campo] =
        campo === "publicResponseAt" ||
        campo === "evaluatedAt"
          ? new Date(String(novo))
          : novo;

      diferencas.push(
        `${campo}: ${a.slice(0, 30) || "(vazio)"} → ${b.slice(0, 30)}`
      );

      porCampo.set(
        campo,
        (porCampo.get(campo) ?? 0) + 1
      );
    }

    if (diferencas.length === 0) {
      semMudanca += 1;
      continue;
    }

    mudariam += 1;

    if (mudariam <= 12) {
      console.log(
        `  ${doArquivo.protocol}`
      );
      for (const d of diferencas) {
        console.log(`      ${d}`);
      }
    }

    paraGravar.push({
      id: atual.id,
      protocolo: doArquivo.protocol,
      dados,
    });
  }

  if (mudariam > 12) {
    console.log(
      `\n  … e mais ${mudariam - 12} reclamação(ões) com mudança.`
    );
  }

  console.log(
    [
      "",
      `  mudariam:        ${mudariam}`,
      `  já iguais:       ${semMudanca}`,
      `  não estão aqui:  ${naoEncontradas}`,
      "",
      "  por campo:",
    ].join("\n")
  );

  for (const [campo, n] of [...porCampo.entries()].sort(
    (a, b) => b[1] - a[1]
  )) {
    console.log(`    ${campo.padEnd(20)} ${n}`);
  }

  if (!gravar) {
    console.log(
      "\n  SIMULAÇÃO — nada foi gravado. Repita com --gravar.\n"
    );
    await prisma.$disconnect();
    return;
  }

  for (const item of paraGravar) {
    await prisma.case.update({
      where: { id: item.id },
      data: item.dados,
    });
  }

  console.log(
    `\n  ${paraGravar.length} reclamação(ões) atualizadas. Coluna do quadro, responsável, time, etiquetas e rascunho ficaram como estavam.\n`
  );

  await prisma.$disconnect();
}

main().catch(async (erro) => {
  console.error("\n  Erro:", erro);
  await prisma.$disconnect();
  process.exit(1);
});
