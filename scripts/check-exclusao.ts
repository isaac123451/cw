/**
 * Excluir uma conta leva só a conta?
 *
 *   npm run check:exclusao
 *
 * **O pedido.** "Opções de excluir contas da plataforma é importante."
 * Excluir mexe em tudo que aponta para a pessoa — reclamações, tarefas,
 * comentários, filtros, a lista de e-mails liberados. Cada destino tem
 * prova aqui, em contas e dados descartáveis (e-mail `zz-excluir-*`),
 * apagados no começo e no fim.
 *
 * A trava do último administrador roda contra um banco de roteiro: a
 * base tem administradores de verdade, e provar a trava no banco real
 * exigiria desativá-los.
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import {
  excluirUsuario,
  previaDaExclusao,
} from "../lib/services/contas.service";

let falhas = 0;

function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(
    `${ok ? "  ok  " : "FALHA "} ${titulo.padEnd(60)} ${JSON.stringify(obtido)?.slice(0, 50)}`
  );
  if (!ok) {
    console.log(`${" ".repeat(7)}${"esperado".padEnd(60)} ${JSON.stringify(esperado)?.slice(0, 50)}`);
  }
}

const PREFIXO = "zz-excluir-";
const ALVO = `${PREFIXO}alvo@cardapioweb.com`;
const DESTINO = `${PREFIXO}destino@cardapioweb.com`;
const LEITOR = `${PREFIXO}leitor@cardapioweb.com`;

const ABERTA = "RA-ZzExclusaoAbert";
const FECHADA = "RA-ZzExclusaoFecha";

async function limpar(prisma: PrismaClient) {
  const protocolos = [ABERTA, FECHADA];
  await prisma.agendaTask.deleteMany({ where: { title: { startsWith: "ZzExclusao" } } });
  await prisma.caseComment.deleteMany({ where: { case: { protocol: { in: protocolos } } } });
  await prisma.case.deleteMany({ where: { protocol: { in: protocolos } } });
  await prisma.savedFilter.deleteMany({ where: { name: { startsWith: "ZzExclusao" } } });
  await prisma.allowedEmail.deleteMany({ where: { email: { startsWith: PREFIXO } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: PREFIXO } } });
}

async function contra(prisma: PrismaClient) {

  console.log("\n  EXCLUIR — contas descartáveis, contra o banco\n");

  const executor = await prisma.user.findFirst({
    where: { role: "ADMIN", active: true },
    select: { id: true },
  });

  if (!executor) {
    console.log("  --   base sem administrador para executar");
    return;
  }

  const [alvo, destino, leitor] = await Promise.all([
    prisma.user.create({
      data: { email: ALVO, name: "Pessoa Excluída", passwordHash: "x", role: "AGENTE" },
    }),
    prisma.user.create({
      data: { email: DESTINO, name: "Pessoa Que Recebe", passwordHash: "x", role: "AGENTE" },
    }),
    prisma.user.create({
      data: { email: LEITOR, name: "Pessoa Que Só Lê", passwordHash: "x", role: "LEITURA" },
    }),
  ]);

  await prisma.allowedEmail.create({ data: { email: ALVO } });

  await prisma.userPreference.create({
    data: { userId: alvo.id, notifications: {} },
  });

  const base = {
    companyName: "Consumidor",
    customer: "Consumidor",
    title: "Reclamação descartável da exclusão",
    publishedAt: new Date("2026-09-01T00:00:00Z"),
    ownerId: alvo.id,
  };

  const aberta = await prisma.case.create({
    data: { ...base, protocol: ABERTA, status: "Novo" },
  });

  await prisma.case.create({
    data: { ...base, protocol: FECHADA, status: "Resolvido" },
  });

  await prisma.caseComment.create({
    data: { caseId: aberta.id, authorId: alvo.id, body: "Liguei e combinei o estorno." },
  });

  await prisma.agendaTask.create({
    data: {
      title: "ZzExclusao tarefa pendente",
      type: "Follow-up",
      dueDate: new Date("2026-09-20T00:00:00Z"),
      ownerId: alvo.id,
    },
  });

  await prisma.savedFilter.create({
    data: { name: "ZzExclusao pessoal", criteria: {}, ownerId: alvo.id },
  });

  await prisma.savedFilter.create({
    data: { name: "ZzExclusao compartilhado", criteria: {}, ownerId: alvo.id, shared: true },
  });

  /* --- a prévia --- */

  const previa = await previaDaExclusao(prisma, alvo.id);

  conferir(
    "a prévia conta o que está com a pessoa",
    [
      previa?.reclamacoesAbertas,
      previa?.reclamacoesEncerradas,
      previa?.tarefasPendentes,
      previa?.comentarios,
      previa?.filtrosPessoais,
    ],
    [1, 1, 1, 1, 1]
  );
  conferir("e não é o último administrador", previa?.ultimoAdmin, false);

  /* --- as travas --- */

  const propria = await excluirUsuario(prisma, {
    alvoId: alvo.id,
    executorId: alvo.id,
    destinoId: null,
  });

  conferir("ninguém exclui a própria conta", propria.ok, false);

  const paraLeitor = await excluirUsuario(prisma, {
    alvoId: alvo.id,
    executorId: executor.id,
    destinoId: leitor.id,
  });

  conferir("não passa o trabalho para quem só lê", paraLeitor.ok, false);
  conferir(
    "e nada foi tocado por isso",
    await prisma.user.count({ where: { id: alvo.id } }),
    1
  );

  /* --- a exclusão --- */

  const feita = await excluirUsuario(prisma, {
    alvoId: alvo.id,
    executorId: executor.id,
    destinoId: destino.id,
  });

  conferir(
    "a exclusão diz o que passou para quem",
    feita.ok ? [feita.transferidas, feita.destino] : feita.erro,
    [{ reclamacoes: 1, nps: 0, tarefas: 1 }, "Pessoa Que Recebe"]
  );

  const [depoisAberta, depoisFechada, comentario, tarefa, filtros, liberado, conta, preferencia] =
    await Promise.all([
      prisma.case.findUnique({ where: { protocol: ABERTA }, select: { ownerId: true } }),
      prisma.case.findUnique({ where: { protocol: FECHADA }, select: { ownerId: true } }),
      prisma.caseComment.findFirst({
        where: { caseId: aberta.id },
        select: { authorId: true, authorName: true, body: true },
      }),
      prisma.agendaTask.findFirst({
        where: { title: "ZzExclusao tarefa pendente" },
        select: { ownerId: true },
      }),
      prisma.savedFilter.findMany({
        where: { name: { startsWith: "ZzExclusao" } },
        select: { name: true, ownerId: true },
      }),
      prisma.allowedEmail.count({ where: { email: ALVO } }),
      prisma.user.count({ where: { id: alvo.id } }),
      prisma.userPreference.count({ where: { userId: alvo.id } }),
    ]);

  conferir("a reclamação em aberto passa para quem recebe", depoisAberta?.ownerId, destino.id);
  conferir("a encerrada fica sem responsável", depoisFechada?.ownerId, null);
  conferir("a tarefa pendente passa para quem recebe", tarefa?.ownerId, destino.id);
  conferir(
    "o comentário continua, com o nome de quem escreveu",
    [comentario?.authorId, comentario?.authorName, comentario?.body],
    [null, "Pessoa Excluída", "Liguei e combinei o estorno."]
  );
  conferir(
    "o filtro pessoal sai; o compartilhado fica, sem dono",
    filtros.map((f) => [f.name, f.ownerId]),
    [["ZzExclusao compartilhado", null]]
  );
  conferir("o e-mail deixa de estar liberado", liberado, 0);
  conferir("a conta sai", conta, 0);
  conferir("e as preferências vão junto", preferencia, 0);
}

