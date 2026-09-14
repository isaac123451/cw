/**
 * Prova os ciclos do documento e as métricas que passaram a ser calculadas.
 *
 *   npm run check:ciclos
 *
 * Os ciclos são 1–7, 8–14, 15–21, 22–28 e 29 até o fim do mês — com
 * fevereiro de 28 dias sem quinto ciclo. "Resolvidas no ciclo" conta as
 * avaliadas como resolvidas dentro da janela; "ciclos com selo" conta os
 * ciclos seguidos com o RA1000 na aba de 6 meses, e o selo pede 50
 * avaliações. Sem banco: casos montados aqui.
 */
import type { Case } from "../lib/models/case";
import { cicloAnterior, cicloDe, cicloPorId, ciclosAte } from "../lib/models/ciclo";
import { medirDia } from "../lib/services/metricas.service";
import { formatElapsed, parseElapsed } from "../lib/services/reputation.service";
import { montarRelatorio, textoDoRelatorio } from "../lib/services/relatorio.service";

let falhas = 0;

function confere(nome: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`${ok ? "ok  " : "FALHOU"}  ${nome}${ok ? "" : `\n        esperado ${JSON.stringify(esperado)}, veio ${JSON.stringify(obtido)}`}`);
}

console.log("\n— Os ciclos do documento —");
confere("1º de setembro: ciclo 1", cicloDe("2026-09-01").rotulo, "1 a 7/09");
confere("dia 7 ainda é o ciclo 1", cicloDe("2026-09-07").id, "2026-09-c1");
confere("dia 8 abre o ciclo 2", cicloDe("2026-09-08").rotulo, "8 a 14/09");
confere("dia 28: ciclo 4", cicloDe("2026-09-28").rotulo, "22 a 28/09");
confere("setembro fecha em 30", cicloDe("2026-09-29").rotulo, "29 a 30/09");
confere("outubro fecha em 31", cicloDe("2026-10-31").rotulo, "29 a 31/10");
confere("fevereiro de 28 dias não tem ciclo 5", cicloPorId("2027-02-c5"), null);
confere("bissexto tem: 29 a 29/02", cicloPorId("2028-02-c5")?.rotulo, "29 a 29/02");
confere("antes do 1º de março de 2027 vem 22 a 28/02", cicloAnterior(cicloDe("2027-03-03")).rotulo, "22 a 28/02");
confere("antes de janeiro vem dezembro", cicloAnterior(cicloDe("2027-01-02")).id, "2026-12-c5");
confere("os três últimos até 10/09", ciclosAte("2026-09-10", 3).map((c) => c.rotulo), ["8 a 14/09", "1 a 7/09", "29 a 31/08"]);
confere("id que não é de ciclo", cicloPorId("2026-13-c1"), null);

console.log("\n— O tempo de resposta que a nota lê —");
confere("\"3 dias e 20 horas\" volta inteiro", parseElapsed("3 dias e 20 horas"), 3 * 1440 + 20 * 60);
confere("\"8 horas\"", parseElapsed(formatElapsed(480)), 480);

console.log("\n— As métricas do dia —");

let seq = 0;
function caso(campos: Partial<Case> & { createdAt: string }): Case {
  seq += 1;
  return {
    id: `c${seq}`,
    protocol: `RA-${seq}`,
    source: "Reclame Aqui",
    status: "Resolvido",
    title: "teste",
    customer: "Cliente",
    churnRisk: false,
    respondida: false,
    evaluated: false,
    resolved: false,
    wouldDoBusiness: false,
    ...campos,
  } as unknown as Case;
}

/** Uma reclamação respondida em 1 dia e avaliada com 10, resolvida. */
const boa = (criada: string, avaliada: string) =>
  caso({
    createdAt: criada,
    respondida: true,
    publicResponseAt: `${criada.slice(0, 8)}${String(Math.min(28, Number(criada.slice(8, 10)) + 1)).padStart(2, "0")}T12:00:00.000Z`,
    responseTime: "1 dia",
    evaluated: true,
    evaluatedAt: avaliada,
    score: 10,
    resolved: true,
    wouldDoBusiness: true,
  });

