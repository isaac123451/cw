/**
 * A nota de um período conta só as avaliações feitas nele?
 *
 *   npm run check:nota-do-periodo
 *
 * O pedido (06/10/2026): "existem meses que está contando outros para a
 * nota daquele mês em específico, precisa somente ter as avaliações
 * daquele mês". A Análise, fora da janela oficial, contava as reclamações
 * abertas no período com as avaliações que vieram depois — abril/2026
 * levava 12 avaliações de outros meses e saía 8,4 onde as de abril davam
 * 6,9.
 *
 * Contra a base real, só leitura:
 *
 *  1. cada um dos 12 meses fechados, como período escolhido na Análise,
 *     conta exatamente as avaliações feitas nele — nem uma de outro mês;
 *  2. e dá a mesma nota que o mês tem nos Gráficos, no Índice e na
 *     extensão (`contasDoMes`);
 *  3. 30 dias: só as avaliações dos 30 dias;
 *  4. a janela oficial de 6 e 12 meses não mudou: continua a conta do
 *     portal (reclamações abertas nela, com a avaliação de cada uma).
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

      const doMes = ra.filter((c) => c.evaluated && !c.scoreDisregarded && diaDaAvaliacao(c) >= inicio && diaDaAvaliacao(c) <= fim).length;
      const periodo = reputacaoDoPeriodo(ra, "custom", inicio, fim);
      const coorte = getReputation(ra.filter((c) => inRange(c, inicio, fim)));
      if (coorte.evaluated !== periodo.evaluated || coorte.raScore !== periodo.raScore) misturavam += 1;

      conferir(`${chave}: avaliações contadas = as feitas no mês`, periodo.evaluated, doMes);
      conferir(`${chave}: a mesma nota dos Gráficos e do Índice`, periodo.raScoreExato, scoreFrom(contasDoMes(ra, chave)).raScoreExato);
    }

    console.log(`\n        a conta antiga dava outra nota ou outro total em ${misturavam} dos 12 meses\n`);

    const trinta = getRange("30d");
    const nos30 = ra.filter((c) => c.evaluated && !c.scoreDisregarded && diaDaAvaliacao(c) >= trinta.start && diaDaAvaliacao(c) <= trinta.end).length;
    conferir("30 dias: só as avaliações dos 30 dias", reputacaoDoPeriodo(ra, "30d", trinta.start, trinta.end).evaluated, nos30);

    for (const janela of ["6m", "12m"] as const) {
      const r = getRange(janela, "vigente");
      const portal = getReputation(ra.filter((c) => inRange(c, r.start, r.end)));
      conferir(`janela oficial ${janela}: a conta do portal, sem mudança`, reputacaoDoPeriodo(ra, janela, r.start, r.end).raScoreExato, portal.raScoreExato);
    }
  } finally {
    await prisma.$disconnect();
  }

  console.log(falhas === 0 ? "\n  Cada período conta só as próprias avaliações; a janela oficial segue a do portal.\n" : `\n  ${falhas} ponto(s) a corrigir.\n`);
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
