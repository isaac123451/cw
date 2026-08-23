/**
 * Prova a rotina agendada contra a aplicação rodando.
 *
 *   npm run dev        (noutra janela)
 *   npm run check:cron
 *
 * A rotina é a peça mais fácil de quebrar sem ninguém ver: ela roda de
 * madrugada, sem tela aberta, e o sintoma de estar errada é um número
 * que muda sozinho. Três coisas precisam valer, e nenhuma delas aparece
 * no `tsc`:
 *
 * 1. **Ela é protegida.** Encerra ciclo e dispara webhook — sem token,
 *    seria alguém de fora mexendo no indicador.
 * 2. **Ela encerra o que a regra manda, e só isso.** A decisão vem da
 *    mesma `deveEncerrarSemRetorno` da tela; duas cópias fariam a tela e
 *    a rotina discordarem sobre o mesmo ciclo.
 * 3. **Ela é idempotente.** Cron falha e é reexecutado. Rodar duas vezes
 *    não pode encerrar de novo o que já encerrou nem avisar de novo o
 *    mesmo atraso — alerta que se repete sozinho é alerta que se aprende
 *    a ignorar.
 *
 * Trabalha num ciclo de NPS **descartável**, criado e apagado aqui, com
 * 40 dias de idade — velho o bastante para a regra dos 30 dias pegá-lo.
 * Nenhuma resposta real é tocada.
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const base = (
  process.env.CW_BASE ?? "http://localhost:3000"
).replace(/\/$/, "");

const url =
  process.env.DIRECT_URL || process.env.DATABASE_URL;

const token = (
  process.env.CRON_SECRET ??
  process.env.API_TOKEN ??
  ""
).trim();

if (!url) {
  console.error(
    "\n  DATABASE_URL não definido — configure o banco antes.\n"
  );
  process.exit(1);
}

if (!token) {
  console.error(
    "\n  Sem CRON_SECRET nem API_TOKEN no .env — a rotina fica desligada.\n"
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
    `${ok ? "  ok  " : "FALHA "} ${campo.padEnd(46)} ${JSON.stringify(obtido)}`
  );

  if (!ok) {
    console.log(
      `${" ".repeat(7)}${"esperado".padEnd(46)} ${JSON.stringify(esperado)}`
    );
  }
}

const marca = `ZZ Cron ${Date.now().toString(36).toUpperCase()}`;

interface Rodada {
  ok?: boolean;
  nps?: { avaliados: number; encerrados: number };
  movimentacoes?: {
    pendentes: number;
    avisadas: number;
  };
  reenvios?: { pendentes: number; entregues: number };
}

async function rodar(comToken = true) {

  const resposta = await fetch(`${base}/api/cron`, {
    headers: comToken
      ? { Authorization: `Bearer ${token}` }
      : {},
    cache: "no-store",
  });

  const tipo =
    resposta.headers.get("content-type") ?? "";

  if (!tipo.includes("json")) {
    throw new Error(
      `/api/cron respondeu ${resposta.status} em ${tipo || "tipo desconhecido"}, não JSON.`
    );
  }

  return {
    status: resposta.status,
    corpo: (await resposta.json()) as Rodada,
  };
}

async function limpar() {
  await prisma.npsResponse
    .deleteMany({ where: { customer: marca } })
    .catch(() => {});
}

async function main() {

  console.log(`\nContra ${base}. Ciclo: ${marca}\n`);

  /* ---- 1. sem token, não roda ---- */

  const semToken = await rodar(false);

  conferir(
    "sem token, a rotina recusa",
    semToken.status,
    401
  );

  /* ---- 2. um ciclo velho o bastante para a regra pegar ---- */

  const quarentaDiasAtras = new Date(
    Date.now() - 40 * 86400000
  );

  const descartavel = await prisma.npsResponse.create({
    data: {
      score: 4,
      comment: "Registro descartável de conferência.",
      respondedAt: quarentaDiasAtras,
      customer: marca,
      status: "Novo",
      firstContactDueAt: quarentaDiasAtras,
    },
    select: { id: true },
  });

  conferir(
    "o ciclo descartável nasceu aberto",
    (
      await prisma.npsResponse.findUnique({
        where: { id: descartavel.id },
        select: { closedAt: true },
      })
    )?.closedAt,
    null
  );

  /* ---- 3. a rodada encerra o que a regra manda ---- */

  const primeira = await rodar();

  conferir(
    "com token, a rotina roda",
    primeira.status,
    200
  );

  const depois = await prisma.npsResponse.findUnique({
    where: { id: descartavel.id },
    select: {
      status: true,
      outcome: true,
      closedAt: true,
    },
  });

  conferir(
    "o ciclo de 40 dias foi encerrado",
    depois?.status,
    "[Encerrado] Sem Retorno"
  );

  conferir(
    "com desfecho registrado",
    depois?.outcome,
    "[Encerrado] Sem Retorno"
  );

  conferir(
    "e com data de encerramento",
    Boolean(depois?.closedAt),
    true
  );

  console.log(
    `\n  rodada 1: ${JSON.stringify(primeira.corpo.nps)}\n`
  );

  /* ---- 4. rodar de novo não repete trabalho ---- */

  const segunda = await rodar();

  /**
   * A segunda rodada é a prova que importa.
   *
   * Cron falha e é reexecutado. Uma rotina que encerra de novo o que já
   * encerrou reescreve `closedAt` toda madrugada — e a data de
   * encerramento, que é o que sustenta o tempo médio de resolução,
   * passa a ser a data da última execução do cron.
   */
  conferir(
    "a segunda rodada não encerra nada de novo",
    segunda.corpo.nps?.encerrados,
    0
  );

  const fechadoEm = depois?.closedAt?.toISOString();

  conferir(
    "e não reescreveu a data de encerramento",
    (
      await prisma.npsResponse.findUnique({
        where: { id: descartavel.id },
        select: { closedAt: true },
      })
    )?.closedAt?.toISOString(),
    fechadoEm
  );

  conferir(
    "movimentação: nada pendente para avisar de novo",
    segunda.corpo.movimentacoes?.avisadas,
    0
  );

  /* ---- limpeza ---- */

  await limpar();

  conferir(
    "ciclo descartável saiu da base",
    await prisma.npsResponse.findFirst({
      where: { customer: marca },
    }),
    null
  );

  await prisma.$disconnect();

  console.log(
    falhas === 0
      ? "\nA rotina agendada faz o que promete, e só uma vez.\n"
      : `\n${falhas} conferência(s) fora do esperado.\n`
  );

  process.exit(falhas === 0 ? 0 : 1);
}

main().catch(async (erro) => {

  console.error(
    "\n  Falhou:",
    erro instanceof Error ? erro.message : erro
  );

  console.error(
    `\n  A aplicação está no ar em ${base}? Suba com "npm run dev".\n`
  );

  await limpar().catch(() => {});
  await prisma.$disconnect();
  process.exit(1);
});
