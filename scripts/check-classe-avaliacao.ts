/**
 * Avaliação positiva ou negativa (21/10/2026).
 *
 *   npm run check:classe-avaliacao
 *
 * 1. a regra: a marca à mão vale sempre; a da IA, onde ninguém marcou; sem
 *    as duas, a nota (resolvida ou 9–10 positiva; não resolvida até 6
 *    negativa; o resto neutra);
 * 2. o placar do Meu dia conta positivas e negativas por essa ordem;
 * 3. no banco, numa reclamação descartável: a IA marca, a marca à mão
 *    não é sobrescrita, e o que a IA já leu não é lido de novo;
 * 4. com IA configurada, a leitura de verdade de avaliações reais (só
 *    leitura, nada é gravado).
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import type { Case } from "../lib/models/case";
import { classeDaAvaliacao, MARCADO_PELA_IA } from "../lib/models/classeDaAvaliacao";
import { numerosDaJanela } from "../lib/models/motivacaoDoDia";
import { classificarAvaliacoes, lerComIA, precisaDaIA } from "../lib/services/classeDaAvaliacao.service";
import { temIA } from "../lib/services/ia.service";

let falhas = 0;
function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(70)} ${JSON.stringify(obtido)?.slice(0, 70)}`);
  if (!ok) console.log(`        ${"esperado".padEnd(70)} ${JSON.stringify(esperado)?.slice(0, 70)}`);
}

const base = { evaluated: true, resolved: false, score: 5 } as Case;

function regra() {
  console.log("\n  A REGRA\n");
  conferir("nota 10 resolvida: positiva pela nota", classeDaAvaliacao({ ...base, score: 10, resolved: true }), { classe: "positiva", origem: "regra" });
  conferir("nota 3 não resolvida: negativa pela nota", classeDaAvaliacao({ ...base, score: 3 }), { classe: "negativa", origem: "regra" });
  conferir("nota 8 não resolvida: neutra", classeDaAvaliacao({ ...base, score: 8 })?.classe, "neutra");
  conferir("a marca à mão vence a nota", classeDaAvaliacao({ ...base, score: 10, resolved: true, avaliacaoMarca: "negativa", avaliacaoMarcaPor: "Carlos" }), { classe: "negativa", origem: "voce" });
  conferir("a marca da IA vence a nota", classeDaAvaliacao({ ...base, score: 8, avaliacaoMarca: "positiva", avaliacaoMarcaPor: MARCADO_PELA_IA }), { classe: "positiva", origem: "ia" });
  conferir("não avaliada: sem classe", classeDaAvaliacao({ ...base, evaluated: false }), null);
  conferir("a IA só lê com o comentário final (sem ele, vale a nota)", [
    precisaDaIA({ consideracaoFinal: null }),
    precisaDaIA({ consideracaoFinal: "ok" }),
    precisaDaIA({ consideracaoFinal: "Resolveram, mas demorou um mês." }),
  ], [false, false, true]);

  const dia = "2026-10-21";
  const casos = [
    { ...base, source: "Reclame Aqui", score: 10, resolved: true, evaluatedAt: dia },
    { ...base, source: "Reclame Aqui", score: 2, evaluatedAt: dia },
    { ...base, source: "Reclame Aqui", score: 10, resolved: true, evaluatedAt: dia, avaliacaoMarca: "negativa", avaliacaoMarcaPor: "Carlos" },
    { ...base, source: "Reclame Aqui", score: 8, evaluatedAt: dia },
  ] as Case[];
  const n = numerosDaJanela({ casos, nps: [], de: dia, ate: dia });
  conferir("placar: positivas, negativas, avaliadas (a marca à mão conta)", [n.avaliacoes, n.negativas, n.avaliadas], [1, 2, 4]);
}

async function banco(prisma: PrismaClient) {
  console.log("\n  NO BANCO — reclamações descartáveis\n");
  const marca = `RA-ZZ-CLASSE-${Date.now().toString(36)}`;
  const criar = (sufixo: string, dados: Record<string, unknown>) =>
    prisma.case.create({
      data: { protocol: `${marca}-${sufixo}`, companyName: "Descartável", customer: "Descartável", title: "Teste", status: "Resolvido", publishedAt: new Date(), evaluated: true, evaluatedAt: new Date(), ...dados },
      select: { protocol: true },
    });
  try {
    const comentario = await criar("A", { score: 9, resolved: true, consideracaoFinal: "Resolveram, mas fiquei um mês sem sistema." });
    const aMao = await criar("B", { score: 8, resolved: false, avaliacaoMarca: "positiva", avaliacaoMarcaPor: "Carlos", avaliacaoMarcaEm: new Date() });
    const protocolos = [comentario.protocol, aMao.protocol];
    let pedidos: string[] = [];
    const falsa = async (itens: { protocolo: string }[]) => {
      pedidos = itens.map((i) => i.protocolo);
      return itens.map((i) => ({ protocolo: i.protocolo, classe: "negativa" as const, motivo: "Demora de um mês." }));
    };
    const r = await classificarAvaliacoes(prisma, { ler: falsa, soProtocolos: protocolos });
    conferir("a IA só lê quem ninguém marcou", pedidos, [comentario.protocol]);
    conferir("e marca", r, { lidas: 1, positivas: 0, negativas: 1, neutras: 0 });
    const depois = await prisma.case.findMany({ where: { protocol: { in: protocolos } }, orderBy: { protocol: "asc" }, select: { avaliacaoMarca: true, avaliacaoMarcaPor: true, avaliacaoMarcaMotivo: true } });
    conferir("gravado: a da IA com motivo; a à mão intacta", depois, [
      { avaliacaoMarca: "negativa", avaliacaoMarcaPor: MARCADO_PELA_IA, avaliacaoMarcaMotivo: "Demora de um mês." },
      { avaliacaoMarca: "positiva", avaliacaoMarcaPor: "Carlos", avaliacaoMarcaMotivo: null },
    ]);
    pedidos = [];
    await classificarAvaliacoes(prisma, { ler: falsa, soProtocolos: protocolos });
    conferir("rodar de novo não relê nada", pedidos, []);
  } finally {
    await prisma.case.deleteMany({ where: { protocol: { startsWith: marca } } });
    conferir("nada descartável ficou", await prisma.case.count({ where: { protocol: { startsWith: marca } } }), 0);
  }
}

async function iaDeVerdade(prisma: PrismaClient) {
  if (!temIA()) {
    console.log("\n  --   sem IA configurada: a leitura de verdade fica de fora\n");
    return;
  }
  console.log("\n  A IA DE VERDADE — casos de prova, só leitura\n");
  /* O assunto é de propósito o contrário do comentário: a IA tem de decidir pela avaliação. */
  const casos = [
    { protocolo: "P1", nota: 10, resolvida: true, voltaria: true, titulo: "Não recebi o repasse", comentario: "Resolveram rápido, atendimento excelente, recomendo." },
    { protocolo: "P2", nota: 8, resolvida: true, voltaria: false, titulo: "Sistema ótimo", comentario: "Resolveram, mas fiquei um mês sem sistema e perdi pedidos. Não volto." },
    { protocolo: "P3", nota: 3, resolvida: false, voltaria: false, titulo: "Elogio ao suporte", comentario: "Continuo sem resposta e cobrando o estorno." },
  ];
  const lidas = await lerComIA(casos);
  const classe = (p: string) => lidas?.find((l) => l.protocolo === p)?.classe ?? null;
  conferir("decide pelo comentário, não pelo assunto", [classe("P1"), classe("P2"), classe("P3")], ["positiva", "negativa", "negativa"]);
  for (const l of lidas ?? []) console.log(`        ${l.protocolo} → ${l.classe} — ${l.motivo}`);
  const comComentario = await prisma.case.count({ where: { channel: "RECLAME_AQUI", evaluated: true, consideracaoFinal: { not: null } } });
  console.log(`\n        reclamações com o comentário final guardado: ${comComentario} (o vigia completa ao reler o portal)`);
}

async function main() {
  regra();
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (url) {
    const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
    try {
      await banco(prisma);
      await iaDeVerdade(prisma);
    } finally {
      await prisma.$disconnect();
    }
  }
  console.log(falhas ? `\n  ${falhas} ponto(s) a corrigir.\n` : "\n  A avaliação é positiva ou negativa por quem decide, na ordem certa.\n");
  if (falhas) process.exitCode = 1;
}

main();
