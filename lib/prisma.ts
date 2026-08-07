import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as {
  prisma?: PrismaClient;
};

/**
 * O banco é opcional: sem `DATABASE_URL` a aplicação roda com os dados
 * de demonstração em memória. `getPrisma()` devolve `null` nesse caso,
 * em vez de estourar já no import.
 */
export function hasDatabase() {
  return Boolean(process.env.DATABASE_URL);
}

export function getPrisma(): PrismaClient | null {

  if (!hasDatabase()) return null;

  if (globalForPrisma.prisma) return globalForPrisma.prisma;

  const client = new PrismaClient({
    adapter: new PrismaPg({
      connectionString: process.env.DATABASE_URL,
    }),
    log: ["error"],
  });

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = client;
  }

  return client;
}
