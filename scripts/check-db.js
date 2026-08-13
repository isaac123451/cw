/**
 * Testa a conexão com o banco sem exibir a connection string.
 *
 *   npm run db:check
 *
 * Diz se conectou, em qual host, e o que já existe lá dentro. Serve para
 * conferir a configuração sem expor senha em terminal ou log.
 */
require("dotenv/config");

const { Client } = require("pg");

const url =
  process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!url || url.includes("COLE_A_STRING_AQUI")) {
  console.error(
    "\n  DATABASE_URL/DIRECT_URL ainda não configuradas no .env.\n"
  );
  process.exit(1);
}

/** Host e porta são úteis para diagnóstico e não são segredo. */
function descrever(connectionString) {
  try {
    const u = new URL(connectionString);
    return {
      host: u.hostname,
      porta: u.port || "5432",
      banco: u.pathname.replace("/", "") || "(padrão)",
      usuario: u.username,
    };
  } catch {
    return null;
  }
}

const alvo = descrever(url);

if (!alvo) {
  console.error(
    "\n  A string configurada não é uma URL válida.\n" +
      "  Esperado: postgresql://usuario:senha@host:porta/banco\n"
  );
  process.exit(1);
}

console.log("");
console.log(`  Host:    ${alvo.host}`);
console.log(`  Porta:   ${alvo.porta}`);
console.log(`  Banco:   ${alvo.banco}`);
console.log(`  Usuário: ${alvo.usuario}`);

if (alvo.porta === "6543") {
  console.log(
    "\n  Aviso: porta 6543 é o pooler de transação. Migração e seed\n" +
      "  precisam de DIRECT_URL na porta 5432."
  );
}

const client = new Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

async function main() {

  await client.connect();

  const { rows: versao } = await client.query(
    "select version()"
  );

  console.log("\n  CONECTOU.");
  console.log(
    `  ${versao[0].version.split(",")[0]}`
  );

  const { rows: tabelas } = await client.query(
    `select table_name from information_schema.tables
      where table_schema = 'public'
      order by table_name`
  );

  if (tabelas.length === 0) {
    console.log(
      "\n  Nenhuma tabela ainda — rode: npm run db:push\n"
    );
    return;
  }

  console.log(`\n  ${tabelas.length} tabela(s):`);

  for (const t of tabelas) {

    const { rows } = await client.query(
      `select count(*)::int as total from public."${t.table_name}"`
    );

    const { rows: rls } = await client.query(
      `select relrowsecurity as ligado from pg_class
        where oid = $1::regclass`,
      [`public."${t.table_name}"`]
    );

    console.log(
      `    ${t.table_name.padEnd(20)} ${String(rows[0].total).padStart(6)} registro(s)` +
        `   RLS: ${rls[0]?.ligado ? "ligado" : "DESLIGADO"}`
    );
  }

  console.log("");
}

main()
  .catch((error) => {
    console.error("\n  FALHOU AO CONECTAR.");
    console.error(`  ${error.message}\n`);

    if (/ENOTFOUND|EAI_AGAIN/.test(error.message)) {
      console.error(
        "  Host não resolveu. Confira se copiou o Session pooler\n" +
          "  (host com 'pooler.supabase.com'), e não o Direct connection.\n"
      );
    }

    if (/password|authentication/i.test(error.message)) {
      console.error(
        "  Senha recusada. O texto [YOUR-PASSWORD] precisa ser\n" +
          "  substituído pela senha real do banco.\n"
      );
    }

    process.exit(1);
  })
  .finally(() => client.end());
