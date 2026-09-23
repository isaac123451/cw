/**
 * A busca pelo nome acha a pessoa certa? Medido na base real.
 *
 *   npx tsx scripts/medir-identificacao.ts
 *
 * Só leitura. O WhatsApp mostra o nome do contato; quando o telefone
 * não acha ninguém, o painel sugere candidatos por esse nome. Aqui cada
 * cliente do NPS com nome e cada reclamação é procurado pelo próprio
 * nome, e conta-se quantas vezes ele aparece entre os candidatos — e
 * em primeiro.
 */
import "dotenv/config";

import { getPrisma } from "../lib/prisma";
import { candidatosPorNome, palavrasQueDistinguem } from "../lib/services/contatoConhecido.service";

async function main() {
  const prisma = getPrisma();
  if (!prisma) throw new Error("Sem banco.");

  const nps = await prisma.npsResponse.findMany({
    where: { customerName: { not: null } },
    select: { id: true, email: true, customerName: true },
    orderBy: { respondedAt: "desc" },
    take: 120,
  });
  const casos = await prisma.case.findMany({ select: { protocol: true, customer: true }, orderBy: { createdAt: "desc" }, take: 120 });

  let npsProcurados = 0, npsAchados = 0, npsPrimeiro = 0, npsSemPalavra = 0;
  for (const r of nps) {
    if (!r.customerName || palavrasQueDistinguem(r.customerName).length === 0) { npsSemPalavra += 1; continue; }
    npsProcurados += 1;
    const lista = await candidatosPorNome(prisma, r.customerName);
    const i = lista.findIndex((c) => c.tipo === "nps" && c.detalhe.includes(r.email ?? "\u0000"));
    if (i >= 0) npsAchados += 1;
    if (i === 0) npsPrimeiro += 1;
  }

  let casosProcurados = 0, casosAchados = 0, casosPrimeiro = 0, casosSemPalavra = 0, ruido = 0;
  for (const c of casos) {
    if (palavrasQueDistinguem(c.customer).length === 0) { casosSemPalavra += 1; continue; }
    casosProcurados += 1;
    const lista = await candidatosPorNome(prisma, c.customer);
    const i = lista.findIndex((x) => x.tipo === "caso" && x.ref === c.protocol);
    if (i >= 0) casosAchados += 1;
    if (i === 0) casosPrimeiro += 1;
    ruido += lista.length;
  }

  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");
  console.log(`\n  IDENTIFICAÇÃO PELO NOME — base real\n`);
  console.log(`  NPS com nome: ${nps.length} (sem palavra que distinga: ${npsSemPalavra})`);
  console.log(`    achado entre os candidatos: ${npsAchados} de ${npsProcurados} (${pct(npsAchados, npsProcurados)}), em 1º: ${npsPrimeiro} (${pct(npsPrimeiro, npsProcurados)})`);
  console.log(`  Reclamações: ${casos.length} (sem palavra que distinga: ${casosSemPalavra})`);
  console.log(`    achada entre os candidatos: ${casosAchados} de ${casosProcurados} (${pct(casosAchados, casosProcurados)}), em 1º: ${casosPrimeiro} (${pct(casosPrimeiro, casosProcurados)})`);
  console.log(`    candidatos por busca, em média: ${(ruido / Math.max(1, casosProcurados)).toFixed(1)}\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => getPrisma()?.$disconnect());
