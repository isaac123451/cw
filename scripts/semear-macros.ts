/**
 * Acrescenta as respostas prontas que faltavam.
 *
 *   npm run semear:macros            (só mostra o que entraria)
 *   npm run semear:macros -- --gravar
 *
 * A base tinha dez macros: cinco de Reclame Aqui e cinco de WhatsApp.
 * **Nenhuma de NPS e nenhuma de Redes Sociais** — duas das três frentes
 * sem uma única resposta pronta, o que quer dizer que quem atende ali
 * escreve tudo do zero, toda vez, e o texto sai diferente a cada
 * pessoa.
 *
 * As que entram aqui cobrem os momentos que se repetem e que ninguém
 * gosta de escrever com pressa: o primeiro contato com um detrator, o
 * pedido de depoimento a um promotor, a réplica no portal, a
 * recuperação de quem avaliou como não resolvido.
 *
 * **Idempotente pelo título.** Rodar duas vezes não duplica, e uma
 * macro que alguém editou não é sobrescrita — o texto na base é o que a
 * operação decidiu, e este script não sabe mais do que ela.
 */

import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const gravar = process.argv.includes("--gravar");

/**
 * O que cada macro escreve.
 *
 * Três regras valem para todas, e vieram do que já estava na base:
 *
 *  - **Nada de prazo em número.** "Retornamos em 24 horas" numa resposta
 *    pronta é uma promessa que quem cola não controla.
 *  - **Espaço para o específico.** Os colchetes marcam o que precisa ser
 *    trocado; texto que serve para tudo não serve para nada, e o
 *    consumidor reconhece resposta padrão à primeira leitura.
 *  - **Tom de quem resolve, não de quem se defende.** Reconhecer o
 *    problema na primeira frase é o que separa uma resposta que acalma
 *    de uma que irrita.
 */
const NOVAS = [

  /* ---------------------------------------------- NPS ---- */

  {
    title: "NPS — primeiro contato com detrator",
    channel: "NPS",
    category: "Atendimento",
    tags: ["nps", "detrator", "primeiro-contato"],
    body: `Oi, [NOME]! Aqui é o [SEU NOME], da Cardápio Web.

Vi sua resposta na nossa pesquisa e queria entender melhor o que aconteceu — sua nota foi baixa e isso é o tipo de coisa que a gente não deixa passar.

[O QUE ELE ESCREVEU, EM UMA FRASE — mostra que você leu]

Pode me contar como está hoje? Se ainda estiver travado em alguma coisa, eu acompanho até resolver.`,
  },

  {
    title: "NPS — detrator, retorno com a solução",
    channel: "NPS",
    category: "Atendimento",
    tags: ["nps", "detrator", "solucao"],
    body: `Oi, [NOME]! Voltando aqui como combinei.

[O QUE FOI FEITO, EM PASSOS CONCRETOS]

Dá uma conferida e me diz se ficou do jeito que você precisava. Se faltar alguma coisa, me chama direto por aqui.`,
  },

  {
    title: "NPS — promotor, pedido de depoimento",
    channel: "NPS",
    category: "Atendimento",
    tags: ["nps", "promotor", "depoimento"],
    body: `Oi, [NOME]! Tudo bem?

Vi que você deu nota [NOTA] pra gente na pesquisa — obrigado, de verdade. Isso faz diferença aqui dentro.

Você toparia escrever duas ou três linhas sobre o que mais te ajudou no dia a dia? A gente usa como depoimento pra outros restaurantes entenderem o que esperar.

Se preferir, pode ser por áudio mesmo, do jeito que for mais fácil.`,
  },

  {
    title: "NPS — promotor, pedido de indicação",
    channel: "NPS",
    category: "Comercial",
    tags: ["nps", "promotor", "indicacao"],
    body: `Oi, [NOME]! Que bom saber que está indo bem por aí.

Você conhece algum outro restaurante que estaria precisando do que a gente faz? Se fizer sentido indicar, me passa o contato que eu falo com carinho — e você me diz depois se foi bem atendido.

Sem compromisso nenhum, só se você achar que ajuda.`,
  },

  {
    title: "NPS — passivo, o que faltou",
    channel: "NPS",
    category: "Atendimento",
    tags: ["nps", "passivo"],
    body: `Oi, [NOME]! Aqui é o [SEU NOME], da Cardápio Web.

Você deu nota [NOTA] na nossa pesquisa — o que, pra gente, quer dizer "está funcionando, mas dava pra ser melhor".

Queria saber o que falta. O que te faria dar 10? Pode ser direto, é assim que a gente conserta as coisas.`,
  },

  {
    title: "NPS — sem retorno, último contato",
    channel: "NPS",
    category: "Atendimento",
    tags: ["nps", "encerramento"],
    body: `Oi, [NOME]! Tentei falar com você algumas vezes por aqui.

Vou encerrar este acompanhamento por enquanto pra não ficar te procurando sem parar — mas o que você escreveu na pesquisa ficou registrado, e a gente trabalha em cima disso.

Se precisar de qualquer coisa, é só me chamar. A porta fica aberta.`,
  },

  /* ------------------------------------ REDES SOCIAIS ---- */

  {
    title: "Instagram — primeiro contato, trazer para o privado",
    channel: "Instagram",
    category: "Atendimento",
    tags: ["instagram", "primeiro-contato"],
    body: `Oi, [NOME]! Aqui é o [SEU NOME], da Cardápio Web.

Vi sua mensagem e já estou olhando. Pra eu conseguir resolver direito, preciso de alguns dados da sua conta — me passa por aqui mesmo, no privado?

[O QUE PRECISA: CNPJ, NOME DO ESTABELECIMENTO, E-MAIL DE CADASTRO]`,
  },

  {
    title: "Instagram — reclamação pública, resposta no post",
    channel: "Instagram",
    category: "Atendimento",
    tags: ["instagram", "publico"],
    body: `Oi, [NOME]! Aqui é a Cardápio Web.

Sentimos muito pelo que aconteceu — isso não é o que a gente quer pra ninguém. Já chamamos você no privado pra resolver.

[SE JÁ HOUVER SOLUÇÃO, UMA FRASE SOBRE ELA]`,
  },

  {
    title: "Instagram — resolvido, fechamento",
    channel: "Instagram",
    category: "Atendimento",
    tags: ["instagram", "encerramento"],
    body: `Pronto, [NOME]! [O QUE FOI RESOLVIDO]

Qualquer coisa que aparecer, me chama por aqui direto que eu acompanho.

E se quiser, dá uma olhada na nossa Central de Ajuda — tem passo a passo de quase tudo: https://ajuda.cardapioweb.com`,
  },

  /* ------------------------------------- RECLAME AQUI ---- */

  {
    title: "Réplica do consumidor — segunda resposta",
    channel: "Reclame Aqui",
    category: "Atendimento",
    tags: ["replica", "reclame-aqui"],
    body: `Oi, [NOME]!

Entendi o seu ponto e você tem razão em cobrar — [O QUE AINDA NÃO FOI RESOLVIDO].

[O QUE MUDOU DESDE A PRIMEIRA RESPOSTA, EM PASSOS CONCRETOS]

Vou acompanhar pessoalmente até o fim. Qualquer coisa, me chama pelo chat da plataforma ou por suporte@cardapioweb.com.`,
  },

  {
    title: "Avaliada como não resolvida — recuperação",
    channel: "Reclame Aqui",
    category: "Atendimento",
    tags: ["nao-resolvido", "recuperacao"],
    body: `Oi, [NOME]!

Vi que você marcou a reclamação como não resolvida, e isso pra gente é sinal de que a gente errou em algum lugar.

Queria uma chance de acertar: [O QUE FALTOU, PELO QUE ELE ESCREVEU].

Se ainda estiver aberto, me diz aqui o que precisa acontecer pra ficar de pé — e eu cuido disso do começo ao fim.`,
  },

  {
    title: "Pedido de dados para dar andamento",
    channel: "Reclame Aqui",
    category: "Atendimento",
    tags: ["dados", "reclame-aqui"],
    body: `Oi, [NOME]!

Já estou com sua reclamação em mãos. Pra eu conseguir localizar seu cadastro e resolver, preciso de:

- CNPJ ou CPF do cadastro
- Nome do estabelecimento
- E-mail usado no acesso

Assim que você mandar, eu sigo daqui. Pode enviar por mensagem privada aqui mesmo.`,
  },
];

