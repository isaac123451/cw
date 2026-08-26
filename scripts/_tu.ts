import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
const p = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL! }) });
const EMAIL = "conferencia-tela@cardapioweb.com";
(async () => {
  if (process.argv[2] === "remover") {
    await p.loginChallenge.deleteMany({ where: { user: { email: EMAIL } } });
    await p.case.updateMany({ where: { owner: { email: EMAIL } }, data: { ownerId: null } });
    await p.npsResponse.updateMany({ where: { owner: { email: EMAIL } }, data: { ownerId: null } });
    await p.user.deleteMany({ where: { email: EMAIL } });
    await p.allowedEmail.deleteMany({ where: { email: EMAIL } });
    console.log("removido");
  } else {
    await p.user.deleteMany({ where: { email: EMAIL } });
    await p.allowedEmail.upsert({ where: { email: EMAIL }, update: {}, create: { email: EMAIL, note: "conferência" } });
    await p.user.create({ data: { email: EMAIL, name: "Conferência", passwordHash: await bcrypt.hash("SenhaDeTeste!2026", 10), role: "ADMIN", active: true } });
    console.log("criado");
  }
  await p.$disconnect();
})();
