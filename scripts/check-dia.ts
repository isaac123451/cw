/**
 * Cada coisa cai no dia certo?
 *
 *   npm run check:dia
 *
 * **O defeito que isto existe para não repetir.** `diaNaOperacao` foi
 * criada para jogar no dia de São Paulo o que aconteceu depois das 21h
 * — e convertia **também** texto que já era dia. `"2026-09-08"` é lido
 * pelo JavaScript como meia-noite UTC, que em São Paulo é 21h da
 * véspera: a função devolvia `"2026-09-07"`.
 *
 * O modelo de caso entrega as datas exatamente assim. Resultado: as
 * métricas diárias contaram toda reclamação, resposta e avaliação um
 * dia antes, e as do dia 1º no mês anterior — e a rotina gravou isso
 * na tabela, todo dia. `tsc` e lint limpos, porque dia errado é
 * sintaticamente perfeito.
 *
 * A conferência roda as três regras contra o banco:
 *
 *  1. dia que já é dia passa reto — para as 353 reclamações;
 *  2. hora de verdade vira o dia de São Paulo — para as respostas do
 *     NPS dadas entre 21h e 23h59;
 *  3. a métrica diária conta a reclamação no dia em que ela entrou.
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { fetchCases } from "../lib/services/case.repository";
import { medirDia } from "../lib/services/metricas.service";
import { diaNaOperacao } from "../lib/services/reputation.service";

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

/** O dia de parede em São Paulo, calculado por outro caminho. */
function diaEmSaoPaulo(instante: Date) {
  return instante
    .toLocaleString("sv-SE", {
      timeZone: "America/Sao_Paulo",
    })
    .slice(0, 10);
}

