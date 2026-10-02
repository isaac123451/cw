/**
 * O tempo ideal e o teto de uma reclamação (1.130).
 *
 *   npm run check:tempo-ideal
 *
 * Duas partes. Primeiro as regras, com reclamações de mentira cujo
 * resultado se sabe de cabeça. Depois a base real, só leitura: o estudo
 * da tela contra uma conta feita à parte, direto nas linhas do banco —
 * se as duas divergirem, a tela está errada.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import type { Case } from "../lib/models/case";
import { diasEntre, estudoDoTempo, folgaDaJanela, janelaVigenteNoDia, simularPrazoDeResposta, somarDias } from "../lib/models/tempoIdeal";
import { fetchCases } from "../lib/services/case.repository";
import { isReclameAqui } from "../lib/services/case.service";

let falhas = 0;
function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(66)} ${String(JSON.stringify(obtido)).slice(0, 44)}`);
  if (!ok) console.log(`        ${"esperado".padEnd(66)} ${String(JSON.stringify(esperado)).slice(0, 44)}`);
}

let seq = 0;
/** Reclamação aberta em `aberta`, respondida e avaliada N dias depois. */
function caso(aberta: string, o: { resposta?: number; avaliacao?: number; nota?: number; resolvida?: boolean; voltaria?: boolean; desconsiderada?: boolean } = {}): Case {
  seq += 1;
  const respondida = o.resposta !== undefined;
  const avaliada = o.avaliacao !== undefined;
  return {
    id: `c${seq}`,
    protocol: `RA-${seq}`,
    source: "Reclame Aqui",
    title: "t",
    customer: "Ana",
    company: "",
    status: avaliada ? "Resolvido" : "Aguardando avaliação",
    priority: "Normal",
    createdAt: aberta,
    publicResponse: respondida ? "Olá" : "",
    publicResponseAt: respondida ? `${somarDias(aberta, o.resposta!)}T15:00:00Z` : undefined,
    respondida,
    evaluated: avaliada,
    evaluatedAt: avaliada ? `${somarDias(aberta, o.avaliacao!)}T15:00:00Z` : undefined,
    score: avaliada ? (o.nota ?? 10) : undefined,
    resolved: avaliada ? (o.resolvida ?? true) : false,
    wouldDoBusiness: avaliada ? (o.voltaria ?? true) : false,
    scoreDisregarded: o.desconsiderada ?? false,
  } as unknown as Case;
}
const boa = (aberta: string, dias: number) => caso(aberta, { resposta: Math.min(dias, 1), avaliacao: dias, nota: 10 });
const ruim = (aberta: string, dias: number) => caso(aberta, { resposta: Math.min(dias, 1), avaliacao: dias, nota: 2, resolvida: false, voltaria: false });
const repetir = <T,>(n: number, f: (i: number) => T) => Array.from({ length: n }, (_, i) => f(i));

console.log("\n  TEMPO IDEAL — as regras\n");

