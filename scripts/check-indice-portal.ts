/**
 * O índice daqui bate com o do portal — e a evolução não perde nada?
 *
 *   npm run check:indice-portal
 *
 * Só leitura, sobre a base real. Três perguntas (1.118):
 *
 * 1. **A regra da janela é a do portal.** Para cada painel oficial lido
 *    pela extensão (6 e 12 meses), a mesma janela calculada aqui, como
 *    estava no dia da leitura, dá as mesmas avaliadas, solução, voltaria,
 *    nota do consumidor e nota. Foi esta conta que decidiu, em 01/10/2026,
 *    que a reclamação entra na janela pela data em que foi aberta e a
 *    avaliação dela vale a partir do dia em que chegou — contar a
 *    avaliação pela data em que foi feita dava 81 avaliadas onde o portal
 *    mostrava 72.
 * 2. **O último ponto da evolução é a nota da tela.** Hoje, no dia a dia,
 *    a atual é a "Hoje" e a prévia é a "Prévia" do topo do Índice.
 * 3. **Nada se perde nem se repete** ao contar pela data do acontecimento:
 *    as avaliações e as respostas dos 12 pontos do mês somam o que há
 *    nesses 12 meses; e os índices por mês do Analytics somam as
 *    avaliações feitas no período.
 */
import "dotenv/config";

import type { Case } from "../lib/models/case";
import { respondida } from "../lib/models/case";
import { comoEstavaNoDia, evolucaoDoIndice, notaExata, retratoDoIndice } from "../lib/models/indiceRA";
import { getPrisma } from "../lib/prisma";
import { getMonthlyIndices } from "../lib/services/charts.service";
import { fetchCases } from "../lib/services/case.repository";
import { isSocial } from "../lib/services/case.service";
import { diaNaOperacao, getRawCounts, getRange, getReputationTrend, hojeNaOperacao, inRange, scoreFrom } from "../lib/services/reputation.service";