/* 60 boas espalhadas de abril a agosto: selo na aba de 6 meses. */
const base: Case[] = [];
for (let i = 0; i < 60; i++) {
  const mes = 4 + (i % 5);
  const d = 1 + (i % 25);
  const criada = `2026-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  base.push(boa(criada, `2026-${String(mes).padStart(2, "0")}-28`));
}

/* Setembro: duas avaliadas no ciclo 2 (uma resolvida), uma no ciclo 1; e um atendimento de rede. */
const setembro = [
  caso({ createdAt: "2026-09-02", respondida: true, publicResponseAt: "2026-09-03T12:00:00.000Z", responseTime: "1 dia", evaluated: true, evaluatedAt: "2026-09-05", score: 9, resolved: true, wouldDoBusiness: true }),
  caso({ createdAt: "2026-09-03", respondida: true, publicResponseAt: "2026-09-09T12:00:00.000Z", responseTime: "6 dias", evaluated: true, evaluatedAt: "2026-09-10", score: 9, resolved: true, wouldDoBusiness: true }),
  caso({ createdAt: "2026-09-04", respondida: true, publicResponseAt: "2026-09-12T12:00:00.000Z", responseTime: "8 dias", evaluated: true, evaluatedAt: "2026-09-12", score: 4, resolved: false, wouldDoBusiness: false }),
  caso({ createdAt: "2026-09-09", source: "Instagram" as Case["source"] }),
];

const m = medirDia([...base, ...setembro], [], "2026-09-12");
confere("a rede social não entra nas entrantes", m.entrantes, 3);
confere("respondidas pelo fato, sem o texto da resposta", m.respondidas, 3);
confere("resolvidas no ciclo 8 a 14: só a do dia 10", m.resolvidasCiclo, 1);

const noDia9 = medirDia([...base, ...setembro], [], "2026-09-09");
confere("no dia 9, a respondida no dia 12 ainda não estava respondida", noDia9.respondidas, 2);

/* Em setembro, a aba vigente de 6 meses é março a agosto: as 60 entram. */
const comSelo = medirDia(base, [], "2026-09-12");
confere("60 avaliações boas: selo no ciclo do dia", comSelo.ciclosComSelo > 0, true);

const poucas = medirDia(base.slice(0, 40), [], "2026-09-12");
confere("40 avaliações: sem selo, mesmo com as metas", poucas.ciclosComSelo, 0);

/* Em agosto a aba vigente é fevereiro a julho: só 48 das 60 — sem selo. A sequência começa em setembro. */
confere("em 31/08 a aba vigente (fev–jul) tem 48 avaliações: sem selo", medirDia(base, [], "2026-08-31").ciclosComSelo, 0);
confere("8 a 14/09 é o segundo ciclo seguido com selo", medirDia(base, [], "2026-09-12").ciclosComSelo, 2);
confere("1 a 7/09 é o primeiro", medirDia(base, [], "2026-09-05").ciclosComSelo, 1);

console.log("\n— O relatório do ciclo —");

/* Setembro com 10 reclamações novas sem resposta: a próxima aba (abr–set) cai abaixo dos 90%. */
const semResposta = Array.from({ length: 10 }, (_, i) => caso({ createdAt: `2026-09-${String(1 + i).padStart(2, "0")}` }));
const rel = montarRelatorio({ cases: [...base, ...semResposta], nps: [], google: [], ciclo: cicloDe("2026-09-12"), hoje: "2026-09-12" });
const [vigente, proxima] = rel.ra.abas;
confere("a aba vigente de 6 meses é março a agosto", vigente.janela, { inicio: "2026-03-01", fim: "2026-08-31" });
confere("a próxima é abril a setembro", proxima.janela, { inicio: "2026-04-01", fim: "2026-09-30" });
confere("vigente com selo; próxima sem", [vigente.selo, proxima.selo], [true, false]);
confere("na próxima, 70 recebidas e 60 respondidas: 63 para os 90%, faltam 3", proxima.faltamRespostas, 3);
confere("o risco do selo vira ponto de atenção", rel.pontos.some((p) => p.texto.startsWith("O selo está em risco")), true);
confere("o texto diz o que falta na próxima", textoDoRelatorio(rel).includes("para o selo: responder 3"), true);
confere("ciclo passado é lido no último dia dele", montarRelatorio({ cases: base, nps: [], google: [], ciclo: cicloDe("2026-08-30"), hoje: "2026-09-12" }).ateDia, "2026-08-31");

console.log(falhas ? `\n${falhas} falha(s).\n` : "\nTudo certo.\n");
process.exit(falhas ? 1 : 0);
