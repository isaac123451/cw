/**
 * A fila "Pedir avaliação" contra a base real — só leitura.
 *
 * Refaz fora da tela o que `/reclame-aqui/avaliacoes` mostra: quantas
 * reclamações estão na cadência hoje, quantas vêm depois, quantas caem no
 * período da nota, e a nota projetada se a fila avaliar com 10. Serve
 * para conferir a tela com números que não passaram pelo navegador.
 *
 *   npx tsx scripts/conferir-fila-avaliacao.ts
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { toCaseModel } from "../lib/services/case.mapper";
import { filaDeAvaliacao } from "../lib/models/cadencia";
import {
  emptySimulation,
  getRange,
  getRawCounts,
  inRange,
  ptBR,
  scoreFrom,
  simulate,
} from "../lib/services/reputation.service";
import { isSocial } from "../lib/services/case.service";

const url = process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!url) {
  console.error("\n  DATABASE_URL não definido.\n");
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

async function main() {

  const linhas = await prisma.case.findMany({
    include: {
      category: { select: { name: true } },
      subcategory: { select: { name: true } },
      owner: { select: { name: true } },
      team: { select: { name: true } },
      tags: { include: { tag: { select: { name: true } } } },
    },
  });

  const ra = linhas.map((r) => toCaseModel(r)).filter((c) => !isSocial(c));

  const fila = filaDeAvaliacao(ra);

  const range = getRange("6m", "vigente");
  const base = getRawCounts(ra.filter((c) => inRange(c, range.start, range.end)));
  const atual = scoreFrom(base).raScore;

  const noPeriodo = [...fila.hoje, ...fila.proximos].filter((x) => inRange(x.item, range.start, range.end)).length;
  const hojeNoPeriodo = fila.hoje.filter((x) => inRange(x.item, range.start, range.end)).length;

  const com = (n: number) => scoreFrom(simulate(base, { ...emptySimulation, ratings: { 10: n } })).raScore;

  const replica = ra.filter((c) => /aguardando nossa r[ée]plica/i.test(c.status)).length;

  console.log(`\n  Reclame Aqui na base: ${ra.length} · período da nota ${range.start} a ${range.end}`);
  console.log(`  Nota atual: ${ptBR(atual)}`);
  console.log(`  Fila hoje: ${fila.hoje.length} (${hojeNoPeriodo} no período) · próximos: ${fila.proximos.length}`);
  console.log(`  Se a fila no período (${noPeriodo}) avaliar com 10: ${ptBR(atual)} → ${ptBR(com(noPeriodo))}`);
  console.log(`  10 notas 10 valem: +${ptBR(com(Math.min(10, noPeriodo || 10)) - atual, 2)}`);
  console.log(`  Fora da fila por esperar a nossa réplica: ${replica}`);
  console.log(`  Lembrete mais antigo: ${fila.hoje[0]?.item.protocol} · ${fila.hoje[0]?.pedido.resumo}\n`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
