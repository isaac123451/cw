/**
 * O que a IA do dia faria agora, na base real — só lendo (08/10/2026).
 *
 *   npx tsx --env-file=.env scripts/medir-ia-do-dia.ts [e-mail]
 *
 * Lista as atividades abertas da pessoa que ela fecharia (e por quê) e as
 * conversas de hoje que viraria anotação. Serve para conferir, antes de
 * ligar, que ela não fecha o que não foi feito.
 */
import "dotenv/config";

import { getPrisma } from "../lib/prisma";
import { tarefaFeita } from "../lib/models/iaDoDia";
import { CLOSED_STATUS } from "../lib/services/case.service";
import { paredeDe } from "../lib/services/horasUteis";

async function main() {
  const prisma = getPrisma();
  if (!prisma) throw new Error("Sem banco.");
  const email = process.argv[2] ?? "carlos.isaac@cardapioweb.com";
  const eu = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true } });
  if (!eu) throw new Error(`Sem a conta ${email}.`);
  const agora = new Date();
  const hoje = paredeDe(agora).dia;

  const abertas = await prisma.agendaTask.findMany({
    where: { done: false, ownerId: eu.id },
    select: { id: true, title: true, type: true, dueDate: true, createdAt: true, caseId: true },
  });
  console.log(`\n  ${eu.name}: ${abertas.length} atividades abertas\n`);

  let fecharia = 0;
  for (const t of abertas) {
    const msgId = t.id.replace(/^auto-(conversa|pedido)-/, "");
    const [area, msg, caso, contato] = await Promise.all([
      t.id.startsWith("auto-area-") ? prisma.caseMovement.findUnique({ where: { id: t.id.slice(10) }, select: { returnedAt: true } }) : null,
      msgId !== t.id ? prisma.mensagemDaConversa.findUnique({ where: { id: msgId }, select: { conversaId: true } }) : null,
      t.caseId ? prisma.case.findUnique({ where: { id: t.caseId }, select: { status: true, resolved: true } }) : null,
      t.caseId ? prisma.caseContato.findFirst({ where: { caseId: t.caseId }, orderBy: { em: "desc" }, select: { em: true } }) : null,
    ]);
    const nossa = msg ? await prisma.mensagemDaConversa.findFirst({ where: { conversaId: msg.conversaId, de: "nos" }, orderBy: { em: "desc" }, select: { em: true } }) : null;
    const motivo = tarefaFeita(
      { id: t.id, title: t.title, type: t.type, dueDate: t.dueDate.toISOString().slice(0, 10), createdAt: t.createdAt.toISOString(), caseId: t.caseId },
      {
        areaRespondeu: area ? Boolean(area.returnedAt) : undefined,
        nossaMensagemEm: nossa?.em?.toISOString() ?? null,
        ultimoContatoEm: contato?.em.toISOString() ?? null,
        casoEncerrado: caso ? caso.resolved || CLOSED_STATUS.includes(caso.status) : undefined,
      }
    );
    if (motivo) {
      fecharia += 1;
      console.log(`  fecharia  ${t.dueDate.toISOString().slice(0, 10)}  ${t.title.slice(0, 70)}  ← ${motivo}`);
    }
  }
  console.log(`\n  fecharia ${fecharia} de ${abertas.length}`);

  const inicioDoDia = new Date(Date.parse(`${hoje}T03:00:00Z`));
  const conversas = await prisma.conversa.findMany({
    where: { OR: [{ caseId: { not: null } }, { npsResponseId: { not: null } }], mensagens: { some: { em: { gte: inicioDoDia } } } },
    select: { id: true, contatoNome: true, _count: { select: { mensagens: { where: { em: { gte: inicioDoDia } } } } } },
  });
  console.log(`  conversas de hoje ligadas a caso ou NPS: ${conversas.length} (${conversas.filter((c) => c._count.mensagens >= 2).length} com 2+ mensagens — viram anotação depois de 30 min paradas)\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => getPrisma()?.$disconnect());
