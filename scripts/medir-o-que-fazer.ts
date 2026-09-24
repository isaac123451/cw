/**
 * "O que fazer em cada reclamação" sobre a base real — só leitura.
 *
 *   npx tsx scripts/medir-o-que-fazer.ts
 *
 * Roda `oQueFazer` em todas as reclamações do Reclame Aqui, com os
 * canais que a lista traz, e conta as frases. Serve para ver que cada
 * passo diz alguma coisa e que os canais chegam ("tente por e-mail").
 */
import "dotenv/config";

import { getPrisma } from "../lib/prisma";
import { fetchCases } from "../lib/services/case.repository";
import { isSocial } from "../lib/services/case.service";
import { oQueFazer } from "../lib/models/oQueFazer";
import { proximoPasso } from "../lib/models/trilha";

async function main() {
  const prisma = getPrisma();
  if (!prisma) throw new Error("Sem banco.");

  const t0 = performance.now();
  const casos = (await fetchCases(prisma)).filter((c) => !isSocial(c));
  const ms = Math.round(performance.now() - t0);

  const agora = new Date();
  const frases = new Map<string, number>();
  let semFrase = 0;
  let comPasso = 0;
  let comCanais = 0;

  for (const c of casos) {
    const passo = proximoPasso(c, { agora });
    if (!passo) continue;
    comPasso += 1;
    if (c.canaisSemResposta?.length) comCanais += 1;
    const conselho = oQueFazer(c, passo, { agora, canaisSemResposta: c.canaisSemResposta });
    if (!conselho) {
      semFrase += 1;
      continue;
    }
    const chave = `${passo.id.padEnd(16)} ${conselho.urgente ? "!" : " "} ${conselho.frase.replace(/\d+/g, "N").replace(/\d\d\/\d\d/g, "dd/mm")}`;
    frases.set(chave, (frases.get(chave) ?? 0) + 1);
  }

  console.log(`\n  ${casos.length} reclamações do RA (lista em ${ms} ms) · ${comPasso} com passo · ${semFrase} sem frase · ${comCanais} com canais de tentativa\n`);
  for (const [f, n] of [...frases].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${f}`);
  console.log();
  process.exit(semFrase > 0 ? 1 : 0);
}

main();
