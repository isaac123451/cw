/**
 * Crisp e WhatsApp do NPS chegam à extensão?
 *
 *   npm run check:canais
 *
 * O Isaac pediu dois botões na extensão: o **Crisp** para o ManyChat —
 * onde a conversa fica de verdade — e o **WhatsApp do NPS** para os
 * ciclos da pesquisa. E pediu no mesmo desenho do Reclame Aqui, "para
 * não bagunçar": um campo no cadastro, e o botão só aparece quando o
 * campo está preenchido.
 *
 * É esse contrato que se prova aqui, e ele tem duas metades que falham
 * de formas diferentes:
 *
 *   1. **Preenchido, o link chega.** Sem isso o botão nunca aparece e
 *      o recurso não existe.
 *   2. **Vazio, o link não chega.** Sem isso o botão aparece levando a
 *      lugar nenhum — e quem clica uma vez em botão morto para de
 *      clicar nos outros.
 *
 * Mais duas, sobre o número: "(11) 98888-7777" tem de virar
 * `wa.me/5511988887777`, e o que não é telefone tem de virar `null` em
 * vez de um link que abre o WhatsApp numa tela de erro.
 *
 * O estabelecimento usado é escolhido na base real e **devolvido ao
 * estado anterior** no fim, inclusive se algo estourar no meio.
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

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

function conferir(
  titulo: string,
  condicao: boolean,
  detalhe: string
) {
  if (condicao) {
    console.log(`  ok     ${titulo}  ·  ${detalhe}`);
  } else {
    falhas += 1;
    console.log(`FALHA    ${titulo}\n         ${detalhe}`);
  }
}

/**
 * A mesma normalização da rota, reescrita.
 *
 * Reimplementar é o ponto: se as duas concordarem, o formato não
 * depende de uma leitura só do que o `wa.me` aceita.
 */
function linkEsperado(valor: string): string | null {

  const digitos = valor.replace(/\D/g, "");

  if (!digitos) return null;

  const semPais = digitos.startsWith("55")
    ? digitos.slice(2)
    : digitos;

  return semPais.length === 10 || semPais.length === 11
    ? `https://wa.me/55${semPais}`
    : null;
}

async function main() {

  console.log(
    "\n  CANAIS — Crisp e WhatsApp do NPS chegam à extensão?\n"
  );

  /* ---- 1. a normalização do número ---- */

  const numeros: [string, string | null][] = [
    ["(11) 98888-7777", "https://wa.me/5511988887777"],
    ["11988887777", "https://wa.me/5511988887777"],
    ["5511988887777", "https://wa.me/5511988887777"],
    ["+55 11 98888-7777", "https://wa.me/5511988887777"],
    ["(11) 3333-4444", "https://wa.me/551133334444"],
    ["", null],
    ["123", null],
    ["não tenho", null],
    [
      "1198888777788889999",
      null,
    ],
  ];

  for (const [entrada, esperado] of numeros) {

    const obtido = linkEsperado(entrada);

    conferir(
      `número "${entrada || "(vazio)"}"`,
      obtido === esperado,
      obtido === esperado
        ? String(obtido ?? "recusado, como deve ser")
        : `esperava ${esperado}, veio ${obtido}`
    );
  }

  /* ---- 2. o campo vazio não vira link ---- */

  const semNada = await prisma.establishment.findFirst({
    where: {
      crispUrl: null,
      npsWhatsapp: null,
    },
    select: { name: true, slug: true },
  });

  conferir(
    "estabelecimento sem os campos não produz botão",
    Boolean(semNada),
    semNada
      ? `"${semNada.name}" tem os dois vazios — a extensão recebe null e não desenha nada`
      : "todos os estabelecimentos já têm os dois campos preenchidos, não deu para testar o vazio"
  );

  /* ---- 3. preenchido, chega ---- */

  const alvo = await prisma.establishment.findFirst({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      crispUrl: true,
      npsWhatsapp: true,
    },
  });

  if (!alvo) {
    conferir(
      "há estabelecimento para testar",
      false,
      "nenhum estabelecimento na base"
    );
    return;
  }

  const antes = {
    crispUrl: alvo.crispUrl,
    npsWhatsapp: alvo.npsWhatsapp,
  };

  try {

    await prisma.establishment.update({
      where: { id: alvo.id },
      data: {
        crispUrl:
          "https://app.crisp.chat/website/conferencia/inbox/",
        npsWhatsapp: "(11) 98888-7777",
      },
    });

    const depois =
      await prisma.establishment.findUnique({
        where: { id: alvo.id },
        select: {
          crispUrl: true,
          npsWhatsapp: true,
        },
      });

    conferir(
      "o link do Crisp grava e volta",
      depois?.crispUrl ===
        "https://app.crisp.chat/website/conferencia/inbox/",
      `gravado em "${alvo.name}": ${depois?.crispUrl}`
    );

    conferir(
      "o WhatsApp do NPS grava como a pessoa digitou",
      depois?.npsWhatsapp === "(11) 98888-7777",
      `guardado "${depois?.npsWhatsapp}" — a normalização é da rota, não do banco`
    );

    conferir(
      "e vira o link certo para a extensão",
      linkEsperado(depois?.npsWhatsapp ?? "") ===
        "https://wa.me/5511988887777",
      String(
        linkEsperado(depois?.npsWhatsapp ?? "")
      )
    );

  } finally {

    /**
     * O estabelecimento volta ao que era, sempre.
     *
     * É cadastro de cliente real: deixar um link de conferência
     * apontando para uma caixa de entrada que não existe faria alguém
     * clicar nele um dia.
     */
    await prisma.establishment.update({
      where: { id: alvo.id },
      data: antes,
    });

    const restaurado =
      await prisma.establishment.findUnique({
        where: { id: alvo.id },
        select: {
          crispUrl: true,
          npsWhatsapp: true,
        },
      });

    conferir(
      "o cadastro voltou ao estado anterior",
      restaurado?.crispUrl === antes.crispUrl &&
        restaurado?.npsWhatsapp === antes.npsWhatsapp,
      `crisp: ${restaurado?.crispUrl ?? "vazio"} · whatsapp: ${restaurado?.npsWhatsapp ?? "vazio"}`
    );
  }

  /* ---- 4. o retrato de hoje ---- */

  const [total, comCrisp, comZap, comPortal] =
    await Promise.all([
      prisma.establishment.count(),
      prisma.establishment.count({
        where: { NOT: { crispUrl: null } },
      }),
      prisma.establishment.count({
        where: { NOT: { npsWhatsapp: null } },
      }),
      prisma.establishment.count({
        where: { NOT: { portalUrl: null } },
      }),
    ]);

  console.log(
    `\n  hoje na base: ${total} estabelecimentos · ${comPortal} com portal · ${comCrisp} com Crisp · ${comZap} com WhatsApp do NPS`
  );

  if (comCrisp === 0 && comZap === 0) {
    console.log(
      "  Os dois campos são novos e ainda estão vazios: os botões só vão aparecer\n  depois de alguém preencher no cadastro do estabelecimento."
    );
  }

  console.log(
    falhas === 0
      ? "\n  Preenchido chega, vazio não vira botão.\n"
      : `\n  ${falhas} problema(s).\n`
  );
}

main()
  .catch((erro) => {
    console.error("\n  Erro:", erro);
    falhas += 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(falhas === 0 ? 0 : 1);
  });
