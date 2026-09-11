/**
 * O vigia do Reclame Aqui lê certo e grava com as travas?
 *
 *   npm run check:vigia
 *
 * **O pedido.** "Queria que você ficasse verificando na página da
 * Cardápio Web no Reclame Aqui para adicionar as reclamações." A
 * extensão confere a lista pública de tempos em tempos e grava sem
 * ninguém olhar — por isso cada trava tem prova aqui.
 *
 * Três partes:
 *
 *  1. **O leitor** (`extensao/comum/portal-ra.js`) contra amostras com a
 *     estrutura exata das páginas de 11/09/2026 — o `__NEXT_DATA__` da
 *     lista e a `astro-island` da reclamação, com o escape de atributo
 *     do Astro. Os textos de consumidor foram trocados por fictícios.
 *  2. **A tradução** (`raPortal.service`), sem banco: status, resposta
 *     só da empresa, datas, avaliação.
 *  3. **As travas, contra o banco**, em reclamações descartáveis: nova
 *     entra uma vez só, existente não perde o trabalho da operação,
 *     texto real não é trocado, e a mesma reclamação com outro número é
 *     reconhecida.
 *
 * Do Node não dá para buscar o portal ao vivo: o Cloudflare barra
 * qualquer cliente que não seja navegador. Por isso as amostras.
 */
import "dotenv/config";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import {
  desescapar,
  ehDesafio,
  lerLista,
  lerReclamacao,
} from "../extensao/comum/portal-ra.js";

import {
  atrasadasNaLista,
  casoDoPortal,
  completarContato,
  gravarDoPortal,
  pendentesDoPortal,
  type ReclamacaoDoPortal,
  statusPeloPortal,
  textoDoPortal,
  validarReclamacao,
} from "../lib/services/raPortal.service";

/* O leitor é JavaScript da extensão; aqui ele ganha o tipo do que devolve. */
type Lista = {
  total: number | null;
  itens: { codigo: string; status: string; avaliada: boolean }[];
};

type Lida = ReclamacaoDoPortal;

const AMOSTRAS = resolve(__dirname, "amostras");

const amostra = (nome: string) =>
  readFileSync(resolve(AMOSTRAS, nome), "utf8");

let falhas = 0;

function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(
    `${ok ? "  ok  " : "FALHA "} ${titulo.padEnd(62)} ${JSON.stringify(obtido)?.slice(0, 52)}`
  );
  if (!ok) {
    console.log(`${" ".repeat(7)}${"esperado".padEnd(62)} ${JSON.stringify(esperado)?.slice(0, 52)}`);
  }
}

/* ============================================================
   1. O LEITOR
============================================================ */

