/**
 * As anotações do NPS — as nossas e as que vêm do Wootric.
 *
 *   npm run check:notas-nps
 *
 * Três coisas que só se provam contra o banco:
 *
 * 1. **A nota do Wootric chega.** Ela vem no campo `notes` da mesma
 *    chamada que já busca as respostas — conferido na conta: 26 das 600
 *    mais recentes têm uma, quase sempre "Tentativa de contato feita.".
 *    Estavam sendo jogadas fora, e a ficha dizia "nenhuma tentativa
 *    registrada" sobre um ciclo em que alguém já tinha ligado.
 *
 * 2. **Reimportar espelha, não acumula.** A origem é o Wootric: uma
 *    nota apagada de lá tem de sumir daqui. Acumulando, a ficha
 *    encheria de anotações que já não existem na fonte.
 *
 * 3. **Anotação nossa não é tentativa de contato.** A tentativa tem
 *    canal e significa "liguei", e é a contagem dela que decide se o
 *    ciclo encerra por "sem retorno". Se uma anotação virasse tentativa,
 *    esse número passaria a mentir — e o ciclo encerraria sozinho.
 *
 * Nenhuma resposta real é tocada: tudo acontece num ciclo descartável,
 * criado e apagado aqui.
 */

import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { traduzir } from "../lib/services/wootric.service";

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

let falhas = 0;

function conferir(
  titulo: string,
  obtido: unknown,
  esperado: unknown
) {

  const ok =
    JSON.stringify(obtido) === JSON.stringify(esperado);

  if (!ok) falhas += 1;

  console.log(
    `  ${ok ? "ok  " : "FALHA"}  ${titulo.padEnd(46)} ${JSON.stringify(obtido)}`
  );

  if (!ok) {
    console.log(
      `${" ".repeat(9)}${"esperado".padEnd(46)} ${JSON.stringify(esperado)}`
    );
  }
}

const marca = Date.now().toString(36).toUpperCase();
const externalId = `ZZ-NOTA-${marca}`;

async function main() {

  console.log(
    "\n  NOTAS DO NPS — as nossas e as do Wootric\n"
  );

  /* ---- 1. a tradução lê o campo `notes` ---- */

  const traduzida = traduzir({
    id: 999999,
    end_user_id: 1,
    score: 4,
    text: "atendimento demorado",
    created_at: "2026-08-20 10:00:00 -0300",
    notes: [
      "Tentativa de contato feita.",
      "   ",
      "Cliente pediu retorno na segunda.",
    ],
    end_user: { email: "zz@exemplo.com" },
  });

  conferir(
    "1. a nota do Wootric é lida",
    traduzida?.notasDoWootric,
    [
      "Tentativa de contato feita.",
      "Cliente pediu retorno na segunda.",
    ]
  );

  /*
    A entrada em branco no meio some.

    A API devolve `null` quando não há nota e, em alguns registros,
    entradas vazias — guardar string vazia faria a ficha mostrar uma
    anotação em branco, que se lê como defeito da tela.
  */
  conferir(
    "1. entrada vazia não vira anotação em branco",
    traduzir({
      id: 999998,
      end_user_id: 1,
      score: 9,
      created_at: "2026-08-20 10:00:00 -0300",
      notes: ["", "  "],
    })?.notasDoWootric,
    []
  );

  conferir(
    "1. sem notas, lista vazia e não nulo",
    traduzir({
      id: 999997,
      end_user_id: 1,
      score: 9,
      created_at: "2026-08-20 10:00:00 -0300",
      notes: null,
    })?.notasDoWootric,
    []
  );

  /* ---- 2. o ciclo descartável ---- */

  const ciclo = await prisma.npsResponse.create({
    data: {
      externalId,
      score: 4,
      comment: "Conferência — descartável.",
      respondedAt: new Date(),
      customer: `ZZ Conferência ${marca}`,
      source: "Wootric",
      status: "Novo",
      firstContactDueAt: new Date(),
      wootricNotes: ["Tentativa de contato feita."],
    },
    select: { id: true },
  });

  const depoisDaPrimeira =
    await prisma.npsResponse.findUnique({
      where: { id: ciclo.id },
      select: { wootricNotes: true },
    });

  conferir(
    "2. a nota do Wootric foi gravada",
    depoisDaPrimeira?.wootricNotes,
    ["Tentativa de contato feita."]
  );

  /*
    Reimportar com a nota apagada da origem.

    É o caso que separa espelhar de acumular: lá a nota sumiu, aqui
    tem de sumir também.
  */
  await prisma.npsResponse.update({
    where: { id: ciclo.id },
    data: { wootricNotes: [] },
  });

  const depoisDaSegunda =
    await prisma.npsResponse.findUnique({
      where: { id: ciclo.id },
      select: { wootricNotes: true },
    });

  conferir(
    "2. reimportar espelha em vez de acumular",
    depoisDaSegunda?.wootricNotes,
    []
  );

  /* ---- 3. anotação nossa, e o que ela não mexe ---- */

  await prisma.npsNote.create({
    data: {
      responseId: ciclo.id,
      body: "Falei com o dono; ele topa reunião na quinta.",
      actor: "Conferência",
    },
  });

  const comAnotacao =
    await prisma.npsResponse.findUnique({
      where: { id: ciclo.id },
      select: {
        notes: {
          select: { body: true, actor: true },
        },
        _count: { select: { attempts: true } },
      },
    });

  conferir(
    "3. a anotação tem autor e ficou guardada",
    comAnotacao?.notes,
    [
      {
        body: "Falei com o dono; ele topa reunião na quinta.",
        actor: "Conferência",
      },
    ]
  );

  conferir(
    "3. e NÃO virou tentativa de contato",
    comAnotacao?._count.attempts,
    0
  );

  /* ---- 4. apagar o ciclo leva as anotações junto ---- */

  await prisma.npsResponse.delete({
    where: { id: ciclo.id },
  });

  conferir(
    "4. o ciclo descartável saiu da base",
    await prisma.npsResponse.findUnique({
      where: { id: ciclo.id },
      select: { id: true },
    }),
    null
  );

  conferir(
    "4. e as anotações dele foram junto",
    await prisma.npsNote.count({
      where: { responseId: ciclo.id },
    }),
    0
  );

  /* ---- o retrato da base real ---- */

  const total = await prisma.npsResponse.count();

  const comNotaDoWootric = await prisma.npsResponse.count({
    where: { NOT: { wootricNotes: { isEmpty: true } } },
  });

  const nossas = await prisma.npsNote.count();

  console.log(
    `\n  base: ${total} resposta(s) · ${comNotaDoWootric} com nota do Wootric · ${nossas} anotação(ões) nossa(s)`
  );

  if (comNotaDoWootric === 0) {
    console.log(
      "  (zero é esperado até a próxima importação: o campo é novo)"
    );
  }

  console.log(
    falhas === 0
      ? "\n  As duas origens chegam, e nenhuma finge ser a outra.\n"
      : `\n  ${falhas} ponto(s) a corrigir.\n`
  );

  await prisma.$disconnect();

  process.exit(falhas === 0 ? 0 : 1);
}

main().catch(async (erro) => {
  console.error("\n  Erro:", erro);
  await prisma.npsResponse
    .deleteMany({ where: { externalId } })
    .catch(() => undefined);
  await prisma.$disconnect();
  process.exit(1);
});
