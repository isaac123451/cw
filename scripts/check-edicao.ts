/**
 * Duas pessoas no mesmo caso: uma apaga a outra?
 *
 *   npm run check:edicao
 *
 * **O defeito que isto existe para não repetir.** A tela mandava o caso
 * inteiro em cada gravação. Duas pessoas com o mesmo caso aberto: a
 * primeira troca o responsável, a segunda — que abriu antes — salva a
 * categoria e manda junto o responsável **antigo**. O trabalho da
 * primeira desaparecia sem nenhum aviso, e ninguém descobria porque
 * nada falhava.
 *
 * A conferência roda contra o banco de verdade, numa reclamação
 * descartável que é apagada no fim, e prova as três situações:
 *
 * 1. campos diferentes → as duas mudanças sobrevivem;
 * 2. mesmo campo, valores diferentes → **nada** é gravado e o conflito
 *    é nomeado;
 * 3. mesmo campo, mesmo valor → não é conflito, é concordância.
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { Case } from "../lib/models/case";

import {
  fetchCases,
  persistCase,
  persistCaseParcial,
} from "../lib/services/case.repository";

import {
  compararEdicao,
  fraseDoConflito,
} from "../lib/models/edicaoSimultanea";

const PROTOCOLO = "RA-ZzEdicaoSimult";

let falhas = 0;

function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(
    `${ok ? "  ok  " : "FALHA "} ${titulo.padEnd(56)} ${String(JSON.stringify(obtido)).slice(0, 44)}`
  );
  if (!ok) {
    console.log(
      `${" ".repeat(7)}${"esperado".padEnd(56)} ${String(JSON.stringify(esperado)).slice(0, 44)}`
    );
  }
}

function dizer(titulo: string, passou: boolean, detalhe = "") {
  if (!passou) falhas += 1;
  console.log(`${passou ? "  ok  " : "FALHA "} ${titulo.padEnd(56)} ${detalhe.slice(0, 44)}`);
}

/* ============================================================
   A COMPARAÇÃO, SEM BANCO
============================================================ */

function semBanco() {
  console.log("\n— A comparação de três pontas —\n");

  const anterior = { status: "Novo", owner: "Ana", category: "Entrega" };

  conferir(
    "campos diferentes não são conflito",
    compararEdicao(anterior, { ...anterior, category: "Cobrança" }, { ...anterior, owner: "Bruno" }),
    { meus: ["category"], deles: ["owner"], conflito: [] }
  );

  conferir(
    "mesmo campo com valores diferentes é conflito",
    compararEdicao(anterior, { ...anterior, status: "Resolvido" }, { ...anterior, status: "Não resolvido" }),
    { meus: ["status"], deles: ["status"], conflito: ["status"] }
  );

  /*
    Os dois mudando para o mesmo valor não é conflito: é duas pessoas
    concordando. Avisar aí seria ruído, e ruído treina a ignorar.
  */
  conferir(
    "mesmo campo com o mesmo valor não é conflito",
    compararEdicao(anterior, { ...anterior, status: "Resolvido" }, { ...anterior, status: "Resolvido" }),
    { meus: ["status"], deles: ["status"], conflito: [] }
  );

  /*
    `undefined` do lado novo é o Prisma pulando o campo de propósito
    (`recebidaEm`, `establishmentManual`). Tratá-lo como alteração faria
    toda gravação parecer mexer em tudo — e tudo virar conflito.
  */
  conferir(
    "campo que a tela não manda não conta como alteração",
    compararEdicao(anterior, { ...anterior, owner: undefined }, anterior),
    { meus: [], deles: [], conflito: [] }
  );

  dizer(
    "a frase do aviso lista os campos em português",
    fraseDoConflito({ campos: ["etapa", "responsável"] }).includes("etapa e responsável"),
    fraseDoConflito({ campos: ["etapa", "responsável"] }).slice(0, 44)
  );
}

/* ============================================================
   CONTRA O BANCO
============================================================ */