async function main() {
  console.log("\n  DIA — cada coisa cai no dia certo?\n");

  /* ---------------- as regras, sem banco ---------------- */

  const casos: [string, string, string][] = [
    ["2026-09-08", "2026-09-08", "texto só de data passa reto"],
    ["2026-09-01", "2026-09-01", "o dia 1º não vira o mês anterior"],
    [
      "2026-09-08T00:00:00.000Z",
      "2026-09-08",
      "coluna só de data, lida do banco, passa reto",
    ],
    [
      "2026-09-09T01:30:00.000Z",
      "2026-09-08",
      "22h30 em São Paulo continua no dia 8",
    ],
    [
      "2026-09-08T15:00:00.000Z",
      "2026-09-08",
      "meio-dia fica no mesmo dia",
    ],
  ];

  for (const [entrada, esperado, titulo] of casos) {
    const saiu = diaNaOperacao(entrada);

    if (saiu === esperado) {
      ok(titulo, `${entrada} → ${saiu}`);
    } else {
      falhar(titulo, `${entrada} → ${saiu}, e devia ser ${esperado}`);
    }
  }

  const url =
    process.env.DIRECT_URL || process.env.DATABASE_URL;

  if (!url) {
    console.log(
      "\n  --     sem banco: as partes 2 e 3 dependem dele\n"
    );
    process.exitCode = falhas === 0 ? 0 : 1;
    return;
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: url }),
  });

  try {
    /* ---------------- 1. as reclamações ---------------- */

    console.log("");

    const cases = await fetchCases(prisma);

    const deslocadas = cases.flatMap((c) =>
      (
        [
          ["publicação", c.createdAt],
          ["resposta", c.publicResponseAt],
          ["avaliação", c.evaluatedAt],
        ] as const
      )
        .filter(([, valor]) => Boolean(valor))
        /*
          O dia esperado é o que está escrito nos dez primeiros
          caracteres. A publicação chega como `AAAA-MM-DD`, a resposta
          como ISO completo (`…T00:00:00.000Z`) — as duas são colunas
          só de data, e nas duas o dia é o que está gravado.
        */
        .filter(
          ([, valor]) =>
            diaNaOperacao(valor as string) !==
            (valor as string).slice(0, 10)
        )
        .map(
          ([campo, valor]) =>
            `${c.protocol}: ${campo} ${valor} → ${diaNaOperacao(valor as string)}`
        )
    );

    if (deslocadas.length === 0) {
      ok(
        "nenhuma data de reclamação muda de dia",
        `${cases.length} reclamação(ões), publicação, resposta e avaliação`
      );
    } else {
      falhar(
        "nenhuma data de reclamação muda de dia",
        [
          `${deslocadas.length} data(s) deslocadas, por exemplo:`,
          ...deslocadas.slice(0, 4),
        ].join("\n         ")
      );
    }

    /* ---------------- 2. o NPS da noite ---------------- */

    /*
      A seleção é feita aqui, e não no SQL.

      O Prisma grava `DateTime` como `timestamp` **sem** fuso, e
      `coluna AT TIME ZONE 'America/Sao_Paulo'` numa coluna assim faz o
      contrário do que parece: trata o valor como hora de São Paulo e
      converte para UTC. A primeira versão desta conferência caiu nisso
      e selecionou 337 respostas "da noite" — as de verdade são 98.
    */
    const todas = await prisma.npsResponse.findMany({
      select: { respondedAt: true },
    });

    const daNoite = todas.filter(
      (n) =>
        Number(
          n.respondedAt.toLocaleString("en-US", {
            timeZone: "America/Sao_Paulo",
            hour: "2-digit",
            hourCycle: "h23",
          })
        ) >= 21
    );

    const erradas = daNoite.filter(
      (n) =>
        diaNaOperacao(n.respondedAt) !==
        diaEmSaoPaulo(n.respondedAt)
    );

    if (daNoite.length === 0) {
      console.log(
        "  --     nenhuma resposta do NPS depois das 21h para conferir"
      );
    } else if (erradas.length === 0) {
      ok(
        "resposta do NPS depois das 21h fica no dia em que foi dada",
        `${daNoite.length} resposta(s) entre 21h e 23h59, todas no dia de São Paulo`
      );
    } else {
      falhar(
        "resposta do NPS depois das 21h fica no dia em que foi dada",
        `${erradas.length} de ${daNoite.length} foram para o dia seguinte`
      );
    }

    /* ---------------- 3. a métrica diária ---------------- */

    const comEntrada = [...cases]
      .map((c) => c.createdAt)
      .sort()
      .reverse();

    const alvo = comEntrada.find((d) => d.slice(8, 10) !== "01");

    if (!alvo) {
      console.log("  --     sem reclamação para medir o dia");
    } else {
      const noDia = cases.filter((c) => c.createdAt === alvo).length;

      const vespera = new Date(`${alvo}T00:00:00Z`);
      vespera.setUTCDate(vespera.getUTCDate() - 1);
      const diaAnterior = vespera.toISOString().slice(0, 10);

      const impactos: {
        date: Date;
        wouldHaveChurned: boolean | null;
      }[] = [];

      const hoje = medirDia(cases, impactos, alvo);
      const ontem = medirDia(cases, impactos, diaAnterior);

      /*
        No mesmo mês, a diferença entre um dia e a véspera nas
        entrantes é exatamente o que entrou no dia. Com o defeito, a
        reclamação já aparecia na véspera e a diferença dava zero.
      */
      const diferenca = hoje.entrantes - ontem.entrantes;

      if (diferenca === noDia) {
        ok(
          "a métrica diária conta a reclamação no dia em que entrou",
          `${alvo}: ${noDia} entrada(s); véspera ${ontem.entrantes}, dia ${hoje.entrantes}`
        );
      } else {
        falhar(
          "a métrica diária conta a reclamação no dia em que entrou",
          `${alvo} teve ${noDia} entrada(s), mas a métrica subiu ${diferenca} de ${diaAnterior} para ${alvo}`
        );
      }
    }
  } finally {
    await prisma.$disconnect();
  }

  console.log(
    falhas === 0
      ? "\n  Tudo no dia certo.\n"
      : `\n  ${falhas} ponto(s) em que alguma coisa cai no dia errado.\n`
  );

  process.exitCode = falhas === 0 ? 0 : 1;
}

main().catch((erro) => {
  console.error("\n  Erro:", erro);
  process.exitCode = 1;
});
