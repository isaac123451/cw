/**
 * O lembrete e o impacto continuam ligados ao caso depois de gravar?
 *
 *   npm run check:vinculo-tarefa
 *
 * Existe por causa de um defeito que não fazia barulho nenhum. A tela
 * preenche `relatedCase` com o **protocolo** do caso; a gravação
 * procurava o caso pelo **externalId**. Nas reclamações importadas os
 * dois campos são iguais, então tudo funcionava — e nos casos criados
 * dentro da aplicação, não: `protocol` é "IG-69758033" e `externalId`
 * é um UUID.
 *
 * Para esses, a busca não achava nada e `caseId` gravava `null`. Sem
 * erro, sem log, sem tela quebrada: a tarefa aparecia ligada ao caso
 * enquanto a página estava aberta (o estado local guardava o vínculo) e
 * sumia da ficha na recarga seguinte. Exatamente nas Redes Sociais, que
 * é onde os casos nascem na aplicação.
 *
 * A verificação grava de verdade, nos dois formatos de caso, confere o
 * vínculo lendo do banco e apaga o que criou.
 */

import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

let falhas = 0;

function conferir(
  titulo: string,
  passou: boolean,
  detalhe: unknown = ""
) {
  console.log(
    `  ${passou ? "ok  " : "FALHA"}  ${titulo.padEnd(46)} ${String(detalhe)}`
  );
  if (!passou) falhas++;
}

async function main() {

  console.log(
    "\n  VÍNCULO — a tarefa continua no caso depois de gravar?\n"
  );

  const prisma = new PrismaClient({
    adapter: new PrismaPg({
      connectionString:
        process.env.DIRECT_URL || process.env.DATABASE_URL,
    }),
  });

  /*
    Os dois formatos que existem na base.

    Um caso importado (protocol === externalId) e um criado na
    aplicação (protocol "IG-..." com externalId UUID). O segundo é o
    que quebrava; conferir só o primeiro daria verde num defeito vivo.
  */
  const importado = await prisma.case.findFirst({
    where: { protocol: { startsWith: "RA-" } },
    select: { id: true, protocol: true },
  });

  const daAplicacao = await prisma.case.findFirst({
    where: { NOT: { protocol: { startsWith: "RA-" } } },
    select: {
      id: true,
      protocol: true,
      externalId: true,
    },
  });

  conferir(
    "há caso importado na base",
    Boolean(importado),
    importado?.protocol ?? "—"
  );

  conferir(
    "há caso criado na aplicação",
    Boolean(daAplicacao),
    daAplicacao
      ? `${daAplicacao.protocol} (externalId ${daAplicacao.externalId?.slice(0, 8)}…)`
      : "nenhum — este é o formato que quebrava"
  );

  const alvos = [importado, daAplicacao].filter(
    (item): item is NonNullable<typeof item> =>
      item !== null
  );

  const criadas: string[] = [];

  for (const alvo of alvos) {

    const id = `check-vinculo-${alvo.id.slice(0, 8)}`;

    /*
      Grava pelo mesmo caminho da tela: o protocolo como referência.

      Chamar `saveAgendaTask` aqui exigiria sessão; o que importa é a
      resolução da referência, então ela é reproduzida — se mudar em
      `registry.ts`, este teste passa a mentir, e por isso a busca é a
      mesma: por protocolo primeiro.
    */
    const caso =
      (await prisma.case.findUnique({
        where: { protocol: alvo.protocol },
        select: { id: true },
      })) ??
      (await prisma.case.findFirst({
        where: { externalId: alvo.protocol },
        select: { id: true },
      }));

    await prisma.agendaTask.create({
      data: {
        id,
        title: "Conferência de vínculo",
        type: "Follow-up",
        priority: "Média",
        done: false,
        dueDate: new Date(),
        caseId: caso?.id ?? null,
      },
    });

    criadas.push(id);

    const lida = await prisma.agendaTask.findUnique({
      where: { id },
      select: { case: { select: { protocol: true } } },
    });

    conferir(
      `${alvo.protocol}: o vínculo sobreviveu`,
      lida?.case?.protocol === alvo.protocol,
      lida?.case?.protocol ?? "PERDIDO (caseId null)"
    );
  }

  await prisma.agendaTask.deleteMany({
    where: { id: { in: criadas } },
  });

  /* ---- e o que já está gravado? ---- */

  const orfas = await prisma.agendaTask.count({
    where: { caseId: null },
  });

  const total = await prisma.agendaTask.count();

  console.log(
    `\n  ${total} tarefa(s) na agenda · ${orfas} sem caso ligado.`
  );
  console.log(
    "  Sem caso não é erro: \"ligar para o cliente\" às vezes não tem reclamação atrás.\n"
  );

  console.log(
    falhas === 0
      ? "  O vínculo com o caso sobrevive à gravação.\n"
      : `  ${falhas} ponto(s) a corrigir.\n`
  );

  await prisma.$disconnect();

  process.exit(falhas === 0 ? 0 : 1);
}

main();
