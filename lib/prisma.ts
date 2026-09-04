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

/**
 * Quantas conexões cada instância abre.
 *
 * O adaptador cria um `pg.Pool`, e o padrão dele é **10**. Num
 * servidor único isso é razoável; em função serverless, não: cada
 * instância viva abre até dez conexões contra o mesmo pooler do
 * Supabase, e o plano gratuito tem teto baixo de clientes. Medido em
 * 03/09/2026 pelo `npm run check:banco`: vinte conexões simultâneas no
 * pooler de sessão já derrubam cinco com `max clients reached`.
 *
 * Cinco é o meio-termo com motivo. Uma carga de tela chega a disparar
 * dezessete consultas em paralelo (`loadWorkspace`); com `max: 1` elas
 * virariam dezessete idas e voltas em fila — cinco segundos de espera
 * com o banco ocioso. Com cinco, elas se paralelizam sem cada instância
 * virar um consumidor de dez conexões.
 */
const CONEXOES = Number(process.env.DB_POOL_MAX) || 5;

export function getPrisma(): PrismaClient | null {

  if (!hasDatabase()) return null;

  if (globalForPrisma.prisma) return globalForPrisma.prisma;

  const client = new PrismaClient({
    adapter: new PrismaPg({
      connectionString: process.env.DATABASE_URL,
      max: CONEXOES,

      /**
       * Sem este teto, pool cheio significa **esperar para sempre**.
       *
       * É a diferença entre a tela dizer "não consegui carregar" e a
       * tela ficar girando — que foi o relato: "ou demora para carregar
       * ou nem carrega". Falhar em dez segundos com erro é pior que
       * funcionar e muito melhor que pendurar, porque pelo menos
       * aparece no log e na tela.
       */
      connectionTimeoutMillis: 10_000,

      /* Conexão ociosa devolvida ao pooler libera vaga para outra instância. */
      idleTimeoutMillis: 30_000,
    }),
    log: ["error"],
  });

  /**
   * O cliente é guardado **também em produção**, e essa é a correção.
   *
   * A linha era `if (process.env.NODE_ENV !== "production")`, copiada do
   * exemplo clássico do Next — cujo objetivo é impedir que o
   * *hot reload* crie dezenas de clientes em desenvolvimento. Em
   * serverless o efeito é o oposto do desejado: cada chamada de
   * `getPrisma()` construía um `PrismaClient` novo, com um pool novo,
   * que abria conexões novas e nunca as reaproveitava.
   *
   * É por isso que localmente tudo voava e na Vercel a mesma tela
   * demorava ou não carregava: em desenvolvimento o cliente era
   * reaproveitado, em produção não. Uma instância morna que reaproveita
   * paga ~110 ms por consulta; uma que reconecta paga ~1.500 ms só no
   * aperto de mão — medido em `npm run check:banco`.
   */
  globalForPrisma.prisma = client;

  return client;
}
