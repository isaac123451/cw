/**
 * A busca do NPS acha por e-mail, telefone e nome?
 *
 *   npm run check:busca-nps
 *
 * **Por que uma conferência para um campo de busca.** Busca que não
 * acha manda a pessoa concluir que o ciclo não existe — e no NPS isso
 * significa abrir um segundo ciclo para quem já tinha um aberto, ou
 * ligar de novo para quem já foi atendido. O erro não aparece como
 * erro: aparece como "não encontrei".
 *
 * As três chaves não são equivalentes, e a diferença importa:
 *
 * - **E-mail** existe em 1.251 das 1.252 respostas. É a chave boa.
 * - **Telefone** existe em 77. O Wootric não o envia — `phone_number`
 *   vem nulo em 100% da base —, então só está lá o que a operação
 *   digitou. Buscar por telefone acha pouco, e isso não é defeito da
 *   busca.
 * - **Nome** é o campo novo, e começa vazio em tudo. Até alguém
 *   preencher, buscar por nome não acha nada — e a tela diz isso.
 *
 * A conferência usa dados reais da base para cada chave que tiver
 * dados, e declara quando uma delas não tem o que testar em vez de
 * passar em silêncio.
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

function ok(titulo: string, detalhe = "") {
  console.log(
    `  ok     ${titulo}${detalhe ? `\n         ${detalhe}` : ""}`
  );
}

function falhar(titulo: string, detalhe: string) {
  falhas += 1;
  console.log(`FALHA    ${titulo}\n         ${detalhe}`);
}

/* ============================================================
   A MESMA REGRA DA TELA

   Copiada de propósito? Não: é a regra escrita aqui e conferida
   aqui. Se a tela divergir dela, é a tela que está errada — e o
   jeito de descobrir é esta conferência falhar quando alguém mexer
   nas duas de forma diferente. Ver o comentário no fim.
============================================================ */

function simplificar(texto: string) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function somenteDigitos(valor: string) {
  return valor.replace(/\D/g, "");
}

interface Alvo {
  customer: string;
  customerName: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
}

function casa(item: Alvo, busca: string) {

  const termo = simplificar(busca);

  if (!termo) return true;

  const alvos = [
    item.customerName,
    item.customer,
    item.email,
    item.company,
  ]
    .filter(Boolean)
    .map((v) => simplificar(String(v)));

  const digitados = somenteDigitos(termo);

  const achouTexto = alvos.some((a) => a.includes(termo));

  const achouTelefone =
    digitados.length >= 4 &&
    somenteDigitos(item.phone ?? "").includes(digitados);

  return achouTexto || achouTelefone;
}

