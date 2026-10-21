/**
 * A nota de um período conta as reclamações abertas nele?
 *
 *   npm run check:nota-do-periodo
 *
 * O pedido (21/10/2026, troca a regra de 06/10): "recebi uma reclamação não
 * resolvida, está contabilizando para o mês da avaliação e não pro mês que
 * a reclamação foi criada". Cada período conta as reclamações abertas nele,
 * com a avaliação de cada uma, mesmo feita depois — a mesma regra do
 * portal. As avaliações feitas no período aparecem à parte, só para saber.
 *
 * Contra a base real, só leitura:
 *
 *  1. cada um dos 12 meses fechados, como período escolhido na Análise,
 *     conta as avaliações das reclamações abertas nele;
 *  2. e dá a mesma nota que o mês tem nos Gráficos, no Índice e na
 *     extensão (`contasDoMes`);
 *  3. 30 dias: as avaliações das reclamações abertas nos 30 dias;
 *  4. a janela oficial de 6 e 12 meses não mudou: a conta do portal.
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { fetchCases } from "../lib/services/case.repository";
import {
  contasDoMes,
  diaDaAvaliacao,
  getRange,
  getReputation,
  hojeNaOperacao,
  inRange,
  reputacaoDoPeriodo,
  scoreFrom,
} from "../lib/services/reputation.service";

let falhas = 0;

function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(66)} ${JSON.stringify(obtido)?.slice(0, 40)}`);
  if (!ok) console.log(`        ${"esperado".padEnd(66)} ${JSON.stringify(esperado)?.slice(0, 40)}`);
}

async function main() {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) {
    console.log("\n  Sem DATABASE_URL no .env.\n");
    process.exit(1);
  }
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

  try {
    const ra = (await fetchCases(prisma)).filter((c) => c.source === "Reclame Aqui");

    console.log("\n  NOTA DO PERÍODO — só as avaliações feitas nele\n");

    const [ano, mes] = hojeNaOperacao().split("-").map(Number);
    let misturavam = 0;

    for (let k = 12; k >= 1; k -= 1) {
      const inicio = new Date(Date.UTC(ano, mes - 1 - k, 1)).toISOString().slice(0, 10);
      const fim = new Date(Date.UTC(ano, mes - k, 0)).toISOString().slice(0, 10);
      const chave = inicio.slice(0, 7);

      /* A regra de 06/10 (pela data da avaliação) — só para mostrar quanto mudou. */
      const feitasNoMes = ra.filter((c) => c.evaluated && !c.scoreDisregarded && diaDaAvaliacao(c) >= inicio && diaDaAvaliacao(c) <= fim).length;
      const periodo = reputacaoDoPeriodo(ra, "custom", inicio, fim);
      const coorte = getReputation(ra.filter((c) => inRange(c, inicio, fim)));
      if (feitasNoMes !== periodo.evaluated) misturavam += 1;

      /* 21/10/2026: "está contabilizando para o mês da avaliação e não pro mês que a reclamação foi criada". */
      conferir(`${chave}: avaliações = as das reclamações abertas no mês`, [periodo.evaluated, periodo.raScoreExato], [coorte.evaluated, coorte.raScoreExato]);
      conferir(`${chave}: a mesma nota dos Gráficos e do Índice`, periodo.raScoreExato, scoreFrom(contasDoMes(ra, chave)).raScoreExato);
    }

    console.log(`\n        pela data da avaliação (regra de 06/10), o total de avaliações mudava em ${misturavam} dos 12 meses\n`);

    const trinta = getRange("30d");
    const nos30 = getReputation(ra.filter((c) => inRange(c, trinta.start, trinta.end))).evaluated;
    conferir("30 dias: as avaliações das reclamações abertas nos 30 dias", reputacaoDoPeriodo(ra, "30d", trinta.start, trinta.end).evaluated, nos30);

    for (const janela of ["6m", "12m"] as const) {
      const r = getRange(janela, "vigente");
      const portal = getReputation(ra.filter((c) => inRange(c, r.start, r.end)));
      conferir(`janela oficial ${janela}: a conta do portal, sem mudança`, reputacaoDoPeriodo(ra, janela, r.start, r.end).raScoreExato, portal.raScoreExato);
    }
  } finally {
    await prisma.$disconnect();
  }

  console.log(falhas === 0 ? "\n  Cada período conta as próprias reclamações, com a avaliação de cada uma; a janela oficial segue a do portal.\n" : `\n  ${falhas} ponto(s) a corrigir.\n`);
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
