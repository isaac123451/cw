/**
 * Importa o NPS do Wootric para o banco.
 *
 *   npm run nps:wootric                 # últimos 7 dias
 *   npm run nps:wootric -- --dias=90    # janela maior
 *   npm run nps:wootric -- --dias=365 --seco
 *
 * O botão da tela faz a rodada curta do dia a dia. Este script existe
 * para as janelas grandes: são ~790 respostas por mês, e uma server
 * action chamada pelo navegador não tem tempo de vida para milhares de
 * gravações. É também o que um cron chamaria.
 *
 * `--seco` lê do Wootric e mostra o que faria, sem gravar nada.
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import {
  listarRespostas,
  RespostaImportada,
  temWootric,
  traduzir,
} from "../lib/services/wootric.service";

import { prazoPrimeiroContato } from "../lib/services/nps.service";
import { STATUS_SEM_TRATATIVA } from "../lib/models/nps";

const args = process.argv.slice(2);

const seco = args.includes("--seco");

const diasArg = args.find((a) =>
  a.startsWith("--dias=")
);

const dias = diasArg
  ? Math.max(Number(diasArg.split("=")[1]) || 7, 1)
  : 7;

if (!temWootric()) {
  console.error(
    "\n  WOOTRIC_CLIENT_ID e WOOTRIC_CLIENT_SECRET não configurados no .env.\n"
  );
  process.exit(1);
}

const url =
  process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!url) {
  console.error(
    "\n  DATABASE_URL não definido — não há onde gravar.\n"
  );
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: url }),
});

function pt(data: Date) {
  return data.toISOString().slice(0, 16).replace("T", " ");
}

async function main() {

  const desde = new Date(Date.now() - dias * 86400000);

  console.log("");
  console.log(
    `  Janela: últimos ${dias} dia(s), a partir de ${pt(desde)} UTC`
  );
  console.log(
    seco ? "  Modo seco: nada será gravado.\n" : ""
  );

  const brutas = await listarRespostas(desde, (lidas) => {
    process.stdout.write(
      `\r  Lendo do Wootric: ${lidas} resposta(s)...`
    );
  });

  process.stdout.write("\r" + " ".repeat(60) + "\r");

  const itens = brutas
    .map(traduzir)
    .filter(
      (i): i is RespostaImportada => i !== null
    );

  const comTratativa = itens.filter(
    (i) => i.exigeTratativa
  ).length;

  console.log(`  Lidas:      ${brutas.length}`);
  console.log(
    `  Aproveitáveis: ${itens.length}  (${brutas.length - itens.length} fora do cálculo do próprio Wootric)`
  );
  console.log(
    `  Exigem tratativa: ${comTratativa}  ·  promotor calado: ${itens.length - comTratativa}`
  );

  if (itens.length === 0) {
    console.log("\n  Nada a fazer.\n");
    return;
  }

  const existentes = new Set(
    (
      await prisma.npsResponse.findMany({
        where: {
          externalId: {
            in: itens.map((i) => i.externalId),
          },
        },
        select: { externalId: true },
      })
    ).map((r) => r.externalId as string)
  );

  const novas = itens.filter(
    (i) => !existentes.has(i.externalId)
  );

  console.log(
    `  Novas: ${novas.length}  ·  já existentes: ${existentes.size}`
  );

  if (seco) {
    console.log("\n  Modo seco — nada gravado.\n");
    return;
  }

  let feitas = 0;

  /**
   * Cinco por vez: é o teto que o pooler do Supabase no plano gratuito
   * aguenta, o mesmo já usado na importação do Reclame Aqui.
   */
  for (let i = 0; i < itens.length; i += 5) {

    await Promise.all(
      itens.slice(i, i + 5).map(async (item) => {

        const doWootric = {
          score: item.score,
          comment: item.comment,
          respondedAt: item.respondedAt,
          customer: item.customer,
          email: item.email || null,
          phone: item.phone || null,
          company: item.company || null,
          externalCompanyId:
            item.externalCompanyId || null,
          source: "Wootric",
        };

        if (existentes.has(item.externalId)) {
          await prisma.npsResponse.update({
            where: { externalId: item.externalId },
            data: doWootric,
          });
          return;
        }

        await prisma.npsResponse.create({
          data: {
            ...doWootric,
            externalId: item.externalId,
            firstContactDueAt: prazoPrimeiroContato(
              item.respondedAt,
              item.score,
              null
            ),
            status: item.exigeTratativa
              ? "Novo"
              : STATUS_SEM_TRATATIVA,
            closedAt: item.exigeTratativa
              ? null
              : item.respondedAt,
            outcome: item.exigeTratativa
              ? null
              : STATUS_SEM_TRATATIVA,
          },
        });
      })
    );

    feitas += Math.min(5, itens.length - i);

    process.stdout.write(
      `\r  Gravando: ${feitas}/${itens.length}`
    );
  }

  process.stdout.write("\r" + " ".repeat(60) + "\r");

  const total = await prisma.npsResponse.count();

  console.log(`  Gravadas: ${itens.length}`);
  console.log(`  Total na base agora: ${total}`);
  console.log("");
}

main()
  .catch((erro) => {
    console.error("\n  FALHOU:", erro.message, "\n");
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
