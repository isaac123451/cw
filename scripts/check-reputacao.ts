/**
 * Prova a nota e os tempos contra a base real.
 *
 *   npm run check:reputacao
 *
 * A nota do Reclame Aqui é o motivo de o produto existir, e até aqui
 * nenhum script olhava para ela. Duas coisas são conferidas:
 *
 * 1. **A ida e volta do tempo decorrido é fiel.** O modelo guarda o
 *    tempo como texto ("5 dias e 18 horas") e o banco como minutos; a
 *    gravação passa por `formatElapsed` e a leitura por
 *    `parseElapsedText`. Um formatador que arredondasse para dias
 *    inteiros jogaria as horas fora **entre a leitura e o banco** — foi
 *    exatamente o que acontecia, e custava 4% na mediana do tempo de
 *    primeira resposta.
 * 2. **A nota fecha.** Os quatro indicadores com seus pesos precisam
 *    somar o que `raScore` devolve. Se a memória de cálculo e o número
 *    divergirem, a tela de auditoria vira ficção.
 *
 * No fim imprime o retrato atual — é a resposta rápida para "como
 * estamos" sem abrir o navegador.
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { toCaseModel } from "../lib/services/case.mapper";
import { parseElapsedText } from "../lib/services/case.mapper";

import {
  displayBand,
  formatElapsed,
  getRange,
  getReputation,
  hasRA1000,
  inRange,
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

function conferir(
  campo: string,
  obtido: unknown,
  esperado: unknown
) {

  const ok =
    JSON.stringify(obtido) === JSON.stringify(esperado);

  if (!ok) falhas += 1;

  console.log(
    `${ok ? "  ok  " : "FALHA "} ${campo.padEnd(50)} ${JSON.stringify(obtido)}`
  );

  if (!ok) {
    console.log(
      `${" ".repeat(7)}${"esperado".padEnd(50)} ${JSON.stringify(esperado)}`
    );
  }
}

async function main() {

  console.log("\n  NOTA E TEMPOS\n");

  /* ----------------------------------------------------------
     1. A ida e volta do tempo decorrido.
  ---------------------------------------------------------- */

  /**
   * Os valores cobrem cada faixa que `formatElapsed` trata de forma
   * diferente: minutos, horas, dias redondos e dias com horas — mais o
   * caso que quebrava, acima de 48 h com resto.
   */
  const minutos = [
    7, 45, 59, 60, 90, 1439, 1440, 1500, 2880, 3000,
    8283, 20000, 246066,
  ];

  const perdidos = minutos.filter((m) => {

    const volta = parseElapsedText(formatElapsed(m));

    // Fiel até a hora: o formato não carrega o minuto acima de 1 h.
    const tolerancia = m < 60 ? 0 : 59;

    return (
      volta === null ||
      Math.abs(volta - m) > tolerancia
    );
  });

  conferir(
    "1. formatar e reler não perde mais que a hora",
    perdidos,
    []
  );

  /**
   * O caso que motivou o conserto, nomeado.
   *
   * 8283 minutos são 5 dias, 18 h e 3 min. O formatador antigo da carga
   * escrevia "6 dias" — e a releitura devolvia 8640, quase seis horas a
   * mais do que aconteceu.
   */
  conferir(
    "1. 5 dias e 18 horas volta como 5 dias e 18 horas",
    parseElapsedText(formatElapsed(8283)),
    8280
  );

  /* ----------------------------------------------------------
     2. A base, e se ela sobreviveu à ida e volta.
  ---------------------------------------------------------- */

  const linhas = await prisma.case.findMany({
    include: {
      category: { select: { name: true } },
      subcategory: { select: { name: true } },
      owner: { select: { name: true } },
      team: { select: { name: true } },
      tags: { include: { tag: { select: { name: true } } } },
    },
  });

  const casos = linhas.map((r) => toCaseModel(r));

  conferir(
    "2. toda reclamação tem data de publicação",
    casos.filter((c) => !c.createdAt).length,
    0
  );

  /* ----------------------------------------------------------
     3. A nota fecha com a própria memória de cálculo.
  ---------------------------------------------------------- */

  const seis = getRange("6m", "vigente");

  const janela = casos.filter((c) =>
    inRange(c, seis.start, seis.end)
  );

  const rep = getReputation(janela);

  /**
   * A soma dos componentes tem de dar a nota.
   *
   * A tela de auditoria mostra os quatro pesos abertos; se eles não
   * somarem o número exibido, ela está contando uma história que não é
   * a do cálculo.
   */
  const soma = rep.breakdown.reduce(
    (total, item) => total + item.contribution,
    0
  );

  conferir(
    "3. os componentes somam a nota",
    Math.abs(soma - rep.raScore) < 0.05,
    true
  );

  conferir(
    "3. a nota está entre 0 e 10",
    rep.raScore >= 0 && rep.raScore <= 10,
    true
  );

  /* ----------------------------------------------------------
     O retrato.
  ---------------------------------------------------------- */

  console.log(`\n  ${casos.length} reclamações na base\n`);

  for (const nome of ["6m", "12m"] as const) {

    const faixa = getRange(nome, "vigente");

    const recorte = casos.filter((c) =>
      inRange(c, faixa.start, faixa.end)
    );

    const r = getReputation(recorte);

    console.log(
      `  ${nome.padEnd(4)} ${faixa.start} a ${faixa.end} · ${String(recorte.length).padStart(3)} reclamações`
    );

    console.log(
      `       nota ${r.raScore.toFixed(2)} (${displayBand(r).label}) · RA1000: ${hasRA1000(r) ? "sim" : "não"}`
    );

    console.log(
      `       resposta ${r.responseIndex.toFixed(1)}% · solução ${r.solutionIndex.toFixed(1)}% · consumidor ${r.consumerScore.toFixed(2)} · voltaria ${r.wouldReturnIndex.toFixed(1)}%`
    );

    console.log(
      `       primeira resposta em ${formatElapsed(r.responseMinutes)}, na média\n`
    );
  }
}

main()
  .catch((erro) => {
    falhas += 1;
    console.error("\n  ERRO:", erro);
  })
  .finally(async () => {

    await prisma.$disconnect();

    console.log(
      falhas === 0
        ? "  A nota fecha, e o tempo chega ao banco como saiu da planilha.\n"
        : `\n  ${falhas} falha(s).\n`
    );

    process.exit(falhas === 0 ? 0 : 1);
  });
