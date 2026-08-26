/**
 * Cada frente é uma frente — o caso social não vira reclamação.
 *
 *   npm run check:frentes
 *
 * O Isaac descreveu assim: "você tem ideia que quando é criado um caso
 * nas redes sociais é como se ele fosse do reclame aqui? arrume isso
 * urgentemente".
 *
 * Eram **três** defeitos com o mesmo sintoma, e vale separá-los porque
 * só um deles é de gravação:
 *
 *  1. **O endereço.** Toda tela que lista casos montava
 *     `/reclame-aqui/${id}` à mão — oito lugares, incluindo o
 *     minikanban da própria tela de Redes Sociais. Um atendimento do
 *     Instagram aberto por qualquer um deles caía no módulo do Reclame
 *     Aqui, e o link copiado dali dizia que ele era uma reclamação.
 *
 *  2. **As abas.** A tela de detalhe abria "Avaliação RA" para todo
 *     caso, pedindo nota do portal, índice de solução e réplica a um
 *     atendimento que nunca vai ter nenhum dos três.
 *
 *  3. **O caminho de volta.** "Voltar para Reclame Aqui" mandava a
 *     pessoa para a fila errada, confirmando a impressão.
 *
 * A gravação, essa, sempre esteve certa — e é por isso que o defeito
 * durou: o banco tinha `INSTAGRAM` gravado enquanto a tela inteira dizia
 * Reclame Aqui. Este script confere os dois lados.
 */

import "dotenv/config";

import { readFileSync } from "node:fs";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { toCaseModel } from "../lib/services/case.mapper";
import {
  caseHref,
  isReclameAqui,
  isSocial,
} from "../lib/services/case.service";

let falhas = 0;

function ok(titulo: string, detalhe: string) {
  console.log(`  ok     ${titulo}  ·  ${detalhe}`);
}

function falha(titulo: string, detalhe: string) {
  falhas += 1;
  console.log(`  FALHA  ${titulo}`);
  console.log(`         ${detalhe}`);
}

