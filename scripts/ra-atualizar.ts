/**
 * Atualiza o que é fato do portal, e só isso.
 *
 *   npm run ra:atualizar -- --base <arquivo.xlsx>            (simula)
 *   npm run ra:atualizar -- --base <arquivo.xlsx> --gravar
 *
 * **O buraco que isto fecha.** Uma reclamação que já estava aqui e foi
 * respondida, avaliada ou resolvida **no portal** continuava aparecendo
 * como se nada tivesse acontecido. Foi o sintoma que o Isaac descreveu:
 * "ta dando 21 pendentes e nem tem isso tudo".
 *
 * **A regra mora em `lib/services/atualizacaoDoPortal.ts`**, e não mais
 * aqui. Até 10/09/2026 este script tinha a regra certa e o botão
 * Importar da tela tinha outra — regravava a linha inteira. Medido com a
 * mesma planilha: o botão teria trocado 142 respostas públicas reais
 * pelo marcador, e tirado o responsável de 141 reclamações. Agora os
 * dois chamam `mudancasDoPortal`: o portal é dono do que o consumidor e
 * o público fizeram, a operação é dona do que ela decidiu, e a lista
 * do que o portal pode tocar é uma só.
 *
 * **Sem `--gravar` ele só mostra.** Cada mudança aparece campo a campo,
 * com o valor de antes e o de depois, para dar para conferir antes de
 * aceitar.
 */
import "dotenv/config";

import { readFileSync } from "node:fs";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { parseReclameAqui } from "../lib/services/raImport.service";

import {
  mudancasDoPortal,
  SELECAO_DO_PORTAL,
} from "../lib/services/atualizacaoDoPortal";

const url =
  process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!url) {
  console.error("\n  DATABASE_URL não definido.\n");
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: url }),
});

const args = process.argv.slice(2);

const arquivo = args[args.indexOf("--base") + 1];

const gravar = args.includes("--gravar");

if (!args.includes("--base") || !arquivo) {
  console.error(
    "\n  Falta --base <arquivo.xlsx>.\n"
  );
  process.exit(1);
}

async function main() {

  console.log(
    "\n  ATUALIZAÇÃO — só o que é fato do portal\n"
  );

  const r = parseReclameAqui(readFileSync(arquivo), {
    keepPii: true,
  });

  console.log(
    `  arquivo: ${r.cases.length} reclamação(ões)\n`
  );

  const noBanco = await prisma.case.findMany({
    select: SELECAO_DO_PORTAL,
  });

  const porChave = new Map<string, (typeof noBanco)[number]>();

  for (const c of noBanco) {
    porChave.set(c.protocol, c);
    if (c.externalId) porChave.set(c.externalId, c);
  }

  let mudariam = 0;
  let semMudanca = 0;
  let naoEncontradas = 0;

  const porCampo = new Map<string, number>();

  const paraGravar: {
    id: string;
    protocolo: string;
    dados: Record<string, unknown>;
  }[] = [];

  for (const doArquivo of r.cases) {

    const atual = porChave.get(doArquivo.protocol);

    if (!atual) {
      naoEncontradas += 1;
      continue;
    }

    const { dados, diferencas } = mudancasDoPortal(doArquivo, atual);

    if (diferencas.length === 0) {
      semMudanca += 1;
      continue;
    }

    mudariam += 1;

    for (const d of diferencas) {
      const campo = d.split(":")[0];
      porCampo.set(campo, (porCampo.get(campo) ?? 0) + 1);
    }

    if (mudariam <= 12) {
      console.log(`  ${doArquivo.protocol}`);
      for (const d of diferencas) {
        console.log(`      ${d}`);
      }
    }

    paraGravar.push({
      id: atual.id,
      protocolo: doArquivo.protocol,
      dados,
    });
  }

  if (mudariam > 12) {
    console.log(
      `\n  … e mais ${mudariam - 12} reclamação(ões) com mudança.`
    );
  }

  console.log(
    [
      "",
      `  mudariam:        ${mudariam}`,
      `  já iguais:       ${semMudanca}`,
      `  não estão aqui:  ${naoEncontradas}`,
      "",
      "  por campo:",
    ].join("\n")
  );

  for (const [campo, n] of [...porCampo.entries()].sort(
    (a, b) => b[1] - a[1]
  )) {
    console.log(`    ${campo.padEnd(20)} ${n}`);
  }

  if (!gravar) {
    console.log(
      "\n  SIMULAÇÃO — nada foi gravado. Repita com --gravar.\n"
    );
    await prisma.$disconnect();
    return;
  }

  for (const item of paraGravar) {
    await prisma.case.update({
      where: { id: item.id },
      data: item.dados,
    });
  }

  console.log(
    [
      "",
      `  ${paraGravar.length} reclamação(ões) atualizadas.`,
      "  Responsável, time, etiquetas, prioridade e rascunho ficaram como estavam.",
      "  A coluna do quadro só andou para frente, e só nas colunas que o portal conhece.",
      "",
    ].join("\n")
  );

  await prisma.$disconnect();
}

main().catch(async (erro) => {
  console.error("\n  Erro:", erro);
  await prisma.$disconnect();
  process.exit(1);
});
