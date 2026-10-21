/**
 * Prova da contagem por ciclo (1.86): cada avaliação cai no ciclo do dia
 * em que veio, e a soma dos ciclos bate com as avaliações datadas.
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { fetchCases, carimboDaAvaliacao } from "@/lib/services/case.repository";
import { casosDoNumero, numerosPorCiclo, porCicloNoMes } from "@/lib/models/porCiclo";
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
  const noPeriodo = (d?: string | null) => Boolean(d) && diaNaOperacao(d!) >= inicio && diaNaOperacao(d!) <= hoje;
  /* Movimento (só informativo): a avaliação no ciclo do dia em que veio. */
  const datadas = casos.filter((c) => c.evaluated && noPeriodo(c.evaluatedAt)).length;
  ok(linhas.reduce((s, l) => s + l.movimento.avaliacoes, 0) === datadas, `movimento: avaliações nos ${n} ciclos = ${datadas} feitas no período`);
  /* Coorte (entra na nota): a avaliação no ciclo em que a reclamação chegou (21/10/2026). */
  const novas = casos.filter((c) => noPeriodo(c.createdAt));
  ok(linhas.reduce((s, l) => s + l.reclamacoes.novas, 0) === novas.length, `novas nos ${n} ciclos: ${novas.length}`);
  const daCoorte = novas.filter((c) => c.evaluated).length;
  ok(linhas.reduce((s, l) => s + l.reclamacoes.avaliadas, 0) === daCoorte, `avaliadas pela reclamação: ${daCoorte} (das que chegaram no período, mesmo avaliadas depois)`);
  ok(linhas.every((l) => l.reclamacoes.respondidas + l.reclamacoes.semResposta === l.reclamacoes.novas), "respondidas + sem resposta = novas, em cada ciclo");
  /* O mês soma os ciclos dele. */
  for (const m of porCicloNoMes(casos, hoje, 3)) {
    const soma = (k: "novas" | "avaliadas") => m.ciclos.reduce((s, l) => s + l.reclamacoes[k], 0);
    ok(soma("novas") === m.reclamacoes.novas && soma("avaliadas") === m.reclamacoes.avaliadas, `${m.mes}: o total do mês é a soma dos ${m.ciclos.length} ciclos (${m.reclamacoes.novas} novas, ${m.reclamacoes.avaliadas} avaliadas)`);
    ok(m.ciclos.reduce((s, l) => s + l.movimento.avaliacoes, 0) === m.movimento.avaliacoes, `${m.mes}: avaliações feitas no mês = soma dos ciclos (${m.movimento.avaliacoes})`);
    const de = casosDoNumero(casos, `${m.mes}-01`, hoje, "avaliadas").filter((c) => diaNaOperacao(c.createdAt).startsWith(m.mes)).length;
    ok(de === m.reclamacoes.avaliadas, `${m.mes}: a mini janela mostra os mesmos ${de} casos do número`);
  }
  for (const l of linhas) console.log(`   ${l.ciclo.rotulo.padEnd(11)} novas ${l.reclamacoes.novas}  avaliadas ${l.reclamacoes.avaliadas}  nota ${l.reclamacoes.notaMedia?.toFixed(2) ?? "—"}  |  feitas no ciclo ${l.movimento.avaliacoes}`);
  await prisma.$disconnect();
  if (falhas) process.exit(1);
})();
