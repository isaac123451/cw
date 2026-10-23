/**
 * A avaliação lançada na tela fecha a coluna (22/10/2026) — no banco de
 * verdade, com uma reclamação descartável criada e apagada aqui.
 *
 *   npm run check:avaliacao-fecha-coluna
 *
 * "Teve cliente que avaliou e não contabilizou": a RA-5spZ ganhou nota,
 * resolvido e voltaria pela tela e ficou em "Aguardando avaliação".
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { fetchCaseByProtocol, persistCase, persistCaseParcial } from "../lib/services/case.repository";
import type { Case } from "../lib/models/case";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL }) });
const PROTOCOLOS = ["RA-ZzAvaliaFecha01", "RA-ZzAvaliaFecha02"];

let falhas = 0;
function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(66)} ${JSON.stringify(obtido)}`);
  if (!ok) console.log(`        ${"esperado".padEnd(66)} ${JSON.stringify(esperado)}`);
}

function base(protocolo: string): Case {
  return {
    id: protocolo, protocol: protocolo, company: "Não informado", customer: "Teste descartável", source: "Reclame Aqui",
    category: "", subcategory: "", priority: "Média", status: "Aguardando avaliação", title: "Reclamação descartável do teste",
    description: "relato", publicResponse: "resposta", publicResponseAt: "2026-10-01", evaluated: false, resolved: false, wouldDoBusiness: false,
    responseTime: "-", solutionTime: "-", sla: "48h", createdAt: "2026-10-01",
  } as unknown as Case;
}

(async () => {
  console.log("\n  A AVALIAÇÃO LANÇADA NA TELA FECHA A COLUNA\n");
  await prisma.case.deleteMany({ where: { protocol: { in: PROTOCOLOS } } });
  try {
    /* Pela tela do caso (gravação parcial). */
    await persistCase(prisma, base(PROTOCOLOS[0]));
    const anterior = (await fetchCaseByProtocol(prisma, PROTOCOLOS[0]))!;
    const r = await persistCaseParcial(prisma, { ...anterior, evaluated: true, score: 10, resolved: true, wouldDoBusiness: true }, anterior);
    const depois = await prisma.case.findUnique({ where: { protocol: PROTOCOLOS[0] }, select: { status: true, evaluated: true, evaluatedAt: true } });
    conferir("nota 10 resolvida pela tela: vai para Resolvido", [depois?.status, depois?.evaluated, Boolean(depois?.evaluatedAt)], ["Resolvido", true, true]);
    conferir("e a tela fica sabendo que a coluna mudou", r.ok && r.alterados.includes("status") && "colunaPelaAvaliacao" in r ? r.colunaPelaAvaliacao : null, "Resolvido");

    /* Pelo caminho inteiro (quadro, extensão). */
    await persistCase(prisma, { ...base(PROTOCOLOS[1]), status: "Em tratativa", evaluated: true, score: 3, resolved: false } as Case);
    conferir("avaliada não resolvida pelo caminho inteiro: Não resolvido", (await prisma.case.findUnique({ where: { protocol: PROTOCOLOS[1] }, select: { status: true } }))?.status, "Não resolvido");

    /* Salvar outra coisa numa avaliada já fechada não mexe na coluna. */
    const fechada = (await fetchCaseByProtocol(prisma, PROTOCOLOS[0]))!;
    const r2 = await persistCaseParcial(prisma, { ...fechada, customer: "Teste descartável 2" }, fechada);
    conferir("editar outro campo de uma avaliada não mexe na coluna", [r2.ok && r2.alterados, (await prisma.case.findUnique({ where: { protocol: PROTOCOLOS[0] }, select: { status: true } }))?.status], [["customer"], "Resolvido"]);
  } finally {
    await prisma.case.deleteMany({ where: { protocol: { in: PROTOCOLOS } } });
    conferir("as descartáveis saíram do banco", await prisma.case.count({ where: { protocol: { in: PROTOCOLOS } } }), 0);
    await prisma.$disconnect();
  }
  console.log(falhas ? `\n  ${falhas} ponto(s) a corrigir.\n` : "\n  Avaliada não fica em coluna aberta, venha da tela, do quadro ou do vigia.\n");
  process.exitCode = falhas ? 1 : 0;
})();
