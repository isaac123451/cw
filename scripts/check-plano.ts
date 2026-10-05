/**
 * O plano de ação do Reclame Aqui (1.133): previsão, projeção, metas,
 * ciclos e assuntos.
 *
 *   npm run check:plano
 *
 * As regras com reclamações montadas à mão, cujo resultado se sabe de
 * cabeça; depois a base real, só leitura — inclusive que a janela "de hoje"
 * do plano é a mesma prévia da tela Índice, e quanto a projeção errou nos
 * meses que já fecharam.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { assuntosDoPeriodo, chanceDeAoMenos, tendenciaDe } from "../lib/models/assuntosEmAlta";
import type { Case } from "../lib/models/case";
import { retratoDoIndice } from "../lib/models/indiceRA";
import { calcularPremissas, ciclosDe, falhasQueCabem, MAX_DIAS, planoDoMes, repartir, testarProjecao, type Premissas } from "../lib/models/planoDeAcao";
import { preverReclamacoes, prever, testarMetodos, type PrevisaoDeReclamacoes } from "../lib/models/previsaoDeReclamacoes";
import { fetchCases } from "../lib/services/case.repository";
import { isReclameAqui } from "../lib/services/case.service";
import { scoreFrom } from "../lib/services/reputation.service";

let falhas = 0;
function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(66)} ${String(JSON.stringify(obtido)).slice(0, 44)}`);
  if (!ok) console.log(`        ${"esperado".padEnd(66)} ${String(JSON.stringify(esperado)).slice(0, 44)}`);
}
const perto = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) <= tol;

let seq = 0;
function caso(aberta: string, o: { resposta?: string; avaliacao?: string; nota?: number; resolvida?: boolean; voltaria?: boolean; categoria?: string } = {}): Case {
  seq += 1;
  return {
    id: `c${seq}`,
    protocol: `RA-${seq}`,
    source: "Reclame Aqui",
    title: "t",
    customer: "",
    company: "",
    status: "Novo",
    priority: "Normal",
    category: o.categoria ?? "Sistema",
    createdAt: aberta,
    publicResponse: o.resposta ? "Olá" : "",
    publicResponseAt: o.resposta ? `${o.resposta}T15:00:00Z` : undefined,
    respondida: Boolean(o.resposta),
    evaluated: Boolean(o.avaliacao),
    evaluatedAt: o.avaliacao ? `${o.avaliacao}T15:00:00Z` : undefined,
    score: o.avaliacao ? (o.nota ?? 10) : undefined,
    resolved: o.avaliacao ? (o.resolvida ?? true) : false,
    wouldDoBusiness: o.avaliacao ? (o.voltaria ?? true) : false,
    scoreDisregarded: false,
  } as unknown as Case;
}
const repetir = <T,>(n: number, f: (i: number) => T) => Array.from({ length: n }, (_, i) => f(i));

console.log("\n  PREVISÃO DE RECLAMAÇÕES\n");
conferir("série constante: todo método prevê a constante", ["ultimo", "media3", "media6", "ponderada3", "tendencia12", "combinada"].map((m) => Math.round(prever([10, 10, 10, 10, 10, 10, 10], m as never))), [10, 10, 10, 10, 10, 10]);
conferir("série que sobe 2 por mês: a tendência acerta o próximo", Math.round(prever([2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24], "tendencia12")), 26);
conferir("e dois passos adiante", Math.round(prever([2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24], "tendencia12", 2)), 28);
{
  const meses = repetir(24, (i) => `20${String(24 + Math.floor(i / 12))}-${String((i % 12) + 1).padStart(2, "0")}`);
  const serie = repetir(24, (i) => 2 * i);
  conferir("na série que sobe, o teste escolhe a tendência", testarMetodos(meses, serie)[0].metodo, "tendencia12");
}
{
  /* 10 por mês por 12 meses; no mês corrente (dia 10 de 30), chegaram 2. */
  const casos = [...repetir(12, (m) => repetir(10, () => caso(`2025-${String(m + 1).padStart(2, "0")}-15`))).flat(), caso("2026-01-03"), caso("2026-01-05")];
  const p = preverReclamacoes(casos, "2026-01-10");
  conferir("mês corrente: o que chegou + o resto no ritmo previsto", [p.atual.ateHoje, p.atual.previsto], [2, 2 + Math.round((10 * 21) / 31)]);
  conferir("os próximos meses no ritmo de 10", p.proximos.slice(1).map((x) => x.usado), [10, 10, 10, 10, 10]);
  const manual = preverReclamacoes(casos, "2026-01-10", 6, { "2026-02": 30 });
  conferir("o número digitado na meta vence a previsão", manual.proximos[1].usado, 30);
}

