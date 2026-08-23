/**
 * Mede o que a operação espera, contra o banco real.
 *
 *   npm run check:desempenho
 *
 * A base triplicou em 23/08 — 127 para 340 reclamações, 105 para 239
 * estabelecimentos. Consulta que era rápida com 127 pode não ser com
 * 340, e o jeito de descobrir isso não é abrir a tela e achar que
 * "parece ok": é medir, e ter um teto que falha quando é ultrapassado.
 *
 * **Os tetos são de percepção, não de banco.** Cem milissegundos é o
 * limite em que uma ação parece instantânea; um segundo é o limite em
 * que a pessoa continua com a linha de raciocínio. Estão folgados de
 * propósito — isto existe para pegar regressão de ordem de grandeza,
 * não para reprovar uma variação de rede.
 *
 * O que **não** é medido aqui: a renderização no navegador. Para isso
 * existe o SpeedInsights, que reporta o tempo real de quem usa.
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import {
  fetchCandidateCases,
  fetchCases,
} from "../lib/services/case.repository";

const url =
  process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!url) {
  console.error("\n  DATABASE_URL não definido.\n");
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: url }),
});

let falhas = 0;

/**
 * Roda três vezes e fica com a **mediana**.
 *
 * A primeira medição carrega conexão e cache do Postgres; usar só ela
 * mediria o aquecimento. A média seria puxada por qualquer engasgo de
 * rede — a mediana de três é o número que se repete.
 */
async function medir<T>(
  rotulo: string,
  teto: number,
  executar: () => Promise<T>
) {

  const tempos: number[] = [];
  let ultimo: T | undefined;

  for (let i = 0; i < 3; i += 1) {
    const marca = Date.now();
    ultimo = await executar();
    tempos.push(Date.now() - marca);
  }

  tempos.sort((a, b) => a - b);

  const ms = tempos[1];
  const ok = ms <= teto;

  if (!ok) falhas += 1;

  const quantos = Array.isArray(ultimo)
    ? `${ultimo.length} registros`
    : "";

  console.log(
    `${ok ? "  ok  " : "FALHA "} ${rotulo.padEnd(38)} ${String(ms).padStart(5)} ms   teto ${teto} ms   ${quantos}`
  );

  return ultimo;
}

async function main() {

  console.log("\n  DESEMPENHO — o que a operação espera\n");

  const total = await prisma.case.count();

  console.log(
    `  base: ${total} reclamações, ${await prisma.establishment.count()} estabelecimentos, ${await prisma.npsResponse.count()} respostas de NPS\n`
  );

  /* ----------------------------------------------------------
     A carga das telas.
  ---------------------------------------------------------- */

  /**
   * O Kanban e a lista abrem com isto.
   *
   * `fetchCases` omite o relato de propósito — ele só é lido quando a
   * tela do caso abre. Sem essa omissão, as 340 descrições inteiras
   * viajariam a cada abertura do quadro.
   */
  await medir("carga do quadro (fetchCases)", 1500, () =>
    fetchCases(prisma)
  );

  await medir(
    "contagem por etapa (agrupada)",
    400,
    () =>
      prisma.case.groupBy({
        by: ["status"],
        _count: true,
      })
  );

  await medir("cadastro de estabelecimentos", 600, () =>
    prisma.establishment.findMany({
      orderBy: { name: "asc" },
    })
  );

  await medir("respostas de NPS", 1500, () =>
    prisma.npsResponse.findMany({
      orderBy: { respondedAt: "desc" },
    })
  );

  /* ----------------------------------------------------------
     O caminho da extensão, que é o mais sensível.
  ---------------------------------------------------------- */

  /**
   * Quem está com o cliente na linha espera aqui.
   *
   * Este é o teto mais apertado da lista de propósito: o painel abre
   * junto com a conversa, e meio segundo já é percebido como travada.
   */
  const umTelefone = await prisma.case.findFirst({
    where: { phone: { not: null } },
    select: { phone: true },
  });

  if (umTelefone?.phone) {
    await medir(
      "busca por telefone (extensão)",
      700,
      () =>
        fetchCandidateCases(prisma, {
          digitosDoTelefone: umTelefone.phone!.replace(
            /\D/g,
            ""
          ),
        })
    );
  }

  await medir(
    "reclamação pelo protocolo",
    300,
    async () =>
      prisma.case.findFirst({
        where: { protocol: { startsWith: "RA-" } },
        include: { tags: true, comments: true },
      })
  );

  /* ----------------------------------------------------------
     O que cresce sem ninguém olhar.
  ---------------------------------------------------------- */

  console.log("");

  const semIndice = await prisma.$queryRaw<
    { tabela: string; linhas: bigint }[]
  >`
    SELECT relname AS tabela, n_live_tup AS linhas
    FROM pg_stat_user_tables
    WHERE n_live_tup > 100
    ORDER BY n_live_tup DESC
    LIMIT 8
  `;

  console.log("  maiores tabelas:");

  for (const t of semIndice) {
    console.log(
      `    ${t.tabela.padEnd(22)} ${String(Number(t.linhas)).padStart(6)} linhas`
    );
  }
}

main()
  .catch((erro) => {
    falhas += 1;
    console.error("\n  ERRO:", erro);
  })
  .finally(async () => {

    await prisma.$disconnect();

    console.log(
      falhas === 0
        ? "\n  Tudo dentro do teto.\n"
        : `\n  ${falhas} medição(ões) acima do teto.\n`
    );

    process.exit(falhas === 0 ? 0 : 1);
  });
