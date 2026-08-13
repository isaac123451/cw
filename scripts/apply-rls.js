/**
 * Liga o Row Level Security em todas as tabelas do schema `public`.
 *
 *   npm run db:rls
 *
 * Rode depois de `db:push`. A lista de tabelas vem do próprio banco, e
 * não de um arquivo fixo: schema novo nasce protegido sem ninguém
 * precisar lembrar de atualizar uma lista.
 *
 * Por que é preciso: o Supabase publica o schema `public` por uma API
 * REST (PostgREST) acessível com a chave anônima, que por natureza é
 * pública. Sem RLS, quem tiver essa chave lê e escreve nestas tabelas.
 *
 * Por que não quebra a aplicação: o Prisma conecta como `postgres`, dono
 * das tabelas, e o dono não é submetido às políticas de RLS. Sem policy
 * nenhuma, o efeito é PostgREST bloqueado e aplicação funcionando igual.
 *
 * Também regrava `prisma/rls.sql`, para quem preferir colar no SQL
 * Editor do Supabase.
 */
require("dotenv/config");

const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const url =
  process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!url || url.includes("COLE_A_STRING_AQUI")) {
  console.error(
    "\n  DATABASE_URL/DIRECT_URL não configuradas no .env.\n"
  );
  process.exit(1);
}

const client = new Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

async function main() {

  await client.connect();

  const { rows: tabelas } = await client.query(
    `select c.relname as tabela
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relkind = 'r'
        and c.relname not like '\\_prisma%'
      order by c.relname`
  );

  if (tabelas.length === 0) {
    console.error(
      "\n  Nenhuma tabela encontrada — rode: npm run db:push\n"
    );
    process.exit(1);
  }

  const comandos = tabelas.map(
    (t) =>
      `ALTER TABLE public."${t.tabela}" ENABLE ROW LEVEL SECURITY;`
  );

  await client.query(comandos.join("\n"));

  // Arquivo de apoio, para o caminho manual pelo painel.
  fs.writeFileSync(
    path.join(process.cwd(), "prisma/rls.sql"),
    `-- Row Level Security — CW Reputação\n` +
      `-- Gerado por scripts/apply-rls.js (${tabelas.length} tabelas).\n` +
      `-- Preferir: npm run db:rls\n\n` +
      comandos.join("\n") +
      "\n"
  );

  const { rows: conferencia } = await client.query(
    `select c.relname as tabela, c.relrowsecurity as ligado
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'
        and c.relname not like '\\_prisma%'
      order by c.relname`
  );

  const desligadas = conferencia.filter(
    (r) => !r.ligado
  );

  console.log(
    `\n  RLS ligado em ${conferencia.length - desligadas.length} de ${conferencia.length} tabelas.`
  );

  if (desligadas.length > 0) {
    console.log("\n  AINDA DESLIGADO:");
    desligadas.forEach((r) =>
      console.log(`    - ${r.tabela}`)
    );
    process.exitCode = 1;
    return;
  }

  console.log("");
}

main()
  .catch((error) => {
    console.error(`\n  FALHOU: ${error.message}\n`);
    process.exit(1);
  })
  .finally(() => client.end());