function leitor() {
  console.log("\n  1. O LEITOR — as páginas do portal, sem DOM\n");

  const lista = lerLista(amostra("ra-portal-lista.html")) as Lista | null;

  conferir("a lista traz as cinco da página", lista?.itens.length, 5);
  conferir("e o total do portal", lista?.total, 355);
  conferir(
    "códigos com _ e - inteiros",
    lista?.itens.map((i) => i.codigo).slice(0, 2),
    ["ZzNovaAmostra001", "Zz-Nova_Amostra2"]
  );
  conferir(
    "respondida e avaliada, como a lista mostra",
    lista?.itens.map((i) => [i.status, i.avaliada]).slice(3),
    [["ANSWERED", false], ["ANSWERED", true]]
  );

  const deOutra = amostra("ra-portal-lista.html").replace(
    '"shortname":"cardapio-web-servicos-de-tecnologia"',
    '"shortname":"outra-empresa"'
  );

  conferir("lista de outra empresa não é lida", lerLista(deOutra), null);

  const desafio = amostra("ra-portal-desafio.html");

  conferir("a tela antirrobô é reconhecida", ehDesafio(200, desafio), true);
  conferir("e a página normal, não", ehDesafio(200, amostra("ra-portal-lista.html")), false);
  conferir("a tela antirrobô não vira lista", lerLista(desafio), null);

  const lida = lerReclamacao(amostra("ra-portal-reclamacao.html")) as Lida | null;

  conferir("a reclamação é a da ilha certa, não a do cabeçalho", lida?.codigo, "Zz_Amostra-Rica1");
  conferir("o número da página", lida?.numero, 123456789);
  conferir("título com & desfeito", lida?.titulo, "Cardápio Web: Cobrança após cancelamento & sem retorno");
  conferir("relato chega como o portal escreveu", lida?.relato.includes("<br />"), true);
  conferir(
    "as quatro falas, na ordem",
    lida?.interacoes.map((i) => i.tipo),
    ["ANSWER", "REPLY", "COMPANY_REPLY", "FINAL_ANSWER"]
  );
  conferir(
    "avaliação: resolvida, nota 10, voltaria",
    [lida?.avaliada, lida?.resolvida, lida?.nota, lida?.voltaria],
    [true, true, 10, true]
  );
  conferir("problema do portal", lida?.problema, "Cobrança indevida");
  conferir("cidade com acento", lida?.cidade, "São José dos Campos");

  /*
    Um nível de escape só.

    A resposta tem a própria entidade (&#8212;), que no atributo vem como
    &amp;#8212;. O leitor desfaz o atributo e para: quem desfaz o texto
    é o servidor. Desfazer dois níveis aqui mudaria o que o portal
    publicou antes de chegar a quem tem de conferir.
  */
  conferir(
    "um nível de escape: a entidade da resposta sobrevive",
    lida?.interacoes[2].texto.includes("&#8212;"),
    true
  );
  conferir("desescapar põe &amp; por último", desescapar("&amp;#8212; &amp;quot;"), "&#8212; &quot;");

  conferir("página sem a ilha da reclamação", lerReclamacao(desafio), null);

  /*
    O `[0]` do Astro é `undefined`.

    Medido em 11/09: "voltaria a fazer negócio" vem `[0]` quando a página
    mostra "Não". Lido como lista, o mesmo `[0]` numa nota daria
    Number([0]) = 0 — uma nota zero que ninguém deu.
  */
  const semResposta = lerReclamacao(
    amostra("ra-portal-reclamacao.html")
      .replace("&quot;dealAgain&quot;:[0,true]", "&quot;dealAgain&quot;:[0]")
      .replace("&quot;score&quot;:[0,&quot;10&quot;]", "&quot;score&quot;:[0]")
  ) as Lida | null;

  conferir("[0] do Astro em voltaria: não", semResposta?.voltaria, false);
  conferir("[0] do Astro na nota: sem nota, não zero", semResposta?.nota, undefined);

  return lida;
}

/* ============================================================
   2. A TRADUÇÃO
============================================================ */

function base(parcial: Partial<ReclamacaoDoPortal> = {}): ReclamacaoDoPortal {
  return {
    codigo: "ZzVigiaTraducao1",
    empresa: "cardapio-web-servicos-de-tecnologia",
    titulo: "Título",
    relato: "Relato",
    criadaEm: "2026-09-10T21:43:37",
    status: "PENDING",
    avaliada: false,
    resolvida: false,
    voltaria: false,
    interacoes: [],
    ...parcial,
  };
}