/** A trava do último administrador, num banco de roteiro. */
async function ultimoAdministrador() {

  console.log("\n  A TRAVA DO ÚLTIMO ADMINISTRADOR — banco de roteiro\n");

  let apagou = false;

  const roteiro = {
    user: {
      findUnique: async () => ({
        id: "admin-unico",
        name: "Única Administradora",
        email: "unica@cardapioweb.com",
        role: "ADMIN",
        active: true,
      }),
      count: async () => 0,
      delete: async () => {
        apagou = true;
      },
    },
  } as unknown as PrismaClient;

  const resultado = await excluirUsuario(roteiro, {
    alvoId: "admin-unico",
    executorId: "outra-pessoa",
    destinoId: null,
  });

  conferir("a última conta de administrador ativa não sai", resultado.ok, false);
  conferir("e nada é apagado", apagou, false);
}

async function main() {

  await ultimoAdministrador();

  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;

  if (!url) {
    console.log("\n  --   sem banco: a parte contra o banco depende dele\n");
  } else {
    const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

    try {
      await limpar(prisma);
      await contra(prisma);
    } finally {
      await limpar(prisma);
      await prisma.$disconnect();
    }
  }

  console.log(
    falhas === 0
      ? "\n  Excluir leva a conta, e o trabalho fica com quem continua.\n"
      : `\n  ${falhas} ponto(s) em que excluir levaria o que não devia.\n`
  );

  process.exitCode = falhas === 0 ? 0 : 1;
}

main().catch((erro) => {
  console.error("\n  Erro:", erro);
  process.exitCode = 1;
});
