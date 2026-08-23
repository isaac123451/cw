/**
 * Despeja num JSON tudo que a carga completa apagaria.
 *
 *   npm run db:backup
 *
 * Existe por um motivo simples: `import-ra-completo.ts` **apaga** as
 * reclamações, os clientes e os estabelecimentos antes de gravar a base
 * nova. Se a planilha vier errada, sem isto não há de onde voltar — o
 * banco é o único lugar onde esses registros existem.
 *
 * O arquivo sai com data e hora no nome, para uma segunda execução não
 * escrever por cima da primeira.
 */
import "dotenv/config";

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

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

async function main() {

  const dados = {
    geradoEm: new Date().toISOString(),
    cases: await prisma.case.findMany({
      include: {
        tags: { include: { tag: true } },
        comments: true,
        movements: true,
      },
    }),
    establishments:
      await prisma.establishment.findMany(),
    clientProfiles:
      await prisma.clientProfile.findMany(),
    companies: await prisma.company.findMany(),
  };

  const nome = `backup-${new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .slice(0, 19)}.json`;

  const caminho = resolve(process.cwd(), nome);

  writeFileSync(
    caminho,
    JSON.stringify(dados, null, 1),
    "utf8"
  );

  console.log(
    `\n  ${dados.cases.length} reclamações, ${dados.establishments.length} estabelecimentos, ${dados.clientProfiles.length} clientes e ${dados.companies.length} empresas`
  );

  console.log(`  → ${caminho}\n`);
}

main()
  .catch((erro) => {
    console.error(erro);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