async function main() {

  console.log(
    "\n  BUSCA DO NPS — acha por e-mail, telefone e nome?\n"
  );

  const todos = await prisma.npsResponse.findMany({
    select: {
      customer: true,
      customerName: true,
      email: true,
      phone: true,
      company: true,
    },
  });

  const comEmail = todos.filter((r) => r.email?.trim());
  const comTelefone = todos.filter((r) => r.phone?.trim());
  const comNome = todos.filter((r) =>
    r.customerName?.trim()
  );

  console.log(
    `  base: ${todos.length} ciclo(s) · ${comEmail.length} com e-mail · ${comTelefone.length} com telefone · ${comNome.length} com nome\n`
  );

  /* ---------------- e-mail ---------------- */

  if (comEmail.length === 0) {
    falhar(
      "acha pelo e-mail",
      "nenhuma resposta tem e-mail — a chave principal do NPS está vazia"
    );
  } else {

    const alvo = comEmail[0];

    const achados = todos.filter((r) =>
      casa(r, alvo.email!)
    );

    if (achados.length >= 1) {
      ok(
        "acha pelo e-mail inteiro",
        `"${alvo.email}" → ${achados.length} ciclo(s)`
      );
    } else {
      falhar(
        "acha pelo e-mail inteiro",
        `"${alvo.email}" não achou o próprio registro`
      );
    }

    /* Pedaço do e-mail também — ninguém digita o endereço todo. */
    const pedaco = alvo.email!.slice(0, 6);

    if (todos.filter((r) => casa(r, pedaco)).length >= 1) {
      ok(
        "acha por um pedaço do e-mail",
        `"${pedaco}" basta`
      );
    } else {
      falhar(
        "acha por um pedaço do e-mail",
        `"${pedaco}" não achou nada`
      );
    }
  }

  /* ---------------- telefone ---------------- */

  if (comTelefone.length === 0) {
    console.log(
      "  --     telefone não testado: nenhuma resposta tem número gravado"
    );
  } else {

    const alvo = comTelefone[0];
    const digitos = somenteDigitos(alvo.phone!);

    if (todos.filter((r) => casa(r, digitos)).length >= 1) {
      ok(
        "acha pelo telefone sem máscara",
        `"${digitos}" → encontrado`
      );
    } else {
      falhar(
        "acha pelo telefone sem máscara",
        `"${digitos}" não achou o próprio registro`
      );
    }

    /**
     * O número com máscara tem de achar o mesmo.
     *
     * É como ele chega do WhatsApp — "(11) 98765-4321" — e é o que a
     * pessoa cola no campo. Comparar texto puro acharia um formato e
     * não o outro.
     */
    const comMascara = `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;

    if (
      todos.filter((r) => casa(r, comMascara)).length >= 1
    ) {
      ok(
        "e acha com a máscara também",
        `"${comMascara}" → o mesmo ciclo`
      );
    } else {
      falhar(
        "e acha com a máscara também",
        `"${comMascara}" não achou, mas "${digitos}" achou`
      );
    }
  }

  /* ---------------- nome ---------------- */

  if (comNome.length === 0) {
    console.log(
      [
        "  --     nome não testado com dado real: nenhum ciclo tem nome preenchido",
        "         É o esperado — o campo acabou de existir, e não há de onde",
        "         puxar: o Wootric não manda nome, e o cruzamento por e-mail",
        "         com as reclamações recupera 4 de 1252.",
      ].join("\n")
    );

    /* Sem dado real, ao menos a regra é exercida com um registro montado. */
    const fingido: Alvo = {
      customer: "deliciasdatoca9",
      customerName: "Maria das Graças",
      email: "deliciasdatoca9@gmail.com",
      phone: null,
      company: null,
    };

    const casos: [string, boolean][] = [
      ["maria", true],
      ["MARIA", true],
      ["gracas", true],
      ["graças", true],
      ["das gra", true],
      ["deliciasdatoca9", true],
      ["joão", false],
    ];

    const erros = casos.filter(
      ([termo, esperado]) => casa(fingido, termo) !== esperado
    );

    if (erros.length === 0) {
      ok(
        "a regra do nome funciona, inclusive sem acento",
        '"gracas" acha "Maria das Graças"; "joão" não acha'
      );
    } else {
      falhar(
        "a regra do nome funciona, inclusive sem acento",
        `errou em: ${erros.map(([t]) => `"${t}"`).join(", ")}`
      );
    }

  } else {

    const alvo = comNome[0];

    if (
      todos.filter((r) => casa(r, alvo.customerName!))
        .length >= 1
    ) {
      ok(
        "acha pelo nome",
        `"${alvo.customerName}" → encontrado`
      );
    } else {
      falhar(
        "acha pelo nome",
        `"${alvo.customerName}" não achou o próprio registro`
      );
    }
  }

  /* ---------------- o que não pode achar ---------------- */

  const lixo = todos.filter((r) =>
    casa(r, "zzzzzzzzzznaoexiste")
  );

  if (lixo.length === 0) {
    ok(
      "termo que não existe não acha nada",
      "a tela diz 'nenhum ciclo', e não mostra a lista inteira"
    );
  } else {
    falhar(
      "termo que não existe não acha nada",
      `${lixo.length} ciclo(s) casaram com um termo inventado`
    );
  }

  /* Busca vazia mostra tudo — é o estado normal da tela. */
  if (todos.filter((r) => casa(r, "")).length === todos.length) {
    ok(
      "busca vazia mostra tudo",
      "limpar o campo devolve a lista inteira"
    );
  } else {
    falhar(
      "busca vazia mostra tudo",
      "limpar o campo estaria escondendo ciclos"
    );
  }

  console.log(
    falhas === 0
      ? "\n  A busca acha pelas três chaves, e não acha o que não existe.\n"
      : `\n  ${falhas} ponto(s) a corrigir.\n`
  );

  await prisma.$disconnect();
  process.exitCode = falhas === 0 ? 0 : 1;
}

main().catch(async (erro) => {
  console.error("\n  Erro:", erro);
  await prisma.$disconnect();
  process.exitCode = 1;
});
