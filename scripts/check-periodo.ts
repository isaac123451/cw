/**
 * Prova o período por data (filtro do NPS).
 *
 *   npm run check:periodo
 *
 * Os atalhos a partir de "hoje" (virada de mês, de ano, fevereiro), o
 * personalizado com as datas trocadas, e a resposta das 23h de Brasília,
 * que é do dia dela e não do seguinte. Sem banco.
 */
import { descreverIntervalo, diaNoIntervalo, intervaloDoAtalho } from "../lib/models/periodo";
import { diaNaOperacao } from "../lib/services/reputation.service";

let falhas = 0;

function confere(nome: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`${ok ? "ok  " : "FALHOU"}  ${nome}${ok ? "" : `\n        esperado ${JSON.stringify(esperado)}, veio ${JSON.stringify(obtido)}`}`);
}

const hoje = "2026-09-14";
confere("tudo", intervaloDoAtalho("tudo", hoje), { de: null, ate: null });
confere("hoje", intervaloDoAtalho("hoje", hoje), { de: hoje, ate: hoje });
confere("7 dias é hoje e os seis anteriores", intervaloDoAtalho("7d", hoje), { de: "2026-09-08", ate: hoje });
confere("30 dias atravessa o mês", intervaloDoAtalho("30d", hoje), { de: "2026-08-16", ate: hoje });
confere("este mês", intervaloDoAtalho("mes", hoje), { de: "2026-09-01", ate: hoje });
confere("mês passado", intervaloDoAtalho("mes-passado", hoje), { de: "2026-08-01", ate: "2026-08-31" });
confere("mês passado em janeiro é dezembro", intervaloDoAtalho("mes-passado", "2027-01-10"), { de: "2026-12-01", ate: "2026-12-31" });
confere("mês passado em março de ano comum", intervaloDoAtalho("mes-passado", "2027-03-02"), { de: "2027-02-01", ate: "2027-02-28" });
confere("personalizado com as datas trocadas", intervaloDoAtalho("personalizado", hoje, { de: "2026-09-10", ate: "2026-09-01" }), { de: "2026-09-01", ate: "2026-09-10" });
confere("personalizado só com o começo", intervaloDoAtalho("personalizado", hoje, { de: "2026-09-01", ate: null }), { de: "2026-09-01", ate: null });

const setembro = { de: "2026-09-01", ate: "2026-09-30" };
confere("as pontas entram", [diaNoIntervalo("2026-09-01", setembro), diaNoIntervalo("2026-09-30", setembro)], [true, true]);
confere("fora das pontas não", [diaNoIntervalo("2026-08-31", setembro), diaNoIntervalo("2026-10-01", setembro)], [false, false]);
/* 31/08 às 23h30 em Brasília é 01/09 02:30 em UTC: a resposta é de agosto. */
confere("resposta das 23h30 de 31/08 é de agosto", diaNoIntervalo(diaNaOperacao("2026-09-01T02:30:00.000Z"), setembro), false);
confere("descrição", descreverIntervalo(setembro), "de 01/09/2026 a 30/09/2026");
confere("descrição de um dia", descreverIntervalo({ de: hoje, ate: hoje }), "em 14/09/2026");

console.log(falhas ? `\n${falhas} conferência(s) falharam.\n` : "\nTudo certo.\n");
process.exit(falhas ? 1 : 0);
