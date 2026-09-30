/**
 * Prova do relatório do ciclo (1.93): a aba vigente conta igual ao Índice,
 * e os encerramentos do NPS pela regra dos 30 dias não viram "trabalho".
 *
 *   npx tsx --env-file=.env scripts/check-relatorio.ts
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

import { fetchCases } from "@/lib/services/case.repository";
import { abaEm } from "@/lib/services/metricas.service";
import { retratoDoIndice } from "@/lib/models/indiceRA";
import { montarRelatorio } from "@/lib/services/relatorio.service";
import { cicloDe } from "@/lib/models/ciclo";
import { hojeNaOperacao } from "@/lib/services/reputation.service";
import type { NpsResponseView } from "@/lib/models/nps";

let falhas = 0;
function conferir(nome: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${nome.padEnd(64)} ${JSON.stringify(obtido)}${ok ? "" : `\n        esperado ${JSON.stringify(esperado)}`}`);
}

(async () => {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  const cases = await fetchCases(prisma);
  const hoje = hojeNaOperacao();

  console.log("\n— A aba vigente do relatório é a mesma conta do Índice —\n");
  for (const meses of [6, 12] as const) {
    const aba = abaEm(cases, hoje, meses, "vigente");
    const indice = retratoDoIndice(cases.filter((c) => c.protocol.startsWith("RA-")), meses === 6 ? "6m" : "12m", "vigente");
    conferir(`${meses} meses: recebidas, respondidas, avaliadas`, [aba.raw.received, aba.raw.answered, aba.raw.evaluated], [indice.resumo.received, indice.resumo.answered, indice.resumo.evaluated]);
    conferir(`${meses} meses: nota do consumidor e nota exata`, [aba.resumo.consumerScore, aba.resumo.raScoreExato.toFixed(5)], [indice.resumo.consumerScore, indice.resumo.raScoreExato.toFixed(5)]);
  }

  console.log("\n— Encerramento pela regra dos 30 dias não é tratativa —\n");
  const ciclo = cicloDe(hoje);
  const base = { respondedAt: `${ciclo.inicio}T12:00:00Z`, firstContactDueAt: `${ciclo.inicio}T15:00:00Z`, closedAt: `${ciclo.inicio}T09:00:00Z`, score: 3, attempts: [] } as unknown as NpsResponseView;
  const nps = [
    { ...base, id: "a", status: "[Encerrado] Sem Retorno" },
    { ...base, id: "b", status: "[Encerrado] Sem Retorno", firstContactAt: `${ciclo.inicio}T13:00:00Z`, attempts: [{ createdAt: `${ciclo.inicio}T13:00:00Z` }] },
    { ...base, id: "c", status: "[Encerrado] Resolvido", firstContactAt: `${ciclo.inicio}T13:00:00Z` },
    { ...base, id: "d", status: "[Encerrado] Sem tratativa" },
  ] as NpsResponseView[];
  const r = montarRelatorio({ cases: [], nps, google: [], ciclo, hoje });
  conferir("com tratativa: o Sem Retorno tentado e o Resolvido", r.nps.fechadosNoCiclo, 2);
  conferir("pela regra: o Sem Retorno sem contato nenhum", r.nps.fechadosPelaRegra, 1);

  await prisma.$disconnect();
  console.log(falhas === 0 ? "\n  O relatório conta pela mesma régua do Índice.\n" : `\n  ${falhas} ponto(s) fora.\n`);
  process.exit(falhas === 0 ? 0 : 1);
})();