let falhas = 0;
function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(60)} ${JSON.stringify(obtido)?.slice(0, 60)}`);
  if (!ok) console.log(`        ${"esperado".padEnd(60)} ${JSON.stringify(esperado)?.slice(0, 60)}`);
}

const um = (v: number) => Math.round(v * 10) / 10;
const dois = (v: number) => Math.round(v * 100) / 100;

async function main() {
  const prisma = getPrisma();
  if (!prisma) throw new Error("Sem banco.");
  const casos = (await fetchCases(prisma)).filter((c) => !isSocial(c));
  const hoje = hojeNaOperacao();

  console.log(`\n  ÍNDICE CONTRA O PORTAL — ${casos.length} reclamações, hoje ${hoje}\n`);

  /* 1. A regra da janela, contra cada painel oficial de 6 e 12 meses (o mais recente de cada janela). */
  const paineis = await prisma.painelDoPortal.findMany({ where: { tipo: { in: ["SIX_MONTHS", "TWELVE_MONTHS"] } }, orderBy: { lidoEm: "desc" }, take: 20 });
  const vistos = new Set<string>();
  for (const p of paineis) {
    const chave = `${p.tipo}|${p.inicio}|${p.fim}`;
    if (vistos.has(chave) || !p.inicio) continue;
    vistos.add(chave);
    const d = p.dados as Record<string, number | null>;
    const lido = diaNaOperacao(p.lidoEm);
    const janela = casos.filter((c) => inRange(c, p.inicio, p.fim)).map((c) => comoEstavaNoDia(c, lido));
    const r = scoreFrom(getRawCounts(janela));
    const desconsideradas = janela.filter((c) => c.evaluated && c.scoreDisregarded).length;
    console.log(`  ${p.tipo === "SIX_MONTHS" ? "6 meses" : "12 meses"} · ${p.inicio} a ${p.fim} · painel lido em ${lido}`);
    conferir(
      "   avaliadas, solução, voltaria, nota do consumidor e nota",
      [r.evaluated + desconsideradas, um(r.solutionIndex), um(r.wouldReturnIndex), dois(r.consumerScore), r.raScore],
      [d.avaliadas, d.solucao, d.voltaria, d.notaConsumidor, d.nota]
    );
    /*
      Recebidas com folga de 1: em 01/10/2026 o portal contava 129 e a base
      130 nos 6 meses (e 221 × 222 nos 12) — uma reclamação que existe aqui
      e não lá, sem avaliação, que não muda nenhum índice acima.
    */
    conferir("   recebidas (folga de 1)", Math.abs(r.received - Number(d.recebidas)) <= 1, true);
    if (vistos.size >= 2) break;
  }
  if (vistos.size === 0) console.log("  (nenhum painel do portal lido ainda — a extensão grava na próxima leitura)");

  /* 2. O último ponto da evolução é a nota da tela. */
  console.log();
  for (const periodo of ["6m", "12m"] as const) {
    const dias = evolucaoDoIndice(casos, periodo, "dia", hoje, hoje);
    const ultimo = dias[dias.length - 1];
    const atual = retratoDoIndice(casos, periodo, "vigente").resumo.raScoreExato;
    const previa = retratoDoIndice(casos, periodo, "proximo").resumo.raScoreExato;
    conferir(`${periodo}: o último dia é a "Hoje" e a "Prévia" do topo`, [notaExata(ultimo.atual), notaExata(ultimo.previa)], [notaExata(atual), notaExata(previa)]);
  }

  /* 3. Nada se perde nem se repete. */
  const meses = evolucaoDoIndice(casos, "6m", "mes", hoje, hoje);
  const de = meses[0].inicio;
  const no = (v: string | undefined) => Boolean(v) && diaNaOperacao(v!) >= de && diaNaOperacao(v!) <= hoje;
  conferir(
    "as avaliações dos 12 meses somam as feitas nesses meses",
    meses.reduce((s, m) => s + m.avaliadas, 0),
    casos.filter((c: Case) => c.evaluated && no(c.evaluatedAt)).length
  );
  conferir(
    "as respostas dos 12 meses somam as publicadas nesses meses",
    meses.reduce((s, m) => s + m.respondidas, 0),
    casos.filter((c: Case) => respondida(c) && no(c.publicResponseAt)).length
  );
  const ciclos = evolucaoDoIndice(casos, "6m", "ciclo", hoje, hoje);
  const deCiclo = ciclos[0].inicio;
  conferir(
    "e os 10 ciclos, as feitas nos ciclos",
    ciclos.reduce((s, c) => s + c.avaliadas, 0),
    casos.filter((c: Case) => c.evaluated && c.evaluatedAt && diaNaOperacao(c.evaluatedAt) >= deCiclo && diaNaOperacao(c.evaluatedAt) <= hoje).length
  );

  const range = getRange("12m", "vigente");
  const porMes = getMonthlyIndices(casos, "12m");
  conferir(
    "Analytics, índices por mês: somam as avaliações feitas no período",
    porMes.reduce((s, m) => s + m.evaluated, 0),
    casos.filter((c) => c.evaluated && !c.scoreDisregarded && (c.evaluatedAt ? diaNaOperacao(c.evaluatedAt) : c.createdAt) >= range.start && (c.evaluatedAt ? diaNaOperacao(c.evaluatedAt) : c.createdAt) <= range.end).length
  );

  /*
    4. A nota de cada mês é a mesma em todas as telas (1.121). Pedido de
    01/10/2026: "os cálculos da nota do RA de cada mês estão
    inconsistentes" — eram quatro contas. Agora é uma (`contasDoMes`), e
    aqui as quatro telas são chamadas como elas chamam.
  */
  console.log("\n  A nota de cada mês, tela a tela (12 meses fechados)\n");
  const umaCasa = (v: number) => Math.round(v * 10) / 10;
  /* A visão Mês do Índice com a seta de volta um mês: os 12 fechados, como os Gráficos. */
  const mesesFechados = evolucaoDoIndice(casos, "6m", "mes", range.end, hoje);
  const doIndice = new Map(mesesFechados.map((m) => [m.chave, m.doMes?.nota == null ? null : umaCasa(m.doMes.nota)]));
  const dosGraficos = new Map(porMes.map((m) => [m.key, m.raScore]));
  const rotuloParaChave = (rotulo: string) => {
    const nomes = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
    const [m, a] = rotulo.split("/");
    return `20${a}-${String(nomes.indexOf(m) + 1).padStart(2, "0")}`;
  };
  const doAnalytics = new Map(getReputationTrend(casos, { inicio: range.start, fim: range.end }).map((m) => [rotuloParaChave(m.label), m.score]));
  const daExtensao = new Map(getReputationTrend(casos).map((m) => [rotuloParaChave(m.label), m.score]));
  const diferentes: string[] = [];
  for (const chave of porMes.map((m) => m.key)) {
    const valores = [doIndice.get(chave) ?? null, dosGraficos.get(chave) ?? null, doAnalytics.get(chave) ?? null, daExtensao.get(chave) ?? null];
    const iguais = valores.every((v) => v === valores[0]);
    if (!iguais) diferentes.push(chave);
    console.log(`  ${chave}  Índice ${valores[0]}  Gráficos ${valores[1]}  Analytics ${valores[2]}  extensão ${valores[3]}${iguais ? "" : "   ← diferente"}`);
  }
  conferir("a nota de cada mês é a mesma nas quatro telas", diferentes, []);

  console.log(falhas === 0 ? "\n  A nota daqui é a do portal, e a evolução fecha a conta.\n" : `\n  ${falhas} falha(s).\n`);
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
