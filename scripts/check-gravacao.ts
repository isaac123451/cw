/**
 * Gravar pela tela apaga o que a tela não carregou?
 *
 *   npm run check:gravacao
 *
 * **O defeito que isto existe para não repetir.** Em 03/09 a carga do
 * quadro passou a trazer cada reclamação **sem** relato e **sem**
 * resposta pública, para caber em 500 ms. A gravação continuou
 * mandando o caso inteiro, e transformava os dois textos ausentes em
 * nulo: arrastar um cartão, ligar uma etiqueta ou salvar qualquer campo
 * na tela do caso **apagava o relato e a resposta pública**. No ar desde
 * o deploy de 09/09; em 10/09, quando foi achado, ninguém tinha mexido
 * ainda.
 *
 * O teste usa a cópia **exata** que o quadro tem — a que sai de
 * `fetchCases` —, numa reclamação descartável, e grava por
 * `persistCase`, que é o caminho do arrasto, da etiqueta e do Salvar.
 *
 * E confere a outra metade: `fetchCaseTexts`, o que a tela do caso usa
 * para trazer os dois textos de volta, devolve os dois.
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { Case } from "../lib/models/case";

import {
  fetchCases,
  fetchCaseTexts,
  persistCase,
} from "../lib/services/case.repository";

const PROTOCOLO = "RA-ZzGravacaoDaTel";

const RELATO =
  "Pedi o cancelamento do plano em agosto e continuo sendo cobrado. Já abri três chamados e ninguém resolve.";

const RESPOSTA =
  "Olá! Confirmamos o cancelamento e o estorno das duas cobranças, que aparece em até sete dias úteis.";

let falhas = 0;

function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(
    `${ok ? "  ok  " : "FALHA "} ${titulo.padEnd(54)} ${JSON.stringify(obtido)?.slice(0, 50)}`
  );
  if (!ok) {
    console.log(`${" ".repeat(7)}${"esperado".padEnd(54)} ${JSON.stringify(esperado)?.slice(0, 50)}`);
  }
}

async function main() {
  console.log("\n  GRAVAÇÃO — a tela não apaga o que não carregou\n");

  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;

  if (!url) {
    console.log("  --   sem banco\n");
    return;
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: url }),
  });

  try {
    const modelo = (await fetchCases(prisma)).find((c) =>
      c.protocol.startsWith("RA-")
    );

    if (!modelo) {
      console.log("  --   sem reclamação para servir de modelo");
      return;
    }

    /* Sobra de uma rodada interrompida sai antes de começar. */
    await prisma.caseTag.deleteMany({ where: { case: { protocol: PROTOCOLO } } });
    await prisma.case.deleteMany({ where: { protocol: PROTOCOLO } });

    /* nasce com os dois textos, como qualquer reclamação respondida */
    await persistCase(prisma, {
      ...modelo,
      id: PROTOCOLO,
      protocol: PROTOCOLO,
      status: "Novo",
      description: RELATO,
      publicResponse: RESPOSTA,
      tags: [],
    } as Case);

    /* a cópia que o quadro tem */
    const doQuadro = (await fetchCases(prisma)).find(
      (c) => c.protocol === PROTOCOLO
    );

    conferir(
      "a lista vem sem os textos (é o que a torna rápida)",
      [doQuadro?.description ?? "", doQuadro?.publicResponse ?? null],
      ["", null]
    );

    conferir("mas sabe que a reclamação foi respondida", doQuadro?.respondida, true);

    /* arrastar o cartão: grava a cópia do quadro com a coluna nova */
    await persistCase(
      prisma,
      { ...(doQuadro as Case), status: "Aguardando avaliação" },
      { syncTags: false }
    );

    const depoisDoArrasto = await prisma.case.findUnique({
      where: { protocol: PROTOCOLO },
      select: { status: true, description: true, publicResponse: true },
    });

    conferir("o arrasto muda a coluna", depoisDoArrasto?.status, "Aguardando avaliação");
    conferir("e o relato continua", depoisDoArrasto?.description, RELATO);
    conferir("e a resposta pública continua", depoisDoArrasto?.publicResponse, RESPOSTA);

    /* ligar uma etiqueta: o mesmo caminho, com as etiquetas */
    await persistCase(prisma, { ...(doQuadro as Case), tags: [] });

    const depoisDaEtiqueta = await prisma.case.findUnique({
      where: { protocol: PROTOCOLO },
      select: { description: true, publicResponse: true },
    });

    conferir(
      "gravar pela etiqueta também preserva os dois",
      [depoisDaEtiqueta?.description, depoisDaEtiqueta?.publicResponse],
      [RELATO, RESPOSTA]
    );

    /* a tela do caso busca os dois de volta */
    const textos = await fetchCaseTexts(prisma, PROTOCOLO);

    conferir(
      "a tela do caso recebe relato e resposta",
      [textos.description, textos.publicResponse],
      [RELATO, RESPOSTA]
    );

    /* e editar de verdade continua gravando */
    const RESPOSTA_NOVA = `${RESPOSTA}\n\nAtualização: o estorno já foi processado.`;

    await persistCase(prisma, {
      ...(doQuadro as Case),
      publicResponse: RESPOSTA_NOVA,
    });

    conferir(
      "uma resposta editada na tela é gravada",
      (
        await prisma.case.findUnique({
          where: { protocol: PROTOCOLO },
          select: { publicResponse: true },
        })
      )?.publicResponse,
      RESPOSTA_NOVA
    );
  } finally {
    await prisma.caseTag.deleteMany({ where: { case: { protocol: PROTOCOLO } } });
    await prisma.case.deleteMany({ where: { protocol: PROTOCOLO } });
    await prisma.$disconnect();
  }

  console.log(
    falhas === 0
      ? "\n  Mover, etiquetar e salvar não apagam o que a tela não trouxe.\n"
      : `\n  ${falhas} ponto(s) em que a tela apagaria texto.\n`
  );

  process.exitCode = falhas === 0 ? 0 : 1;
}

main().catch((erro) => {
  console.error("\n  Erro:", erro);
  process.exitCode = 1;
});