async function main() {

  const prisma = new PrismaClient({
    adapter: new PrismaPg({
      connectionString:
        process.env.DIRECT_URL || process.env.DATABASE_URL,
    }),
  });

  const existentes = await prisma.macro.findMany({
    select: { title: true, channel: true },
  });

  const titulos = new Set(
    existentes.map((m) => m.title)
  );

  const faltando = NOVAS.filter(
    (m) => !titulos.has(m.title)
  );

  console.log(
    "\n  RESPOSTAS PRONTAS — completando as frentes\n"
  );

  const porCanal = new Map<string, number>();

  for (const m of existentes) {
    porCanal.set(
      m.channel,
      (porCanal.get(m.channel) ?? 0) + 1
    );
  }

  console.log("  hoje na base:");

  [...porCanal.entries()]
    .sort()
    .forEach(([canal, quantas]) =>
      console.log(
        `    ${canal.padEnd(16)} ${quantas}`
      )
    );

  if (faltando.length === 0) {
    console.log(
      "\n  Todas as macros deste script já existem. Nada a fazer.\n"
    );
    await prisma.$disconnect();
    return;
  }

  console.log(
    `\n  ${faltando.length} macro(s) a acrescentar:\n`
  );

  faltando.forEach((m) =>
    console.log(
      `    ${m.channel.padEnd(16)} ${m.title}`
    )
  );

  if (!gravar) {
    console.log(
      "\n  Nada foi gravado. Para gravar:"
    );
    console.log(
      "    npm run semear:macros -- --gravar\n"
    );
    await prisma.$disconnect();
    return;
  }

  await prisma.macro.createMany({
    data: faltando.map((m) => ({
      title: m.title,
      body: m.body,
      category: m.category,
      channel: m.channel,
      tags: m.tags,
      owner: "Operação",
    })),
  });

  const total = await prisma.macro.count();

  console.log(
    `\n  ${faltando.length} gravada(s). A base tem ${total} respostas prontas.\n`
  );

  await prisma.$disconnect();
}

main();