function traducao(lida: Lida | null) {
  console.log("\n  2. A TRADUÇÃO — do portal para o quadro\n");

  const validada = validarReclamacao(lida);

  conferir("o que o leitor devolve passa na validação", validada?.codigo, "Zz_Amostra-Rica1");

  conferir(
    "reclamação de outra empresa é recusada",
    validarReclamacao({ ...lida, empresa: "outra-empresa" }),
    null
  );
  conferir("código fora do formato é recusado", validarReclamacao({ ...lida, codigo: "curto" }), null);
  conferir("sem título é recusada", validarReclamacao({ ...lida, titulo: "  " }), null);
  conferir("lixo não estoura", validarReclamacao("<script>"), null);

  if (!validada) return;

  const caso = casoDoPortal(validada);

  conferir("protocolo pelo código", caso.protocol, "RA-Zz_Amostra-Rica1");
  conferir("avaliada e resolvida vai para Resolvido", caso.status, "Resolvido");

  const resposta = caso.publicResponse ?? "";

  conferir("a resposta começa pela da empresa", resposta.startsWith("Olá, Maria!\n\nAqui é a equipe"), true);
  conferir("a tréplica da empresa entra", resposta.includes("processado hoje"), true);
  conferir("a réplica do consumidor não entra", resposta.includes("ainda não apareceu"), false);
  conferir("a consideração final do consumidor não entra", resposta.includes("Resolveram, obrigado"), false);
  conferir("a entidade vira travessão no servidor", resposta.includes("úteis — já"), true);
  conferir("sem marcação no texto gravado", /<[^>]+>/.test(resposta + caso.description), false);

  conferir(
    "datas pelo dia do portal",
    [caso.createdAt, caso.publicResponseAt, caso.evaluatedAt],
    ["2026-06-04", "2026-06-11", "2026-06-22"]
  );
  conferir("tempo de resposta pela mesma régua da planilha", caso.responseTime, "7 dias");
  conferir("avaliação", [caso.evaluated, caso.score, caso.resolved, caso.wouldDoBusiness], [true, 10, true, true]);
  conferir("subcategoria é o problema do portal", caso.subcategory, "Cobrança indevida");
  conferir("resolvida com nota 10 é prioridade baixa", caso.priority, "Baixa");
  conferir("nome não é público: Não informado", caso.customer, "Não informado");
  conferir("endereço com o título de verdade", caso.raUrl?.endsWith("/titulo-da-amostra_Zz_Amostra-Rica1/"), true);

  conferir("pendente no portal é Novo", statusPeloPortal(base()), "Novo");
  conferir(
    "respondida, última palavra da empresa: aguardando avaliação",
    statusPeloPortal(base({ status: "ANSWERED", interacoes: [{ tipo: "ANSWER", em: "", texto: "" }] })),
    "Aguardando avaliação"
  );
  conferir(
    "respondida, última palavra do consumidor: nossa réplica",
    statusPeloPortal(
      base({
        status: "ANSWERED",
        interacoes: [
          { tipo: "ANSWER", em: "", texto: "" },
          { tipo: "REPLY", em: "", texto: "" },
        ],
      })
    ),
    "Aguardando nossa réplica"
  );
  conferir("avaliada sem resolver", statusPeloPortal(base({ status: "NOT_SOLVED", avaliada: true })), "Não resolvido");

  const nova = casoDoPortal(base());

  conferir("pendente nova é crítica, sem resposta", [nova.priority, nova.publicResponse], ["Crítica", ""]);

  conferir(
    "HTML de terceiro vira texto, não marcação",
    textoDoPortal("Oi<br />tudo <b>bem</b>?&lt;img src=x onerror=alert(1)&gt;"),
    "Oi\ntudo bem?<img src=x onerror=alert(1)>"
  );
}

/* ============================================================
   3. AS TRAVAS, CONTRA O BANCO
============================================================ */

const NOVA = "ZzVigiaNova00001";
const CORRIDA = "ZzVigiaCorrida01";
const TRABALHADA = "ZzVigiaTrabalhad";
const COM_TEXTO = "ZzVigiaComTexto1";
const JURIDICO = "ZzVigiaJuridico1";
const ADIANTADA = "ZzVigiaAdiantada";
const PELO_NUMERO = "ZzVigiaPeloNumer";
const NUMERO = 987654321;
const PELO_TITULO = "ZzVigiaPeloTitul";

/*
  Toda descartável entra aqui — inclusive as que só nascem quando uma
  trava falha. A de PELO_NUMERO só existe se o reconhecimento pelo
  número quebrar, e foi exatamente numa prova ao contrário que ela
  sobrou no banco por não estar nesta lista.
*/
const PROTOCOLOS = [
  NOVA,
  CORRIDA,
  TRABALHADA,
  COM_TEXTO,
  JURIDICO,
  ADIANTADA,
  PELO_NUMERO,
  PELO_TITULO,
].map((c) => `RA-${c}`).concat([`RA-${NUMERO}`, "RA-ZzVigiaTituloAntig"]);