async function comBanco(prisma: PrismaClient) {

  console.log("\n— Contra o banco, com uma reclamação descartável —\n");

  const modelo = (await fetchCases(prisma)).find((c) => c.protocol.startsWith("RA-"));

  if (!modelo) {
    console.log("  --   sem reclamação para servir de modelo\n");
    return;
  }

  const limpar = async () => {
    await prisma.caseTag.deleteMany({ where: { case: { protocol: PROTOCOLO } } });
    await prisma.case.deleteMany({ where: { protocol: PROTOCOLO } });
  };

  await limpar();

  const base: Case = {
    ...modelo,
    id: PROTOCOLO,
    protocol: PROTOCOLO,
    title: "ZZ descartável — edição simultânea",
    description: "Reclamação descartável criada pelo check:edicao. Apagada no fim.",
    status: "Novo",
    priority: "Normal",
    category: "Entrega",
    owner: "",
    publicResponse: "",
    tags: [],
  };

  await persistCase(prisma, base);

  const carregado = () =>
    fetchCases(prisma).then((lista) => lista.find((c) => c.protocol === PROTOCOLO)!);

  /* ---------- 1. campos diferentes: as duas sobrevivem ---------- */

  const queAnaCarregou = await carregado();

  /* O Bruno, noutra aba, troca a prioridade e grava. */
  await persistCaseParcial(
    prisma,
    { ...queAnaCarregou, priority: "Urgente" },
    queAnaCarregou
  );

  /* A Ana, que carregou antes, grava a categoria. */
  const daAna = await persistCaseParcial(
    prisma,
    { ...queAnaCarregou, category: "Cobrança" },
    queAnaCarregou
  );

  dizer("gravação em campo diferente é aceita", daAna.ok, daAna.ok ? "" : JSON.stringify(daAna));

  const depois = await carregado();

  conferir("a mudança da Ana está gravada", depois.category, "Cobrança");
  conferir("e a do Bruno continua de pé", depois.priority, "Urgente");

  /* ---------- 2. mesmo campo: ninguém apaga ninguém ---------- */

  const queAnaCarregou2 = await carregado();

  await persistCaseParcial(
    prisma,
    { ...queAnaCarregou2, status: "Resolvido" },
    queAnaCarregou2
  );

  const conflitante = await persistCaseParcial(
    prisma,
    { ...queAnaCarregou2, status: "Não resolvido" },
    queAnaCarregou2
  );

  dizer(
    "gravação por cima do mesmo campo é recusada",
    conflitante.ok === false,
    conflitante.ok ? "foi aceita" : ""
  );

  if (!conflitante.ok) {
    conferir("e o conflito nomeia o campo", conflitante.conflito.campos, ["etapa"]);
    dizer(
      "e diz quando o outro gravou",
      Boolean(conflitante.conflito.quando),
      conflitante.conflito.quando ?? ""
    );
  }

  const depois2 = await carregado();

  conferir(
    "o que o primeiro gravou continua lá — nada foi apagado",
    depois2.status,
    "Resolvido"
  );

  /* ---------- 3. concordar não é conflito ---------- */

  const queAnaCarregou3 = await carregado();

  await persistCaseParcial(
    prisma,
    { ...queAnaCarregou3, owner: "Thais Portela" },
    queAnaCarregou3
  );

  const concordando = await persistCaseParcial(
    prisma,
    { ...queAnaCarregou3, owner: "Thais Portela" },
    queAnaCarregou3
  );

  dizer(
    "os dois mudando para o mesmo valor passa",
    concordando.ok,
    concordando.ok ? "" : JSON.stringify(concordando)
  );

  /* ---------- 4. a resposta pública, que a lista não traz ---------- */

  /*
    O retrato que a tela manda vem do quadro, e o quadro carrega cada
    reclamação sem relato e sem resposta pública. A tela do caso busca
    os dois à parte. Sem tratar isso, toda edição da resposta pública
    parecia conflito — o banco tem texto, o retrato não — e seria
    recusada.
  */
  await prisma.case.update({
    where: { protocol: PROTOCOLO },
    data: { publicResponse: "Resposta antiga, publicada pelo portal." },
  });

  const doQuadro = await carregado();

  conferir("a cópia do quadro vem sem a resposta pública", doQuadro.publicResponse ?? null, null);

  const naTela = { ...doQuadro, publicResponse: "Resposta nova, escrita na tela do caso." };

  const daTela = await persistCaseParcial(prisma, naTela, doQuadro);

  dizer(
    "editar a resposta pública pela tela é aceito",
    daTela.ok,
    daTela.ok ? "" : JSON.stringify(daTela)
  );

  const textos = await prisma.case.findUnique({
    where: { protocol: PROTOCOLO },
    select: { publicResponse: true, description: true },
  });

  conferir("e a resposta nova está no banco", textos?.publicResponse, "Resposta nova, escrita na tela do caso.");

  conferir(
    "e o relato, que a tela não mexeu, continua",
    textos?.description,
    "Reclamação descartável criada pelo check:edicao. Apagada no fim."
  );

  /* Salvar outro campo com a cópia do quadro não apaga a resposta. */
  const doQuadro2 = await carregado();
  await persistCaseParcial(prisma, { ...doQuadro2, priority: "Alta" }, doQuadro2);

  const aindaLa = await prisma.case.findUnique({
    where: { protocol: PROTOCOLO },
    select: { publicResponse: true },
  });

  conferir(
    "gravar outro campo pela cópia do quadro não apaga a resposta",
    aindaLa?.publicResponse,
    "Resposta nova, escrita na tela do caso."
  );

  /* ---------- 5. salvar sem mexer em nada não escreve ---------- */

  const parado = await carregado();
  const nada = await persistCaseParcial(prisma, { ...parado }, parado);

  dizer(
    "Salvar sem ter mudado nada não grava",
    nada.ok && nada.alterados.length === 0,
    nada.ok ? JSON.stringify(nada.alterados) : "recusou"
  );

  /* ---------- a reclamação descartável sai ---------- */

  await limpar();

  const sobrou = await prisma.case.count({ where: { protocol: PROTOCOLO } });

  conferir("a reclamação descartável saiu da base", sobrou, 0);
}

async function main() {

  console.log("\n  EDIÇÃO SIMULTÂNEA — ninguém apaga ninguém");

  semBanco();

  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;

  if (!url) {
    console.log("\n  --   sem banco: só a comparação foi exercitada\n");
  } else {
    const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
    try {
      await comBanco(prisma);
    } finally {
      await prisma.$disconnect();
    }
  }

  console.log(
    falhas === 0
      ? "\n  Duas pessoas no mesmo caso, e o trabalho das duas fica.\n"
      : `\n  ${falhas} ponto(s) a corrigir.\n`
  );

  process.exit(falhas === 0 ? 0 : 1);
}

main().catch((erro) => {
  console.error("\n  Erro:", erro);
  process.exit(1);
});
