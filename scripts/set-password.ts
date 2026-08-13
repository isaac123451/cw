/**
 * Redefine a senha de um usuário, com hash correto.
 *
 *   npm run db:password -- <e-mail>
 *
 * Gera uma senha forte, grava o hash bcrypt e imprime a senha **uma
 * vez**. Existe para ninguém precisar mexer em `passwordHash` pelo
 * editor de tabelas: valor escrito ali vira texto puro, e aí a conta
 * recusa qualquer senha, porque `bcrypt.compare` nunca casa com algo
 * que não é hash.
 */
import "dotenv/config";

import { randomBytes } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

import { isBcryptHash } from "../lib/auth/hash";

const email = process.argv[2]?.trim().toLowerCase();

if (!email) {
  console.error(
    "\n  Uso: npm run db:password -- <e-mail>\n"
  );
  process.exit(1);
}

const url =
  process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!url) {
  console.error(
    "\n  DATABASE_URL/DIRECT_URL não configuradas.\n"
  );
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: url }),
});

/** Sem caracteres que quebram URL ou confundem na leitura. */
function gerarSenha() {
  return randomBytes(12)
    .toString("base64")
    .replace(/[+/=]/g, "")
    .slice(0, 16);
}

async function main() {

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      name: true,
      email: true,
      passwordHash: true,
    },
  });

  if (!user) {
    console.error(
      `\n  Nenhum usuário com o e-mail ${email}.\n`
    );
    process.exit(1);
  }

  const estavaCorrompido = !isBcryptHash(
    user.passwordHash
  );

  const senha = gerarSenha();

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(senha, 10) },
  });

  console.log("");

  if (estavaCorrompido) {
    console.log(
      "  A senha anterior NÃO estava em formato bcrypt — foi gravada\n" +
        "  direto no banco. Corrigido agora.\n"
    );
  }

  console.log(`  Usuário: ${user.name} <${user.email}>`);
  console.log(`  Senha:   ${senha}`);
  console.log(
    "\n  Anote e troque no portal, em Minha conta -> Senha.\n"
  );
}

main()
  .catch((e) => {
    console.error(`\n  FALHOU: ${e.message}\n`);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