async function limpar(prisma: PrismaClient) {
  await prisma.caseTag.deleteMany({ where: { case: { protocol: { in: PROTOCOLOS } } } });
  await prisma.case.deleteMany({ where: { protocol: { in: PROTOCOLOS } } });
}

function respondida(codigo: string, parcial: Partial<ReclamacaoDoPortal> = {}) {
  return base({
    codigo,
    titulo: `Reclamação descartável ${codigo}`,
    relato: "Relato do portal.<br />Segunda linha.",
    status: "SOLVED",
    avaliada: true,
    resolvida: true,
    nota: 9,
    voltaria: true,
    criadaEm: "2026-08-20T11:21:48.000Z",
    interacoes: [
      { tipo: "ANSWER", em: "2026-08-21T10:00:00", texto: "Resposta do portal.<br />Com duas linhas." },
      { tipo: "FINAL_ANSWER", em: "2026-08-25T09:00:00", texto: "Resolveram." },
    ],
    ...parcial,
  });
}

async function nascer(
  prisma: PrismaClient,
  codigo: string,
  dados: Record<string, unknown>
) {
  return prisma.case.create({
    data: {
      protocol: `RA-${codigo}`,
      externalId: codigo,
      companyName: "Consumidor",
      customer: "Consumidor",
      title: `Reclamação descartável ${codigo}`,
      status: "Aguardando avaliação",
      publishedAt: new Date("2026-08-20T00:00:00Z"),
      ...dados,
    },
    select: { id: true },
  });
}