async function main() {

  console.log(
    "\n  FRENTES — Redes Sociais não é Reclame Aqui\n"
  );

  const prisma = new PrismaClient({
    adapter: new PrismaPg({
      connectionString:
        process.env.DIRECT_URL || process.env.DATABASE_URL,
    }),
  });

  /* ---------------------------------------- 1. a gravação ---- */

  const protocolo = `IG-CHECK-${Date.now().toString().slice(-8)}`;

  await prisma.case.create({
    data: {
      protocol: protocolo,
      channel: "INSTAGRAM",
      companyName: "Conferência de frentes",
      customer: "Conferência de frentes",
      title: "Caso de conferência — pode apagar",
      status: "Novo",
      socialHandle: "conferencia",
      followers: 18_400,
      publishedAt: new Date(),
    },
  });

  const gravado = await prisma.case.findUnique({
    where: { protocol: protocolo },
    include: { owner: true, establishment: true },
  });

  if (gravado?.channel === "INSTAGRAM") {
    ok(
      "caso criado nas Redes Sociais grava como social",
      `channel = ${gravado.channel}`
    );
  } else {
    falha(
      "caso criado nas Redes Sociais grava como social",
      `gravou channel = ${gravado?.channel}`
    );
  }

  const modelo = toCaseModel(gravado as never);

  if (isSocial(modelo) && !isReclameAqui(modelo)) {
    ok(
      "e a aplicação o reconhece como social",
      `source = ${modelo.source}`
    );
  } else {
    falha(
      "e a aplicação o reconhece como social",
      `isSocial=${isSocial(modelo)} isReclameAqui=${isReclameAqui(modelo)}`
    );
  }

  if (modelo.socialHandle === "conferencia") {
    ok(
      "o @ do perfil tem campo próprio",
      `socialHandle = ${modelo.socialHandle} (e não escondido no e-mail)`
    );
  } else {
    falha(
      "o @ do perfil tem campo próprio",
      `veio ${JSON.stringify(modelo.socialHandle)}`
    );
  }

  if (modelo.followers === 18_400) {
    ok(
      "os seguidores chegam à tela",
      `${modelo.followers.toLocaleString("pt-BR")} — é o alcance que decide a urgência`
    );
  } else {
    falha(
      "os seguidores chegam à tela",
      `veio ${JSON.stringify(modelo.followers)}`
    );
  }

  /* ---------------------------------------- 2. o endereço ---- */

  const href = caseHref(modelo);

  if (href.startsWith("/redes-sociais/")) {
    ok(
      "o link do caso aponta para o módulo certo",
      href
    );
  } else {
    falha(
      "o link do caso aponta para o módulo certo",
      `apontou para ${href}`
    );
  }

  const daReclamacao = await prisma.case.findFirst({
    where: { channel: "RECLAME_AQUI" },
    include: { owner: true, establishment: true },
  });

  if (daReclamacao) {

    const hrefRa = caseHref(
      toCaseModel(daReclamacao as never)
    );

    if (hrefRa.startsWith("/reclame-aqui/")) {
      ok(
        "e a reclamação continua indo para o dela",
        hrefRa
      );
    } else {
      falha(
        "e a reclamação continua indo para o dela",
        `apontou para ${hrefRa}`
      );
    }
  }

  /* ------------------------------- 3. ninguém monta à mão ---- */

  /**
   * O link montado à mão é o defeito voltando.
   *
   * Foi assim que ele existiu: oito telas interpolando
   * `/reclame-aqui/${id}` sem olhar o canal. Uma função central só
   * resolve enquanto ninguém escrever a nona.
   */
  const TELAS = [
    "app/jornada/page.tsx",
    "app/redes-sociais/page.tsx",
    "components/clientes/ClientDetail.tsx",
    "components/dashboard/CriticalCases.tsx",
    "components/estabelecimentos/EstablishmentDetail.tsx",
    "components/reclame-aqui/DisregardedNotice.tsx",
    "components/reclame-aqui/kanban/KanbanCard.tsx",
    "components/shared/MiniKanban.tsx",
  ];

  const àMão = TELAS.filter((t) =>
    /`\/reclame-aqui\/\$\{[a-zA-Z]+\.id\}`/.test(
      readFileSync(t, "utf8")
    )
  );

  if (àMão.length === 0) {
    ok(
      "nenhuma tela monta o link do caso à mão",
      `${TELAS.length} telas usam caseHref()`
    );
  } else {
    falha(
      "nenhuma tela monta o link do caso à mão",
      àMão.join("\n         ")
    );
  }

  /* ----------------------------------------- 4. as abas ---- */

  const detalhe = readFileSync(
    "components/reclame-aqui/detail/CaseDetail.tsx",
    "utf8"
  );

  if (
    /id: "avaliacao",[\s\S]{0,120}?canais: \["reclame-aqui"\]/.test(
      detalhe
    )
  ) {
    ok(
      '"Avaliação RA" só aparece no Reclame Aqui',
      "atendimento social não recebe nota do portal, nem tem réplica"
    );
  } else {
    falha(
      '"Avaliação RA" só aparece no Reclame Aqui',
      "a aba está pedindo nota do portal para caso de rede social"
    );
  }

  if (
    /id: "rede-social",[\s\S]{0,120}?canais: \["social"\]/.test(
      detalhe
    )
  ) {
    ok(
      'e "Rede social" só aparece nas Redes Sociais',
      "@ do perfil e alcance ficam onde servem"
    );
  } else {
    falha(
      'e "Rede social" só aparece nas Redes Sociais',
      "a aba do Instagram não está restrita ao canal"
    );
  }

  /* ------------------------------------------- limpeza ---- */

  await prisma.case.delete({
    where: { protocol: protocolo },
  });

  const sumiu = await prisma.case.findUnique({
    where: { protocol: protocolo },
  });

  if (!sumiu) {
    ok(
      "o caso de conferência saiu da base",
      "nada de teste fica para trás"
    );
  } else {
    falha(
      "o caso de conferência saiu da base",
      `${protocolo} continua lá — apague à mão`
    );
  }

  /* -------------------------------------- o retrato de hoje -- */

  const porCanal = await prisma.case.groupBy({
    by: ["channel"],
    _count: true,
  });

  console.log("\n  hoje na base:");

  porCanal
    .sort((a, b) => b._count - a._count)
    .forEach((c) =>
      console.log(
        `    ${String(c.channel).padEnd(14)} ${c._count}`
      )
    );

  await prisma.$disconnect();

  console.log("");

  if (falhas === 0) {
    console.log(
      "  Cada caso abre no módulo a que pertence.\n"
    );
    process.exit(0);
  }

  console.log(`  ${falhas} problema(s).\n`);
  process.exit(1);
}

main();
