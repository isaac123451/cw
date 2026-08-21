/**
 * Prova o que acontece ao mover um caso de etapa.
 *
 *   npm run check:mover
 *
 * Existe por causa de uma regra com consequência silenciosa: duas
 * colunas do quadro — "Resolvido" e "Não resolvido" — **são** a
 * avaliação do consumidor. Voltar um caso para antes delas apaga a
 * nota, senão ela continuaria pesando na reputação de um caso que,
 * segundo o próprio quadro, ainda não foi avaliado.
 *
 * A extensão passou a mover caso por `/api/extensao/mover`, e a regra
 * saiu para `moverPara` justamente para não existir em duas cópias.
 * Este script confere as duas pontas contra o banco de verdade.
 *
 * Trabalha num caso **descartável**, criado e apagado aqui. Nenhuma
 * reclamação real é tocada.
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { Case } from "../lib/models/case";
import {
  etapaVizinha,
  moverPara,
} from "../lib/services/case.service";
import {
  fetchCaseByProtocol,
  persistCase,
} from "../lib/services/case.repository";

const url =
  process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!url) {
  console.error(
    "\n  DATABASE_URL não definido — configure o banco antes.\n"
  );
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: url }),
});

let falhas = 0;

function conferir(
  campo: string,
  obtido: unknown,
  esperado: unknown
) {

  const ok =
    JSON.stringify(obtido) === JSON.stringify(esperado);

  if (!ok) falhas += 1;

  console.log(
    `${ok ? "  ok  " : "FALHA "} ${campo.padEnd(38)} ${JSON.stringify(obtido)}`
  );

  if (!ok) {
    console.log(
      `${" ".repeat(7)}${"esperado".padEnd(38)} ${JSON.stringify(esperado)}`
    );
  }
}

const marca = `ZZ-TESTE-${Date.now().toString(36).toUpperCase()}`;

async function main() {

  /* ---- as etapas ativas, na ordem do quadro ---- */

  const etapas = (
    await prisma.workflowStatus.findMany({
      where: { active: true },
      orderBy: { order: "asc" },
      select: { name: true },
    })
  ).map((e) => e.name);

  console.log("\nEtapas ativas:", etapas.join(" → "), "\n");

  conferir(
    "há etapas cadastradas",
    etapas.length > 1,
    true
  );

  /* ---- a vizinhança, sem tocar no banco ---- */

  conferir(
    "avança uma etapa",
    etapaVizinha(etapas, etapas[0], "avancar"),
    etapas[1]
  );

  conferir(
    "volta uma etapa",
    etapaVizinha(etapas, etapas[1], "voltar"),
    etapas[0]
  );

  /**
   * Não circula. Um caso na primeira coluna que "voltasse" para a
   * última seria a forma mais rápida de dar baixa sem querer numa
   * reclamação que ninguém atendeu.
   */
  conferir(
    "primeira etapa não volta para a última",
    etapaVizinha(etapas, etapas[0], "voltar"),
    null
  );

  conferir(
    "última etapa não avança para a primeira",
    etapaVizinha(
      etapas,
      etapas[etapas.length - 1],
      "avancar"
    ),
    null
  );

  conferir(
    "status fora do quadro não tem vizinha",
    etapaVizinha(etapas, "Etapa Que Não Existe", "avancar"),
    null
  );

  /* ---- ida e volta no banco ---- */

  console.log("\nCaso descartável, no banco\n");

  const base: Case = {
    id: marca,
    protocol: marca,
    company: "Cliente de teste",
    customer: "Cliente de teste",
    source: "Reclame Aqui",
    category: "Não classificado",
    priority: "Alta",
    status: etapas[0],
    title: `Caso descartável ${marca}`,
    description: "",
    publicResponse: "",
    evaluated: false,
    resolved: false,
    wouldDoBusiness: false,
    sla: "48h",
    createdAt: "2026-08-01",
    updatedAt: "2026-08-01",
  };

  await persistCase(prisma, base, { syncTags: false });

  /**
   * Vai para "Resolvido" e ganha nota — é o retrato de um caso que o
   * consumidor avaliou.
   */
  const avaliado = moverPara(
    { ...base, score: 10 },
    "Resolvido",
    "2026-08-20"
  );

  await persistCase(prisma, avaliado, {
    syncTags: false,
  });

  const noBanco = await fetchCaseByProtocol(
    prisma,
    marca
  );

  conferir("status gravado", noBanco?.status, "Resolvido");
  conferir("resolvido", noBanco?.resolved, true);
  conferir("avaliado", noBanco?.evaluated, true);
  conferir("nota mantida", noBanco?.score, 10);

  /**
   * Agora o que importa: voltar para antes da avaliação **apaga a
   * nota**. Sem isso, a reputação continuaria contando a nota de um
   * caso que o quadro diz que ainda não foi avaliado.
   */
  const voltou = moverPara(
    noBanco!,
    etapas[0],
    "2026-08-21"
  );

  conferir(
    "ao voltar, a nota sai do modelo",
    voltou.score,
    undefined
  );
  conferir(
    "ao voltar, deixa de ser avaliado",
    voltou.evaluated,
    false
  );
  conferir(
    "ao voltar, deixa de ser resolvido",
    voltou.resolved,
    false
  );

  await persistCase(prisma, voltou, { syncTags: false });

  const depois = await fetchCaseByProtocol(prisma, marca);

  conferir(
    "e a nota some do banco também",
    depois?.score,
    undefined
  );
  conferir("status de volta", depois?.status, etapas[0]);

  /**
   * A outra ponta: "Não resolvido" também é avaliação, e mover para lá
   * **não** pode apagar nota nenhuma.
   */
  const naoResolvido = moverPara(
    { ...depois!, score: 3 },
    "Não resolvido",
    "2026-08-21"
  );

  conferir(
    "'Não resolvido' preserva a nota",
    naoResolvido.score,
    3
  );
  conferir(
    "'Não resolvido' conta como avaliado",
    naoResolvido.evaluated,
    true
  );
  conferir(
    "'Não resolvido' não é resolvido",
    naoResolvido.resolved,
    false
  );

  await prisma.case.delete({
    where: { protocol: marca },
  });

  conferir(
    "caso descartável saiu da base",
    await prisma.case.findUnique({
      where: { protocol: marca },
    }),
    null
  );

  await prisma.$disconnect();

  console.log(
    falhas === 0
      ? "\nMover de etapa se comporta como o quadro promete.\n"
      : `\n${falhas} conferência(s) fora do esperado.\n`
  );

  process.exit(falhas === 0 ? 0 : 1);
}

main().catch(async (erro) => {
  console.error("\n  Falhou:", erro);

  // Não deixa lixo para trás nem quando quebra no meio.
  await prisma.case
    .deleteMany({ where: { protocol: marca } })
    .catch(() => {});

  await prisma.$disconnect();
  process.exit(1);
});
