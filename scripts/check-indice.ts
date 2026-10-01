/**
 * O índice como no HugMe — a nota exata, o dia a dia e o que falta.
 *
 *   npm run check:indice
 *
 * Sem banco. Contagens montadas à mão para a fórmula oficial dar um
 * número conhecido, e reclamações de mentira para o "como estava no dia".
 */
import type { Case } from "../lib/models/case";
import { ancoraVizinha, comoEstavaNoDia, estadoEm, evolucaoDoIndice, notaExata, periodosDaEvolucao } from "../lib/models/indiceRA";
import { getMonthlyIndices, getTimeSeries } from "../lib/services/charts.service";
import { getReputationTrend, scoreFrom } from "../lib/services/reputation.service";

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
conferir("fórmula oficial com contas redondas", notaExata(redondo.raScoreExato), "8,5000");

/* 2/3 de resposta: o índice arredondado (66,7%) desloca a quarta casa; a exata não. (Quatro casas desde a 1.110, pedido de 30/09.) */
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

const meio = estadoEm(base, "2026-09-12", "2026-09-04");
conferir("resposta e avaliação separadas: respondida, sem avaliação", [meio.respondida, meio.evaluated], [true, false]);

console.log("\n  EVOLUÇÃO — por dia, ciclo e mês (1.118)\n");

/* Avaliação ruim: antes dela, só a resposta conta (nota 10); depois, a nota cai. */
const ruim = { ...base, score: 3, resolved: false, wouldDoBusiness: false } as Case;
const dias = evolucaoDoIndice([ruim], "6m", "dia", "2026-09-12", "2026-09-12");
const dia = (d: string) => dias.find((p) => p.chave === d)!;
conferir("dia: os 31 dias corridos até a âncora", [dias.length, dias[0].chave, dias[30].chave], [31, "2026-08-13", "2026-09-12"]);
conferir("o último dia é o em curso", dias[30].emCurso, true);
conferir("a prévia cai no dia da avaliação ruim", [notaExata(dia("2026-09-09").previa), dia("2026-09-10").previa < dia("2026-09-09").previa], ["10,0000", true]);
conferir("e é a avaliação que derruba (efeito negativo no dia)", [dia("2026-09-10").avaliadas, dia("2026-09-10").efeitoDasAvaliacoes < 0], [1, true]);
conferir("a resposta sobe a nota no dia em que saiu", [dia("2026-09-05").respondidas, dia("2026-09-05").efeitoDasRespostas > 0], [1, true]);
conferir("reclamação nova conta no dia em que entrou", dia("2026-09-02").recebidas, 1);
conferir(
  "a variação é o fim do período menos o do anterior",
  dias.slice(1).every((p, i) => Math.abs(p.variacaoPrevia - (p.previa - dias[i].previa)) < 1e-9 && Math.abs(p.variacaoAtual - (p.atual - dias[i].atual)) < 1e-9),
  true
);

/*
  O pedido de 01/10: "as avaliações ... precisam entrar quando foram
  avaliadas". Reclamação de agosto avaliada em 15/09: a avaliação é de
  setembro — no ponto de setembro, não no de agosto.
*/
const antiga = {
  ...base,
  id: "c2",
  protocol: "RA-2",
  createdAt: "2026-08-20",
  publicResponseAt: "2026-08-21T15:00:00Z",
  evaluatedAt: "2026-09-15T15:00:00Z",
  score: 2,
  resolved: false,
  wouldDoBusiness: false,
} as unknown as Case;
const meses = evolucaoDoIndice([antiga], "6m", "mes", "2026-09-20", "2026-09-20");
const mes = (m: string) => meses.find((p) => p.chave === m)!;
conferir("mês: 12 meses até a âncora", [meses.length, meses[0].rotulo, meses[11].rotulo], [12, "out/25", "set/26"]);
conferir("a avaliação feita em setembro conta em setembro", [mes("2026-08").avaliadas, mes("2026-09").avaliadas], [0, 1]);
conferir("e a reclamação, no mês em que entrou", [mes("2026-08").recebidas, mes("2026-09").recebidas], [1, 0]);
/* A nota do mês (1.121): agosto só com a resposta (a reclamação chegou nele); setembro com a avaliação nota 2 feita nele. */
conferir("a nota do mês: agosto pela resposta, setembro pela avaliação", [mes("2026-08").doMes?.nota !== null, (mes("2026-09").doMes?.nota ?? 99) < (mes("2026-08").doMes?.nota ?? 0)], [true, true]);
const setembro = evolucaoDoIndice([antiga], "6m", "dia", "2026-09-20", "2026-09-20");
const dia15 = setembro.find((p) => p.chave === "2026-09-15")!;
conferir("no dia da avaliação, a nota atual muda (mês fechado, avaliação nova)", [dia15.avaliadas, dia15.variacaoAtual < 0], [1, true]);

const ciclos = periodosDaEvolucao("ciclo", "2026-09-12", "2026-09-12");
conferir("ciclo: 10 ciclos, o último em curso até hoje", [ciclos.length, ciclos[0].rotulo, ciclos[9].rotulo, ciclos[9].fim, ciclos[9].emCurso], [10, "15 a 21/07", "8 a 14/09", "2026-09-12", true]);
conferir("ciclo anterior: a tela de antes termina onde esta começa", periodosDaEvolucao("ciclo", ancoraVizinha("ciclo", "2026-09-12", -1), "2026-09-12")[9].rotulo, "8 a 14/07");
conferir("dia anterior: 31 dias antes", ancoraVizinha("dia", "2026-09-12", -1), "2026-08-12");
conferir("mês anterior: a tela termina no mês antes da primeira", ancoraVizinha("mes", "2026-09-20", -1), "2025-09-30");

console.log("\n  GRÁFICOS — a avaliação no mês em que foi feita (1.118)\n");

const janela = { start: "2026-08-01", end: "2026-09-30" };
const porMes = getMonthlyIndices([antiga], "custom", janela);
conferir("índices por mês: avaliada em setembro, conta em setembro", porMes.map((m) => [m.key, m.received, m.evaluated]), [["2026-08", 1, 0], ["2026-09", 0, 1]]);
const movimento = getTimeSeries([antiga], { start: "2026-09-01", end: "2026-09-30" });
conferir("movimento: a avaliação no dia em que foi feita", movimento.points.filter((p) => p.evaluated).map((p) => p.date), ["2026-09-15"]);
const movimentoAgosto = getTimeSeries([antiga], { start: "2026-08-01", end: "2026-08-31" });
conferir("e a resposta no dia em que saiu", movimentoAgosto.points.filter((p) => p.answered).map((p) => p.date), ["2026-08-21"]);
conferir("tendência do Analytics: setembro aparece, pela avaliação", getReputationTrend([antiga]).map((m) => [m.label, m.received]), [["ago/26", 1], ["set/26", 0]]);

console.log(`\n  ${falhas === 0 ? "Tudo certo." : `${falhas} falha(s).`}\n`);
process.exit(falhas === 0 ? 0 : 1);