const HOJE = "2026-10-02";
{
  /* Boas até 7 dias; ruins de 8 em diante: ideal 7, teto 7. */
  const casos = [...repetir(6, () => boa("2026-06-01", 2)), ...repetir(6, () => boa("2026-06-01", 6)), ...repetir(12, () => ruim("2026-06-01", 9)), ...repetir(12, () => ruim("2026-06-01", 40))];
  const e = estudoDoTempo(casos, HOJE, "12m");
  conferir("ideal: as faixas que batem as três metas, desde o dia 0", e.finalizacao.ideal, 7);
  conferir("teto: tudo depois do corte abaixo das três metas", e.finalizacao.teto, 7);
  conferir("zonas: até o ideal e depois do teto", e.finalizacao.zonas.map((z) => [z.rotulo, z.desfecho.avaliadas]), [["até 7 dias", 12], ["mais de 7 dias", 24]]);
}
{
  /* Uma faixa ruim no meio, boas dos dois lados: o ideal para na primeira que falha. */
  const casos = [...repetir(6, () => boa("2026-06-01", 2)), ...repetir(6, () => ruim("2026-06-01", 9)), ...repetir(6, () => boa("2026-06-01", 12)), ...repetir(12, () => ruim("2026-06-01", 45))];
  const e = estudoDoTempo(casos, HOJE, "12m");
  conferir("o ideal para na primeira faixa que falha", e.finalizacao.ideal, 3);
  /* Depois de 7: 6 ruins + 6 boas + 12 ruins — nota 4,67, ainda falha as três; teto 7. */
  conferir("o teto é o primeiro corte com tudo depois abaixo", e.finalizacao.teto, 7);
  conferir("três zonas quando o teto passa do ideal", e.finalizacao.zonas.map((z) => z.rotulo), ["até 3 dias", "4 a 7 dias", "mais de 7 dias"]);
}
{
  /* Faixa com menos de 5 avaliadas não decide: duas ruins aos 5 dias não encerram o ideal. */
  const casos = [...repetir(6, () => boa("2026-06-01", 2)), ...repetir(2, () => ruim("2026-06-01", 5)), ...repetir(6, () => boa("2026-06-01", 9)), ...repetir(12, () => ruim("2026-06-01", 50))];
  const e = estudoDoTempo(casos, HOJE, "12m");
  conferir("faixa pequena (menos de 5) não decide o ideal", e.finalizacao.ideal, 10);
  /* Depois de 10 dias só sobram as 12 ruins: o teto é o primeiro corte que não fica antes do ideal. */
  conferir("o teto nunca fica antes do ideal", e.finalizacao.teto, 10);
}
{
  /* Desconsiderada fica fora; sem data de avaliação, fora; antes de 12 meses, fora do período. */
  const casos = [boa("2026-06-01", 2), caso("2026-06-01", { resposta: 1, avaliacao: 2, nota: 1, resolvida: false, voltaria: false, desconsiderada: true }), boa("2024-03-01", 2)];
  const e = estudoDoTempo(casos, HOJE, "12m");
  conferir("a desconsiderada e a de antes do período ficam fora", e.finalizacao.amostra, 1);
  conferir("a base inteira inclui a antiga", estudoDoTempo(casos, HOJE, "tudo").finalizacao.amostra, 2);
}
{
  /* Pedir a avaliação: dias da resposta à avaliação. */
  const casos = [caso("2026-06-01", { resposta: 2, avaliacao: 2 }), caso("2026-06-01", { resposta: 2, avaliacao: 3 }), caso("2026-06-01", { resposta: 2, avaliacao: 12 }), caso("2026-06-01", { resposta: 2, avaliacao: 50 })];
  const e = estudoDoTempo(casos, HOJE, "12m");
  conferir("avaliou no mesmo dia da resposta", e.avaliacao.acumulado.find((a) => a.dias === 0)?.parte, 25);
  conferir("até 30 dias da resposta", e.avaliacao.acumulado.find((a) => a.dias === 30)?.parte, 75);
  conferir("depois de 30 dias", e.avaliacao.depoisDe30, 25);
}
{
  /* Taxa de avaliação só com resposta de 30 dias ou mais. */
  const casos = [caso("2026-06-01", { resposta: 0, avaliacao: 1 }), caso("2026-06-01", { resposta: 0 }), caso("2026-09-30", { resposta: 0 })];
  const e = estudoDoTempo(casos, HOJE, "12m");
  const f = e.resposta.faixas[0];
  conferir("respondida há menos de 30 dias fica fora da taxa", [f.casos, f.maduras, f.taxaDeAvaliacao], [3, 2, 50]);
}

console.log("\n  FOLGA E PRAZO DE RESPOSTA\n");
{
  /* 129 recebidas, 12 sem resposta: 90,7% — o máximo é 12 (13 daria 89,9%). */
  const casos = [...repetir(117, () => caso("2026-05-10", { resposta: 1 })), ...repetir(12, () => caso("2026-05-10"))];
  const f = folgaDaJanela(casos, "2026-04-01", "2026-09-30");
  conferir("129 recebidas, 12 sem resposta: folga zero", [f.maximoSemResposta, f.folga], [12, 0]);
  /* 97 recebidas, 12 sem resposta: 87,6%; o máximo é 9 (88/97 = 90,7%; 87/97 = 89,7%). */
  const g = folgaDaJanela(casos.slice(32), "2026-04-01", "2026-09-30");
  conferir("97 recebidas, 12 sem resposta: responder 3", [g.recebidas, g.maximoSemResposta, g.folga], [97, 9, -3]);
  /* O arredondamento do portal: 89,96% aparece como 90,0%. */
  const h = folgaDaJanela([...repetir(2249, () => caso("2026-05-10", { resposta: 1 })), ...repetir(251, () => caso("2026-05-10"))], "2026-04-01", "2026-09-30");
  conferir("como o portal arredonda: 89,96% conta como 90%", h.maximoSemResposta, 251);
}
{
  conferir("janela vigente de 02/10: abril a setembro", janelaVigenteNoDia("2026-10-02"), { inicio: "2026-04-01", fim: "2026-09-30" });
  conferir("janela vigente de 01/03: setembro a fevereiro", janelaVigenteNoDia("2026-03-01"), { inicio: "2025-09-01", fim: "2026-02-28" });
  /* Uma reclamação por dia: no 1º do mês, as dos últimos T−1 dias ainda esperam. */
  const casos: Case[] = [];
  for (let d = "2025-01-01"; d <= "2026-10-01"; d = somarDias(d, 1)) casos.push(caso(d));
  const s = simularPrazoDeResposta(casos, HOJE);
  conferir("o prazo encontrado segura 90%", s.piorComPrazo !== null && s.piorComPrazo.indice >= 90, true);
  conferir("um dia a mais quebra", s.piorComUmDiaAMais !== null && s.piorComUmDiaAMais.indice < 90, true);
  conferir("e quebra no dia 1º de um mês", s.piorComUmDiaAMais?.dia.endsWith("-01"), true);
  conferir("uma por dia: o prazo fica entre 17 e 19 dias", s.prazo !== null && s.prazo >= 17 && s.prazo <= 19, true);
}

/* ============================================================
   A BASE REAL — só leitura
============================================================ */