async function travas(prisma: PrismaClient) {
  console.log("\n  3. AS TRAVAS — contra o banco, em reclamações descartáveis\n");

  const dono = await prisma.user.findFirst({ where: { active: true }, select: { id: true } });
  const etiqueta = await prisma.tag.findFirst({ select: { id: true } });

  if (!dono || !etiqueta) {
    console.log("  --   base sem usuário ou etiqueta para montar o teste");
    return;
  }

  /* --- nova entra, e entra uma vez só --- */

  const primeira = await gravarDoPortal(prisma, [base({ codigo: NOVA, titulo: "Reclamação nova descartável" })]);

  conferir("reclamação nova entra", primeira.criadas.map((c) => c.protocolo), [`RA-${NOVA}`]);

  const gravada = await prisma.case.findUnique({
    where: { protocol: `RA-${NOVA}` },
    select: {
      status: true,
      customer: true,
      externalUrl: true,
      tags: { select: { tag: { select: { name: true } } } },
    },
  });

  conferir("na coluna Novo", gravada?.status, "Novo");
  conferir("com a etiqueta da extensão", gravada?.tags.map((t) => t.tag.name), ["Capturada pela extensão"]);
  conferir("e o endereço do portal", gravada?.externalUrl?.includes(NOVA), true);

  const segunda = await gravarDoPortal(prisma, [base({ codigo: NOVA, titulo: "Reclamação nova descartável" })]);

  conferir("a segunda volta não recria", [segunda.criadas.length, segunda.inalteradas], [0, 1]);

  /* Duas extensões abertas percebendo a mesma nova no mesmo instante. */
  await Promise.all([
    gravarDoPortal(prisma, [base({ codigo: CORRIDA, titulo: "Corrida descartável" })]),
    gravarDoPortal(prisma, [base({ codigo: CORRIDA, titulo: "Corrida descartável" })]),
  ]);

  conferir(
    "duas voltas ao mesmo tempo: um cartão só",
    await prisma.case.count({ where: { protocol: `RA-${CORRIDA}` } }),
    1
  );

  /* --- existente: o trabalho da operação fica --- */

  await nascer(prisma, TRABALHADA, {
    ownerId: dono.id,
    priority: "CRITICA",
    draftResponse: "Rascunho da operação.",
    churnRisk: true,
    publicResponseAt: new Date("2026-08-21T00:00:00Z"),
    tags: { create: [{ tagId: etiqueta.id }] },
  });

  conferir(
    "respondida sem texto aparece como pendente",
    (await pendentesDoPortal(prisma, 1000)).includes(TRABALHADA),
    true
  );

  const completada = await gravarDoPortal(prisma, [respondida(TRABALHADA)]);

  conferir("a existente é completada, não recriada", completada.completadas.length, 1);

  const depois = await prisma.case.findUnique({
    where: { protocol: `RA-${TRABALHADA}` },
    select: {
      ownerId: true,
      priority: true,
      draftResponse: true,
      churnRisk: true,
      publicResponse: true,
      status: true,
      evaluated: true,
      score: true,
      description: true,
      _count: { select: { tags: true } },
    },
  });

  conferir("responsável continua", depois?.ownerId, dono.id);
  conferir("prioridade da operação continua", depois?.priority, "CRITICA");
  conferir("rascunho continua", depois?.draftResponse, "Rascunho da operação.");
  conferir("risco de cancelamento continua", depois?.churnRisk, true);
  conferir("etiqueta da operação continua", depois?._count.tags, 1);
  conferir("a resposta vazia recebe o texto do portal", depois?.publicResponse, "Resposta do portal.\nCom duas linhas.");
  conferir("o relato vazio recebe o do portal", depois?.description, "Relato do portal.\nSegunda linha.");
  conferir("a avaliação do portal entra", [depois?.status, depois?.evaluated, depois?.score], ["Resolvido", true, 9]);
  conferir(
    "completada deixa de ser pendente",
    (await pendentesDoPortal(prisma, 1000)).includes(TRABALHADA),
    false
  );

  /* --- texto real não é trocado --- */

  await nascer(prisma, COM_TEXTO, {
    publicResponse: "Texto publicado pela plataforma.",
    publicResponseAt: new Date("2026-08-21T00:00:00Z"),
    description: "Relato capturado na área da empresa.",
  });

  await gravarDoPortal(prisma, [respondida(COM_TEXTO)]);

  const comTexto = await prisma.case.findUnique({
    where: { protocol: `RA-${COM_TEXTO}` },
    select: { publicResponse: true, description: true, evaluated: true },
  });

  conferir("resposta real fica, mesmo diferente da do portal", comTexto?.publicResponse, "Texto publicado pela plataforma.");
  conferir("relato real fica", comTexto?.description, "Relato capturado na área da empresa.");
  conferir("mas a avaliação, que é do portal, entra", comTexto?.evaluated, true);

  /* --- coluna própria da operação --- */

  await nascer(prisma, JURIDICO, { status: "Em análise jurídica" });
  await gravarDoPortal(prisma, [respondida(JURIDICO)]);

  conferir(
    "coluna própria da operação não é tocada",
    (await prisma.case.findUnique({ where: { protocol: `RA-${JURIDICO}` }, select: { status: true } }))?.status,
    "Em análise jurídica"
  );

  /* --- ninguém volta para Novo --- */

  await nascer(prisma, ADIANTADA, { status: "Aguardando avaliação", description: null });
  await gravarDoPortal(prisma, [base({ codigo: ADIANTADA, titulo: `Reclamação descartável ${ADIANTADA}`, relato: "Relato que faltava." })]);

  const adiantada = await prisma.case.findUnique({
    where: { protocol: `RA-${ADIANTADA}` },
    select: { status: true, description: true },
  });

  conferir("pendente lá e adiantada aqui não volta para Novo", adiantada?.status, "Aguardando avaliação");
  conferir("mas o relato que faltava entra", adiantada?.description, "Relato que faltava.");

  /* --- a mesma reclamação com outro número --- */

  await prisma.case.create({
    data: {
      protocol: `RA-${NUMERO}`,
      externalId: String(NUMERO),
      companyName: "Consumidor",
      customer: "Consumidor",
      title: "Capturada pelo número",
      status: "Novo",
      publishedAt: new Date("2026-09-01T00:00:00Z"),
    },
  });

  const peloNumero = await gravarDoPortal(prisma, [
    base({ codigo: PELO_NUMERO, numero: NUMERO, titulo: "Capturada pelo número" }),
  ]);

  conferir("reconhecida pelo número antigo: nenhum cartão novo", peloNumero.criadas.length, 0);
  conferir("e nada criado com o código", await prisma.case.count({ where: { protocol: `RA-${PELO_NUMERO}` } }), 0);

  await prisma.case.create({
    data: {
      protocol: "RA-ZzVigiaTituloAntig",
      companyName: "Consumidor",
      customer: "Consumidor",
      title: "Mesmo título, outro número",
      status: "Novo",
      publishedAt: new Date("2026-09-09T00:00:00Z"),
    },
  });

  const peloTitulo = await gravarDoPortal(prisma, [
    base({ codigo: PELO_TITULO, titulo: "mesmo título, OUTRO número", criadaEm: "2026-09-10T08:00:00" }),
  ]);

  conferir("reconhecida pelo título na mesma data", peloTitulo.criadas.length, 0);

  /* --- o portal à frente, pela lista --- */

  await prisma.case.update({
    where: { protocol: `RA-${NOVA}` },
    data: { status: "Novo", publicResponse: null },
  });

  conferir(
    "respondida lá e sem resposta aqui: atrasada",
    await atrasadasNaLista(prisma, [{ codigo: NOVA, status: "ANSWERED", avaliada: false }]),
    [NOVA]
  );
  conferir(
    "pendente lá e aqui: em dia",
    await atrasadasNaLista(prisma, [{ codigo: NOVA, status: "PENDING", avaliada: false }]),
    []
  );
  conferir(
    "desconhecida não é atrasada (é nova)",
    await atrasadasNaLista(prisma, [{ codigo: "ZzNaoExiste00001", status: "ANSWERED", avaliada: true }]),
    []
  );

  /* --- o contato que só a área da empresa mostra --- */

  const doVigia = await prisma.case.findUniqueOrThrow({
    where: { protocol: `RA-${NOVA}` },
    select: {
      id: true,
      customer: true,
      companyName: true,
      email: true,
      phone: true,
      document: true,
      city: true,
      state: true,
    },
  });

  const completou = await completarContato(prisma, doVigia, {
    cliente: "Maria Lopes",
    email: "maria.lopes@exemplo.com",
    telefone: "11 98765-4321",
    documento: "12345678000199",
    cidade: "Campinas",
    estado: "SP",
  });

  conferir("a captura completa o que o vigia não tinha", completou, ["nome", "e-mail", "telefone", "documento", "cidade", "UF"]);

  const completo = await prisma.case.findUniqueOrThrow({
    where: { protocol: `RA-${NOVA}` },
    select: {
      id: true,
      customer: true,
      companyName: true,
      email: true,
      phone: true,
      document: true,
      city: true,
      state: true,
    },
  });

  const deNovo = await completarContato(prisma, completo, {
    cliente: "Outra Pessoa",
    email: "outra@exemplo.com",
    telefone: "21 90000-0000",
    cidade: "Rio",
    estado: "RJ",
  });

  conferir("e não sobrescreve o que já está preenchido", deNovo, []);
  conferir("o nome continua o primeiro", completo.customer, "Maria Lopes");
}

async function main() {
  const lida = leitor();
  traducao(lida);

  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;

  if (!url) {
    console.log("\n  --   sem banco: a parte 3 depende dele\n");
  } else {
    const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

    try {
      /* Sobra de uma rodada interrompida sai antes de começar. */
      await limpar(prisma);
      await travas(prisma);
    } finally {
      await limpar(prisma);
      await prisma.$disconnect();
    }
  }

  console.log(
    falhas === 0
      ? "\n  O vigia lê o portal certo e grava sem desfazer o trabalho de ninguém.\n"
      : `\n  ${falhas} ponto(s) em que o vigia leria ou gravaria errado.\n`
  );

  process.exitCode = falhas === 0 ? 0 : 1;
}

main().catch((erro) => {
  console.error("\n  Erro:", erro);
  process.exitCode = 1;
});
