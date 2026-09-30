/**
 * Prova da contagem por ciclo (1.86): cada avaliação cai no ciclo do dia
 * em que veio, e a soma dos ciclos bate com as avaliações datadas.
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { fetchCases, carimboDaAvaliacao } from "@/lib/services/case.repository";
import { numerosPorCiclo } from "@/lib/models/porCiclo";
import { ciclosAte } from "@/lib/models/ciclo";
import { diaNaOperacao, hojeNaOperacao } from "@/lib/services/reputation.service";

let falhas = 0;
const ok = (cond: boolean, texto: string) => { console.log(`${cond ? "ok " : "ERRO"} ${texto}`); if (!cond) falhas += 1; };

/* O carimbo: só a avaliação que chega agora, sem data, ganha hoje. */
ok(carimboDaAvaliacao({ evaluated: false, evaluatedAt: null }, { evaluated: true }, "2026-09-29")?.toISOString() === "2026-09-29T00:00:00.000Z", "avaliação nova sem data ganha hoje");
ok(carimboDaAvaliacao({ evaluated: true, evaluatedAt: null }, { evaluated: true }, "2026-09-29") === undefined, "avaliação antiga sem data não é carimbada");
ok(carimboDaAvaliacao(null, { evaluated: true, evaluatedAt: new Date() }, "2026-09-29") === undefined, "data do portal fica");
ok(carimboDaAvaliacao(null, { evaluated: false }, "2026-09-29") === undefined, "não avaliada não ganha data");
ok(diaNaOperacao(new Date("2026-09-29T00:00:00Z")) === "2026-09-29", "carimbo lido no dia certo (meia-noite UTC é data)");

(async () => {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  const casos = (await fetchCases(prisma)).filter((c) => c.protocol.startsWith("RA-"));
  const hoje = hojeNaOperacao();
  const n = 8;
  const linhas = numerosPorCiclo(casos, hoje, n);
  const ciclos = ciclosAte(hoje, n);
  const inicio = ciclos.at(-1)!.inicio;
  const esperadas = casos.filter((c) => c.evaluated && c.evaluatedAt && diaNaOperacao(c.evaluatedAt) >= inicio && diaNaOperacao(c.evaluatedAt) <= hoje).length;
  const somadas = linhas.reduce((s, l) => s + l.avaliadas, 0);
  ok(somadas === esperadas, `avaliações nos ${n} ciclos: ${somadas} = ${esperadas} datadas no período`);
  const novas = casos.filter((c) => diaNaOperacao(c.createdAt) >= inicio && diaNaOperacao(c.createdAt) <= hoje).length;
  ok(linhas.reduce((s, l) => s + l.novas, 0) === novas, `novas nos ${n} ciclos: ${novas}`);
  for (const l of linhas) console.log(`   ${l.ciclo.rotulo.padEnd(11)} novas ${l.novas}  respondidas ${l.respondidas}  avaliações ${l.avaliadas}  nota ${l.notaMedia?.toFixed(2) ?? "—"}`);
  await prisma.$disconnect();
  if (falhas) process.exit(1);
})();
