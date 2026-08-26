/**
 * Tira da base os estabelecimentos que nasceram de nome de consumidor.
 *
 *   npm run limpar:estabelecimentos           (só mostra)
 *   npm run limpar:estabelecimentos -- --apagar
 *
 * O Isaac apontou duas vezes: "mais uma vez você adicionou nome do
 * cliente como estabelecimento, caso não tivesse naquela planilha que te
 * enviei, não era para estar com conta vinculada, mas sim está faltando.
 * exclua todos os estabelecimentos que você criou com nome de pessoas e
 * só foi para complementar cadastro."
 *
 * A regra que ele deu é clara e vale escrever inteira: **a planilha de
 * estabelecimentos é a fonte.** Reclamação cujo documento não casa com
 * nenhum cadastro dela não vira cadastro novo — ela fica sem
 * estabelecimento, e essa ausência é a informação. Ela diz "está
 * faltando este restaurante na planilha", que é acionável. Um cadastro
 * inventado a partir do nome do consumidor diz "está tudo certo", que é
 * mentira, e ainda polui o cadastro com 300 lojas que não existem.
 *
 * ---
 *
 * Como se reconhece o que foi inventado:
 *
 *  1. **Sem documento e sem id do CW Engine.** Tudo que veio da planilha
 *     tem pelo menos um dos dois — 233 dos 239 têm documento. Um
 *     cadastro sem nenhuma das duas âncoras não veio de lá.
 *
 *  2. **O nome é igual ao `customer` de alguma reclamação.** É a marca
 *     do que foi criado para "completar" um caso: o nome saiu do
 *     consumidor, não do restaurante.
 *
 * As duas juntas, e não cada uma sozinha. Só a primeira apagaria
 * restaurante de verdade cadastrado à mão sem documento; só a segunda
 * apagaria a loja cujo dono usa o próprio nome como razão social — que
 * existe, e nesta base existe bastante.
 *
 * ---
 *
 * **Desvincular vem antes de apagar, e é o passo que importa.** As
 * reclamações apontam para esses cadastros; apagar sem soltar deixaria o
 * banco recusar (a chave estrangeira) ou, pior, levaria a reclamação
 * junto. O que se quer é a reclamação **sem** estabelecimento, esperando
 * o cadastro certo.
 */

import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { normalizarNome } from "../lib/services/contato.service";

const apagar = process.argv.includes("--apagar");

async function main() {

  const prisma = new PrismaClient({
    adapter: new PrismaPg({
      connectionString:
        process.env.DIRECT_URL || process.env.DATABASE_URL,
    }),
  });

  console.log(
    "\n  ESTABELECIMENTOS INVENTADOS — nome de pessoa virou cadastro\n"
  );

  const estabelecimentos =
    await prisma.establishment.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        document: true,
        externalId: true,
        portalUrl: true,
        mrrCents: true,
        _count: { select: { cases: true } },
      },
    });

  const casos = await prisma.case.findMany({
    select: { customer: true },
  });

  /** Nomes de consumidor, normalizados, para casar sem acento. */
  const consumidores = new Set(
    casos
      .map((c) => normalizarNome(c.customer))
      .filter(Boolean)
  );

  const suspeitos = estabelecimentos.filter((e) => {

    const semAncora =
      !e.document?.trim() && !e.externalId?.trim();

    const nomeDeConsumidor = consumidores.has(
      normalizarNome(e.name)
    );

    return semAncora && nomeDeConsumidor;
  });

  console.log(
    `  ${estabelecimentos.length} estabelecimento(s) na base`
  );
  console.log(
    `  ${estabelecimentos.filter((e) => e.document?.trim()).length} com documento`
  );
  console.log(
    `  ${estabelecimentos.filter((e) => e.externalId?.trim()).length} com id do CW Engine`
  );
  console.log("");

  if (suspeitos.length === 0) {
    console.log(
      "  Nenhum cadastro sem âncora com nome de consumidor. Nada a fazer.\n"
    );
    await prisma.$disconnect();
    return;
  }

  console.log(
    `  ${suspeitos.length} cadastro(s) sem documento, sem id do CW Engine e com nome`
  );
  console.log("  igual ao de um consumidor da base:\n");

  suspeitos.slice(0, 20).forEach((e) =>
    console.log(
      `    ${e.name.padEnd(42).slice(0, 42)} ${String(e._count.cases).padStart(3)} caso(s)`
    )
  );

  if (suspeitos.length > 20) {
    console.log(
      `    … e mais ${suspeitos.length - 20}`
    );
  }

  const casosLigados = suspeitos.reduce(
    (soma, e) => soma + e._count.cases,
    0
  );

  console.log("");
  console.log(
    `  ${casosLigados} reclamação(ões) apontam para eles e vão ficar sem estabelecimento.`
  );
  console.log(
    "  É o estado certo: a ausência diz que o restaurante falta na planilha."
  );

  /**
   * Cadastro inventado com receita registrada é um caso à parte.
   *
   * Se alguém preencheu MRR ali, aquilo deixou de ser só ruído de
   * importação — tem informação que não está em mais lugar nenhum.
   * Apagar levaria junto, então ele fica de fora e é listado.
   */
  const comReceita = suspeitos.filter(
    (e) => (e.mrrCents ?? 0) > 0
  );

  if (comReceita.length > 0) {
    console.log("");
    console.log(
      `  ${comReceita.length} deles têm receita registrada e **não** serão apagados:`
    );
    comReceita.forEach((e) =>
      console.log(
        `    ${e.name} — R$ ${((e.mrrCents ?? 0) / 100).toFixed(2)}/mês`
      )
    );
  }

  const paraApagar = suspeitos.filter(
    (e) => (e.mrrCents ?? 0) === 0
  );

  if (!apagar) {
    console.log("");
    console.log(
      `  Nada foi alterado. Para apagar os ${paraApagar.length}:`
    );
    console.log(
      "    npm run limpar:estabelecimentos -- --apagar\n"
    );
    await prisma.$disconnect();
    return;
  }

  const ids = paraApagar.map((e) => e.id);

  /* Solta as reclamações antes — ver o comentário do topo. */
  const soltas = await prisma.case.updateMany({
    where: { establishmentId: { in: ids } },
    data: { establishmentId: null },
  });

  const removidos = await prisma.establishment.deleteMany({
    where: { id: { in: ids } },
  });

  console.log("");
  console.log(
    `  ${soltas.count} reclamação(ões) desvinculada(s).`
  );
  console.log(
    `  ${removidos.count} cadastro(s) removido(s).`
  );

  const sobrou = await prisma.establishment.count();

  console.log(
    `  ${sobrou} estabelecimento(s) na base agora.\n`
  );

  await prisma.$disconnect();
}

main();
