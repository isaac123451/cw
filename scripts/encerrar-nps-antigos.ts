/**
 * NPS anterior a 17/07/2026 vai para encerrado — só no NPS (1.89).
 *
 * O Isaac: "casos antes de 17 julho, pode mover para a parte de finalizado
 * no nps. SOMENTE NO NPS." Eram 627 respostas paradas em "Novo", nunca
 * tratadas. Vão para "[Encerrado] Sem tratativa" — o encerramento de quem
 * não foi trabalhado, e o único que o reenvio ao Wootric ignora: nenhuma
 * nota nem "completed" sai para o Wootric por causa disto.
 *
 * Cada uma ganha uma anotação dizendo por quê. Sem --gravar, só conta.
 * Com --gravar, guarda antes a lista (id e etapa) em --backup=<arquivo>.
 *
 *   npx tsx --env-file=.env scripts/encerrar-nps-antigos.ts [--gravar --backup=arquivo.json]
 */
import fs from "fs";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { STATUS_SEM_TRATATIVA } from "@/lib/models/nps";

const CORTE = new Date("2026-07-17T03:00:00Z"); /* 17/07/2026 00:00 em Brasília */
const NOTA = "Encerrado em lote em 30/09/2026: resposta anterior a 17/07/2026, sem tratativa (pedido do Isaac — só no NPS).";

(async () => {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  const gravar = process.argv.includes("--gravar");
  const backup = process.argv.find((a) => a.startsWith("--backup="))?.slice(9);

  const alvo = await prisma.npsResponse.findMany({
    where: { respondedAt: { lt: CORTE }, NOT: { status: { startsWith: "[Encerrado]" } } },
    select: { id: true, status: true, closedAt: true },
  });
  console.log(`${alvo.length} respostas abertas antes de 17/07`);

  if (!gravar) {
    await prisma.$disconnect();
    return;
  }
  if (!backup) throw new Error("--backup=<arquivo> é obrigatório para gravar");
  fs.writeFileSync(backup, JSON.stringify(alvo));
  console.log(`lista guardada em ${backup}`);

  const agora = new Date();
  const ids = alvo.map((a) => a.id);
  for (let i = 0; i < ids.length; i += 200) {
    const lote = ids.slice(i, i + 200);
    await prisma.$transaction([
      prisma.npsResponse.updateMany({
        where: { id: { in: lote }, NOT: { status: { startsWith: "[Encerrado]" } } },
        data: { status: STATUS_SEM_TRATATIVA, closedAt: agora },
      }),
      prisma.npsNote.createMany({ data: lote.map((responseId) => ({ responseId, actor: "CW (lote)", body: NOTA })) }),
    ]);
  }

  const restam = await prisma.npsResponse.count({ where: { respondedAt: { lt: CORTE }, NOT: { status: { startsWith: "[Encerrado]" } } } });
  const depois = await prisma.npsResponse.count({ where: { respondedAt: { gte: CORTE }, NOT: { status: { startsWith: "[Encerrado]" } } } });
  console.log(`encerradas ${ids.length}; abertas antes de 17/07 agora: ${restam}; abertas de 17/07 em diante (intactas): ${depois}`);
  await prisma.$disconnect();
})();
