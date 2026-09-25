/**
 * O índice como no HugMe — a nota exata, o dia a dia e o que falta.
 *
 *   npm run check:indice
 *
 * Sem banco. Contagens montadas à mão para a fórmula oficial dar um
 * número conhecido, e reclamações de mentira para o "como estava no dia".
 */
import type { Case } from "../lib/models/case";
import { comoEstavaNoDia, evolucaoDoMes, notaExata } from "../lib/models/indiceRA";
import { scoreFrom } from "../lib/services/reputation.service";

let falhas = 0;
function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(62)} ${String(JSON.stringify(obtido)).slice(0, 40)}`);
  if (!ok) console.log(`        ${"esperado".padEnd(62)} ${String(JSON.stringify(esperado)).slice(0, 40)}`);
}

console.log("\n  ÍNDICE — nota exata, dia a dia e o que falta\n");

/* (95×2 + 80×3 + 90×3 + 75×2) / 100 = 8,5 exato. */
const redondo = scoreFrom({ received: 100, answered: 95, evaluated: 60, scoreSum: 480, resolved: 54, wouldReturn: 45, responseMinutesSum: 0, responseSamples: 0 });
conferir("fórmula oficial com contas redondas", notaExata(redondo.raScoreExato), "8,50000");

/* 2/3 de resposta: o índice arredondado (66,7%) desloca a quinta casa; a exata não. */
const quebrado = scoreFrom({ received: 3, answered: 2, evaluated: 3, scoreSum: 25, resolved: 2, wouldReturn: 2, responseMinutesSum: 0, responseSamples: 0 });
const esperado = ((2 / 3) * 10 * 0.2 + (25 / 3) * 0.3 + (2 / 3) * 10 * 0.3 + (2 / 3) * 10 * 0.2);
conferir("a exata não arredonda no meio", notaExata(quebrado.raScoreExato), notaExata(esperado));
conferir("a de uma casa sai da exata", quebrado.raScore, Math.round(esperado * 10) / 10);

const base = {
  id: "c1",
  protocol: "RA-1",
  source: "Reclame Aqui",
  title: "t",
  customer: "Ana",
  company: "",
  status: "Resolvido",
  priority: "Normal",
  createdAt: "2026-09-02",
  publicResponse: "Olá",
  publicResponseAt: "2026-09-05T15:00:00Z",
  respondida: true,
  evaluated: true,
  evaluatedAt: "2026-09-10T15:00:00Z",
  score: 10,
  resolved: true,
  wouldDoBusiness: true,
} as unknown as Case;

conferir("antes da resposta: nem respondida nem avaliada", [comoEstavaNoDia(base, "2026-09-04").respondida, comoEstavaNoDia(base, "2026-09-04").evaluated], [false, false]);
conferir("respondida, ainda sem avaliação", [comoEstavaNoDia(base, "2026-09-06").respondida, comoEstavaNoDia(base, "2026-09-06").evaluated], [true, false]);
conferir("depois da avaliação: igual ao de hoje", comoEstavaNoDia(base, "2026-09-11") === base, true);

/* Avaliação ruim: antes dela, só a resposta conta (nota 10); depois, a nota cai. */
const ruim = { ...base, score: 3, resolved: false, wouldDoBusiness: false } as Case;
const dias = evolucaoDoMes([ruim], "6m", "2026-09-12");
conferir("um ponto por dia, do dia 1 até hoje", dias.length, 12);
conferir("a prévia cai no dia da avaliação ruim", [notaExata(dias[8].previa), dias[9].previa < dias[8].previa], ["10,00000", true]);
conferir("reclamação nova conta no dia em que entrou", dias[1].recebidasNoDia, 1);

console.log(`\n  ${falhas === 0 ? "Tudo certo." : `${falhas} falha(s).`}\n`);
process.exit(falhas === 0 ? 0 : 1);
