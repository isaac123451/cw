/**
 * A IA do dia contra o banco, com dado descartável (08/10/2026).
 *
 *   npx tsx --env-file=.env scripts/check-ia-do-dia-banco.ts
 *
 * Uma mensagem de Slack inventada (canal e ts que não existem) para a
 * conta de quem roda: vira lembrete e ação registrada; ler de novo não
 * repete; desfazer conclui o lembrete e marca a ação; ler depois do
 * desfazer não recria. No fim, apaga tudo o que criou.
 */
import "dotenv/config";

import { getPrisma } from "../lib/prisma";
import { acoesNaoVistas, desfazer, lembretesDoSlack } from "../lib/services/iaDoDia.service";

let falhas = 0;
function conferir(nome: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${nome.padEnd(64)} ${JSON.stringify(obtido)}`);
  if (!ok) console.log(`        ${"esperado".padEnd(64)} ${JSON.stringify(esperado)}`);
}

async function main() {
  const prisma = getPrisma();
  if (!prisma) throw new Error("Sem banco.");
  const email = process.argv[2] ?? "carlos.isaac@cardapioweb.com";
  const eu = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true } });
  if (!eu) throw new Error(`Sem a conta ${email}.`);

  const agora = new Date();
  const canal = "DZZTESTE01";
  const ts = `${Math.floor(agora.getTime() / 1000)}.000001`;
  const tarefaId = `auto-slack-${canal}-${ts}`;
  const mensagem = { canal, ts, texto: "consegue ver o caso da pizzaria hoje?", autor: "Conferência", mencoes: [], quando: agora.toISOString() };

  try {
    console.log("\n  IA DO DIA — CONTRA O BANCO\n");

    conferir("a mensagem direta que pede ação vira 1 lembrete", await lembretesDoSlack(prisma, { id: eu.id, nome: eu.name }, [mensagem]), 1);
    const tarefa = await prisma.agendaTask.findUnique({ where: { id: tarefaId }, select: { done: true, ownerId: true, title: true } });
    conferir("o lembrete está na agenda, aberto, com a pessoa", [Boolean(tarefa), tarefa?.done, tarefa?.ownerId === eu.id], [true, false, true]);
    const naoVistas = await acoesNaoVistas(prisma, eu.id);
    const acao = naoVistas.find((a) => a.titulo === tarefa?.title);
    conferir("a ação aparece para o aviso, com desfazer", [Boolean(acao), acao?.tipo, acao?.desfazivel], [true, "lembrete", true]);

    conferir("ler a mesma mensagem de novo não repete", await lembretesDoSlack(prisma, { id: eu.id, nome: eu.name }, [mensagem]), 0);

    const r = await desfazer(prisma, eu.id, acao!.id);
    conferir("desfazer responde ok", r.ok, true);
    const depois = await prisma.agendaTask.findUnique({ where: { id: tarefaId }, select: { done: true } });
    conferir("desfeito: o lembrete sai da agenda (concluído)", depois?.done, true);
    const linha = await prisma.acaoDaIA.findUnique({ where: { id: acao!.id }, select: { desfeitaEm: true } });
    conferir("e a ação fica marcada como desfeita", Boolean(linha?.desfeitaEm), true);
    conferir("ler depois do desfazer não recria", await lembretesDoSlack(prisma, { id: eu.id, nome: eu.name }, [mensagem]), 0);

    const outra = { ...mensagem, ts: `${Math.floor(agora.getTime() / 1000)}.000002`, texto: "bom dia!" };
    conferir("mensagem sem pedido não vira lembrete", await lembretesDoSlack(prisma, { id: eu.id, nome: eu.name }, [outra]), 0);
  } finally {
    await prisma.agendaTask.deleteMany({ where: { id: { startsWith: `auto-slack-${canal}-` } } });
    await prisma.acaoDaIA.deleteMany({ where: { userId: eu.id, chave: { startsWith: `slack:${canal}:` } } });
    const sobrou = await prisma.acaoDaIA.count({ where: { chave: { startsWith: `slack:${canal}:` } } });
    conferir("o dado descartável saiu da base", sobrou, 0);
  }

  console.log(falhas === 0 ? "\n  A IA do dia grava, não repete e desfaz.\n" : `\n  ${falhas} falha(s).\n`);
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