async function base() {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) {
    console.log("\n  Sem DATABASE_URL: a parte da base real ficou de fora.\n");
    return;
  }
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    console.log("\n  A BASE REAL — o estudo da tela contra a conta direta no banco\n");
    const casos = (await fetchCases(prisma)).filter(isReclameAqui);
    const linhas = await prisma.case.findMany({
      where: { channel: "RECLAME_AQUI" },
      select: { publishedAt: true, publicResponse: true, publicResponseAt: true, evaluated: true, evaluatedAt: true, score: true, resolved: true, wouldDoBusiness: true, scoreDisregarded: true },
    });
    const dia = (d: Date) => d.toISOString().slice(0, 10);
    conferir("as mesmas reclamações nos dois caminhos", casos.length, linhas.length);

    for (const periodo of ["12m", "tudo"] as const) {
      const e = estudoDoTempo(casos, HOJE, periodo);
      const desde = e.desde ?? "0000";
      const doPeriodo = linhas.filter((l) => dia(l.publishedAt) >= desde);

      /* A conta à parte: finalização (abertura → avaliação) das que contam para a nota. */
      const fin = doPeriodo
        .filter((l) => l.evaluated && !l.scoreDisregarded && l.score != null && l.evaluatedAt)
        .map((l) => ({ l, d: diasEntre(dia(l.publishedAt), dia(l.evaluatedAt!)) }))
        .filter((x) => x.d >= 0);
      conferir(`${periodo}: avaliadas com data`, e.finalizacao.amostra, fin.length);
      const ate7 = fin.filter((x) => x.d <= 7);
      const notaAte7 = Math.round((ate7.reduce((s, x) => s + (x.l.score ?? 0), 0) / ate7.length) * 100) / 100;
      const zonaAte7 = e.finalizacao.faixas.slice(0, 2);
      const notaZona = Math.round(((zonaAte7[0].desfecho.nota ?? 0) * zonaAte7[0].casos + (zonaAte7[1].desfecho.nota ?? 0) * zonaAte7[1].casos) / (zonaAte7[0].casos + zonaAte7[1].casos) * 100) / 100;
      conferir(`${periodo}: nota de quem finalizou em até 7 dias`, Math.abs(notaZona - notaAte7) <= 0.01, true);

      /* Resposta → avaliação. */
      const ra = doPeriodo
        .filter((l) => l.evaluated && l.evaluatedAt && l.publicResponseAt && (l.publicResponse ?? "").trim())
        .map((l) => diasEntre(dia(l.publicResponseAt!), dia(l.evaluatedAt!)))
        .filter((d) => d >= 0);
      conferir(`${periodo}: avaliadas depois da resposta`, e.avaliacao.amostra, ra.length);
      conferir(`${periodo}: chegaram em até 7 dias da resposta`, e.avaliacao.acumulado.find((a) => a.dias === 7)?.parte, Math.round((ra.filter((d) => d <= 7).length / ra.length) * 1000) / 10);

      console.log(
        `        ${periodo}: ideal ${e.finalizacao.ideal ?? "—"} d · teto ${e.finalizacao.teto ?? "—"} d · ` +
          e.finalizacao.zonas.map((z) => `${z.rotulo}: nota ${z.desfecho.nota} · solução ${z.desfecho.solucao}% · voltaria ${z.desfecho.voltaria}% (${z.desfecho.avaliadas})`).join(" | ")
      );
      console.log(`        ${periodo}: avaliação até 1 d ${e.avaliacao.acumulado.find((a) => a.dias === 1)?.parte}% · até 7 d ${e.avaliacao.acumulado.find((a) => a.dias === 7)?.parte}% · depois de 30 d ${e.avaliacao.depoisDe30}%`);
      console.log(`        ${periodo}: prazo de resposta que segura 90%: ${e.resposta.simulacao.prazo} d (pior ${e.resposta.simulacao.piorComPrazo?.indice}% em ${e.resposta.simulacao.piorComPrazo?.dia}; com +1 d, ${e.resposta.simulacao.piorComUmDiaAMais?.indice}% em ${e.resposta.simulacao.piorComUmDiaAMais?.dia})`);
    }

    /* A folga de hoje, contra a conta direta. */
    const j = janelaVigenteNoDia(HOJE);
    const f = folgaDaJanela(casos, j.inicio, j.fim);
    const naJanela = linhas.filter((l) => dia(l.publishedAt) >= j.inicio && dia(l.publishedAt) <= j.fim);
    conferir("folga de hoje: recebidas e sem resposta", [f.recebidas, f.semResposta], [naJanela.length, naJanela.filter((l) => !(l.publicResponse ?? "").trim()).length]);
    console.log(`        hoje (${j.inicio} a ${j.fim}): ${f.semResposta} sem resposta, máximo ${f.maximoSemResposta}, folga ${f.folga}`);
  } finally {
    await prisma.$disconnect();
  }
}

base().then(() => {
  console.log(falhas ? `\n  ${falhas} falha(s).\n` : "\n  Tudo confere.\n");
  process.exit(falhas ? 1 : 0);
});
