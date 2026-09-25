/**
 * O índice do Reclame Aqui sobre a base real — só leitura.
 *
 *   npx tsx scripts/medir-indice.ts
 *
 * Atual e prévia de 6 e 12 meses com a nota exata, o que falta para o
 * RA1000 e a evolução do mês — os mesmos números da tela Índice, para
 * conferir contra o HugMe.
 */
import "dotenv/config";

import { getPrisma } from "../lib/prisma";
import { fetchCases } from "../lib/services/case.repository";
import { isSocial } from "../lib/services/case.service";
import { hojeNaOperacao } from "../lib/services/reputation.service";
import { evolucaoDoMes, notaExata, retratoDoIndice } from "../lib/models/indiceRA";

async function main() {
  const prisma = getPrisma();
  if (!prisma) throw new Error("Sem banco.");
  const casos = (await fetchCases(prisma)).filter((c) => !isSocial(c));
  const hoje = hojeNaOperacao();

  console.log(`\n  ${casos.length} reclamações · hoje ${hoje}\n`);
  for (const periodo of ["6m", "12m"] as const) {
    for (const modo of ["vigente", "proximo"] as const) {
      const r = retratoDoIndice(casos, periodo, modo);
      const s = r.resumo;
      console.log(
        `  ${periodo} ${modo.padEnd(8)} ${r.inicio}→${r.fim}  ${notaExata(s.raScoreExato)} (${s.raScore})  IR ${s.responseIndex}% · MA ${s.consumerScore} · IS ${s.solutionIndex}% · IN ${s.wouldReturnIndex}% · ${s.evaluated} aval.${r.selo ? " · RA1000" : ""}` +
          `  falta: ${r.falta.respostas} resp., ${r.falta.avaliacoesMinimas} p/ mínimo, ${r.falta.avaliacoesIdeais.needed} ideais${r.falta.avaliacoesIdeais.reachable ? "" : " (não alcança)"}`
      );
    }
  }
  console.log(`\n  EVOLUÇÃO DO MÊS (6m)`);
  for (const d of evolucaoDoMes(casos, "6m", hoje)) {
    console.log(`  ${d.dia}  atual ${notaExata(d.atual)}  prévia ${notaExata(d.previa)}  +${d.recebidasNoDia} rec. · ${d.avaliadasNoDia} aval.`);
  }
  console.log();
  process.exit(0);
}

main();