console.log("\n  AS CONTAS DO PLANO\n");
conferir("falhas que cabem em 129 para 90%", falhasQueCabem(129, 90), 12);
conferir("em 97 para 90%: 9 (10 daria 89,7%)", falhasQueCabem(97, 90), 9);
conferir("como o portal arredonda: em 2500, 251 (89,96% é 90,0%)", falhasQueCabem(2500, 90), 251);
conferir("nada recebido: nada cabe", falhasQueCabem(0, 90), 0);
conferir("repartir pelos dias: soma o total", repartir(26, [7, 7, 7, 7, 3]).reduce((s, x) => s + x, 0), 26);
conferir("e proporcional", repartir(31, [7, 7, 7, 7, 3]), [7, 7, 7, 7, 3]);
conferir("outubro tem 5 ciclos; fevereiro de 2027, 4", [ciclosDe("2026-10").length, ciclosDe("2027-02").length], [5, 4]);

{
  /* Sem nada previsto: a projeção é o que já existe, e a meta vira número exato. */
  const zero: Premissas = { avaliadaAte: repetir(MAX_DIAS + 1, () => 0), respondidaAte: repetir(MAX_DIAS + 1, () => 0), notaDasNovas: 8, solucaoDasNovas: 0.9, voltariaDasNovas: 0.8, avaliacoesNaAmostra: 0, reclamacoesNaAmostra: 0 };
  const semNada: PrevisaoDeReclamacoes = { metodo: "media6", testes: [], historico: [], atual: { mes: "2026-10", ateHoje: 0, diasPassados: 5, dias: 31, ritmo: 0, previsto: 0, usado: 0 }, proximos: repetir(6, (i) => ({ mes: `2026-${String(10 + i).padStart(2, "0")}`.replace("2026-13", "2027-01").replace("2026-14", "2027-02").replace("2026-15", "2027-03"), previsto: 0, min: 0, max: 0, usado: 0 })) };
  /* 100 recebidas em setembro: 85 respondidas; 20 avaliadas, 17 resolvidas, nota 7. */
  const casos = [
    ...repetir(20, (i) => caso("2026-09-10", { resposta: "2026-09-12", avaliacao: "2026-09-20", nota: 7, resolvida: i < 17, voltaria: i < 15 })),
    ...repetir(65, () => caso("2026-09-10", { resposta: "2026-09-12" })),
    ...repetir(15, () => caso("2026-09-10")),
  ];
  const p = planoDoMes(casos, "2026-10-05", "2026-10", { mes: "2026-10", resposta: 90, solucao: 90, consumidor: 8, nota: 9.5 }, semNada, zero);
  conferir("sem nada previsto, a projeção é a janela de hoje", perto(p.projecao.resumo.raScoreExato, scoreFrom(p.projecao.conhecido).raScoreExato), true);
  conferir("resposta 90% em 100: responder 5 (cabem 10 sem)", [p.respostas.aFazer, p.respostas.podemFicarSem], [5, 10]);
  conferir("solução 90% com 20 avaliações e 3 não: faltam 10 resolvidas", [p.solucao?.margemDeNaoResolvidas, p.solucao?.jaNaoResolvidas, p.solucao?.resolvidasAMais], [0, 3, 10]);
  conferir("consumidor 8 com média 7 e nada novo: 10 nota 10 a mais", p.consumidor?.avaliacoesNota10AMais, 10);
  conferir("os valores: resposta e avaliação boa sobem, ruim desce", [p.reputacao.valor.resposta > 0, p.reputacao.valor.avaliacaoPerfeita > 0, p.reputacao.valor.avaliacaoRuim < 0], [true, true, true]);
  conferir("uma ruim pesa mais que uma perfeita", -p.reputacao.valor.avaliacaoRuim > p.reputacao.valor.avaliacaoPerfeita, true);
  conferir("nota 9,5 exige mais que as métricas", Boolean(p.reputacao.exigencia && (p.reputacao.exigencia.avaliacoesPerfeitasAMais > 0 || !p.reputacao.exigencia.alcancavel)), true);
  conferir("status: precisa de ação ou fora de alcance, nunca no caminho", p.status !== "no-caminho" && p.status !== "sem-meta", true);
  conferir("os ciclos repartem o que cabe ao mês", p.ciclos.reduce((s, c) => s + c.meta.respostas, 0), p.noMes.respostas);
}

