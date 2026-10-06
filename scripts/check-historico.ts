/**
 * O histórico de trocas do caso — responsável e etapa, com quem trocou.
 *
 *   npm run check:historico
 *
 * Contra o banco, num caso descartável (`RA-ZzHistorico`) apagado no fim:
 * trocar responsável e etapa grava um evento cada; trocar nada não grava;
 * a leitura devolve na ordem e com o nome de quem trocou; e o histórico
 * da ficha mostra as duas linhas. Apagar o caso leva os eventos junto.
 */
import "dotenv/config";

import { getPrisma } from "../lib/prisma";
import { eventosDoCaso, registrarTrocas } from "../lib/services/historicoDoCaso.service";
import { buildTimeline } from "../lib/services/timeline.service";
import type { Case } from "../lib/models/case";

const PROTOCOLO = "RA-ZzHistorico";

let falhas = 0;
function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(58)} ${JSON.stringify(obtido).slice(0, 60)}`);
  if (!ok) console.log(`        ${"esperado".padEnd(58)} ${JSON.stringify(esperado).slice(0, 60)}`);
}

async function main() {
  const prisma = getPrisma();
  if (!prisma) throw new Error("Sem banco no .env.");

  console.log("\n  HISTÓRICO DE TROCAS — caso descartável\n");

  await prisma.case.deleteMany({ where: { protocol: PROTOCOLO } });

  try {
    await prisma.case.create({
      data: {
        protocol: PROTOCOLO,
        companyName: "Consumidor",
        customer: "Consumidor",
        title: "Reclamação descartável do histórico",
        status: "Novo",
        publishedAt: new Date("2026-10-01T12:00:00Z"),
      },
    });

    await registrarTrocas(prisma, { nome: "Pessoa A" }, PROTOCOLO, { owner: null, status: "Novo" }, { owner: "Pessoa B", status: "Em tratativa" });
    await registrarTrocas(prisma, { nome: "Pessoa A" }, PROTOCOLO, { owner: "Pessoa B", status: "Em tratativa" }, { owner: "Pessoa B", status: "Em tratativa" });

    const eventos = await eventosDoCaso(prisma, PROTOCOLO);
    conferir("trocar responsável e etapa grava dois eventos", eventos.map((e) => e.tipo), ["responsavel", "etapa"]);
    conferir("o que mudou, de onde para onde", eventos.map((e) => e.detalhe), ["ninguém → Pessoa B", "Novo → Em tratativa"]);
    conferir("com quem trocou", eventos.map((e) => e.por), ["Pessoa A", "Pessoa A"]);
    conferir("sem troca, nada a mais", eventos.length, 2);

    const linhas = buildTimeline({ protocol: PROTOCOLO, createdAt: "2026-10-01", source: "Reclame Aqui", status: "Em tratativa" } as Case, [], [], eventos)
      .filter((l) => l.id.startsWith("evento-"))
      .map((l) => `${l.title}: ${l.detail}`);
    conferir("o histórico da ficha mostra as duas", linhas, [
      "Responsável trocado: ninguém → Pessoa B · por Pessoa A",
      "Etapa trocada: Novo → Em tratativa · por Pessoa A",
    ]);
  } finally {
    await prisma.case.deleteMany({ where: { protocol: PROTOCOLO } });
    const sobra = await prisma.caseEvent.count({ where: { case: { protocol: PROTOCOLO } } });
    conferir("apagar o caso leva os eventos junto", sobra, 0);
    await prisma.$disconnect();
  }

  console.log(falhas === 0 ? "\n  As trocas ficam no histórico, com quem trocou.\n" : `\n  ${falhas} ponto(s) a corrigir.\n`);
  process.exitCode = falhas === 0 ? 0 : 1;
}

main();