console.log("\n  ASSUNTOS EM ALTA\n");
conferir("Poisson: P(X ≥ 0) = 1", chanceDeAoMenos(0, 3), 1);
conferir("P(X ≥ 1 | λ=1) = 1 − e⁻¹", perto(chanceDeAoMenos(1, 1), 1 - Math.exp(-1), 1e-9), true);
conferir("8 contra 2 de costume: em alta", tendenciaDe(8, 2).tendencia, "alta");
conferir("2 contra 1: como de costume (pode ser acaso)", tendenciaDe(2, 1).tendencia, "estavel");
conferir("0 contra 8: em queda", tendenciaDe(0, 8).tendencia, "queda");
conferir("3 sem nenhuma antes: novo", tendenciaDe(3, 0).tendencia, "novo");
{
  const casos = [...repetir(9, () => caso("2026-09-25", { categoria: "Cancelamento" })), ...repetir(3, () => caso("2026-08-20", { categoria: "Cancelamento" })), ...repetir(6, () => caso("2026-09-25", { categoria: "Sistema" })), ...repetir(18, () => caso("2026-08-10", { categoria: "Sistema" }))];
  const a = assuntosDoPeriodo(casos, "2026-09-06", "2026-10-05", { inicio: "2026-04-01", fim: "2026-09-30" });
  const cancel = a.linhas.find((l) => l.nome === "Cancelamento")!;
  conferir("cancelamento: 9 no período, 1 de costume, em alta", [cancel.recente, cancel.esperado, cancel.tendencia], [9, 1, "alta"]);
  conferir("o em alta vem primeiro na lista do que pede ação", a.emAlta[0]?.nome, "Cancelamento");
}

async function base() {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) return console.log("\n  Sem DATABASE_URL: a parte da base real ficou de fora.\n");
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    console.log("\n  A BASE REAL — só leitura\n");
    const casos = (await fetchCases(prisma)).filter(isReclameAqui);
    const hoje = new Date().toISOString().slice(0, 10);
    const prev = preverReclamacoes(casos, hoje);
    const pr = calcularPremissas(casos, hoje);
    const plano = planoDoMes(casos, hoje, hoje.slice(0, 7), undefined, prev, pr);
    const previa = retratoDoIndice(casos, "6m", "proximo");
    conferir("a janela de hoje do plano é a prévia do Índice", perto(scoreFrom(plano.projecao.conhecido).raScoreExato, previa.resumo.raScoreExato, 1e-9), true);
    conferir("as curvas nunca descem", [pr.avaliadaAte, pr.respondidaAte].every((c) => c.every((v, i) => i === 0 || v >= c[i - 1])), true);
    console.log(`        previsão: ${prev.metodo}, erro médio ${prev.testes[0].erroMedio} por mês; ${hoje.slice(0, 7)}: ${prev.atual.ateHoje} até hoje, ${prev.atual.usado} previstas`);
    console.log(`        ${hoje.slice(0, 7)} se continuar: nota ${plano.projecao.resumo.raScoreExato.toFixed(3)}, resposta ${plano.projecao.resumo.responseIndex}%; responder ${plano.noMes.respostas}, avaliações ${plano.noMes.avaliacoes}`);
    const t = testarProjecao(casos, hoje);
    console.log(`        a projeção contra os meses fechados: ${t.meses.map((m) => `${m.mes} ${m.projetada.toFixed(2)}×${m.real.toFixed(2)}`).join(" · ")} — erro médio ${t.erroMedio}`);
    conferir("a projeção erra menos de 0,4 em média nos últimos 6 meses", (t.erroMedio ?? 9) < 0.4, true);
  } finally {
    await prisma.$disconnect();
  }
}

base().then(() => {
  console.log(falhas ? `\n  ${falhas} falha(s).\n` : "\n  Tudo confere.\n");
  process.exit(falhas ? 1 : 0);
});
