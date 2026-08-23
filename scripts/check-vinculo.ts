/**
 * Prova o vínculo reclamação ↔ estabelecimento contra o banco real.
 *
 *   npm run check:vinculo
 *
 * O vínculo é por **CNPJ**, e não por nome, por um motivo medido: o
 * export do Reclame Aqui grava o reclamante no lugar da empresa, então o
 * nome da reclamação é o do consumidor. Este script começa conferindo
 * isso na base de verdade — se um dia o export mudar, a primeira linha
 * da saída avisa antes de qualquer outra coisa.
 *
 * Depois exercita o caminho inteiro num estabelecimento **descartável**,
 * criado e apagado aqui:
 *
 * 1. Caso capturado antes do cadastro fica com CNPJ e sem vínculo — é o
 *    caso comum, e ele não pode dar erro nem sumir.
 * 2. Cadastrar o estabelecimento e rodar a varredura liga os dois.
 * 3. Rodar a varredura de novo liga zero — cron falha e é reexecutado.
 * 4. Grafia com máscara casa com grafia sem máscara.
 * 5. Reimportar a planilha **não apaga** o vínculo. A planilha não traz
 *    CNPJ, e uma gravação ingênua zeraria em silêncio todo vínculo que a
 *    extensão construiu.
 * 6. Desvincular na mão **dura**. Sem isso o botão de desvincular
 *    pareceria não funcionar: o CNPJ religaria na varredura seguinte.
 * 7. Vincular na mão vence o documento, mesmo apontando para outro
 *    cadastro.
 * 8. **CPF vincula igual a CNPJ.** A Cardápio Web cadastra restaurante
 *    das duas formas, e a maioria entra por CPF.
 *
 * Nenhuma reclamação real é tocada.
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { digitosDoDocumento } from "../lib/models/establishment";

import {
  importCasesBulk,
  persistCase,
} from "../lib/services/case.repository";

import type { Case } from "../lib/models/case";

const url =
  process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!url) {
  console.error(
    "\n  DATABASE_URL não definido — configure o banco antes.\n"
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
    `${ok ? "  ok  " : "FALHA "} ${campo.padEnd(48)} ${JSON.stringify(obtido)}`
  );

  if (!ok) {
    console.log(
      `${" ".repeat(7)}${"esperado".padEnd(48)} ${JSON.stringify(esperado)}`
    );
  }
}

/** A varredura do cron, na mesma regra — ver app/api/cron/route.ts. */
async function varrer() {

  const porDocumento = new Map<string, string>();

  for (const row of await prisma.establishment.findMany({
    where: { document: { not: null } },
    select: { id: true, document: true },
  })) {

    const digitos = digitosDoDocumento(row.document);

    if (digitos) porDocumento.set(digitos, row.id);
  }

  const orfaos = await prisma.case.findMany({
    where: {
      document: { not: null },
      establishmentId: null,
      establishmentManual: false,
    },
    select: { id: true, document: true },
  });

  let vinculados = 0;

  for (const caso of orfaos) {

    const alvo = porDocumento.get(caso.document ?? "");

    if (!alvo) continue;

    await prisma.case.update({
      where: { id: caso.id },
      data: { establishmentId: alvo },
    });

    vinculados += 1;
  }

  return vinculados;
}

const marca = Date.now().toString(36).toUpperCase();

const CNPJ_A = "11222333000181";
const CNPJ_B = "44555666000172";

/**
 * Um CPF, porque a maioria dos cadastros é assim.
 *
 * A Cardápio Web cadastra restaurante por CPF do proprietário com
 * frequência: 122 das 127 reclamações da base real respondem "CPF ou
 * CNPJ" com CPF. A versão anterior desta ligação aceitava só catorze
 * dígitos e jogava fora quase todo o vínculo que existe.
 */
const CPF_C = "39053344705";

const protocoloA = `ZZ-VINC-${marca}-A`;
const protocoloB = `ZZ-VINC-${marca}-B`;
const protocoloC = `ZZ-VINC-${marca}-C`;

function casoDeTeste(
  protocol: string,
  documento?: string
): Case {
  return {
    id: protocol,
    protocol,
    company: "Consumidor de Teste",
    customer: "Consumidor de Teste",
    document: documento,
    source: "Reclame Aqui",
    category: "Não classificado",
    priority: "Média",
    status: "Novo",
    title: `Vínculo ${marca}`,
    description:
      "Descartável — criado pelo check:vinculo.",
    evaluated: false,
    resolved: false,
    wouldDoBusiness: false,
    responseTime: "-",
    solutionTime: "-",
    sla: "48h",
    createdAt: new Date().toISOString().slice(0, 10),
    tags: [],
  };
}

async function main() {

  console.log(
    "\n  VÍNCULO RECLAMAÇÃO x ESTABELECIMENTO\n"
  );

  /* ----------------------------------------------------------
     0. Por que CNPJ e não nome — conferido na base real.
  ---------------------------------------------------------- */

  const total = await prisma.case.count();

  const [{ diferentes }] = await prisma.$queryRaw<
    { diferentes: bigint }[]
  >`SELECT COUNT(*)::bigint AS diferentes FROM "Case" WHERE "companyName" <> "customer"`;

  console.log(
    `  base: ${total} reclamações, ${Number(diferentes)} com empresa diferente do consumidor\n`
  );

  conferir(
    "0. casar por nome ligaria ao consumidor",
    Number(diferentes),
    0
  );

  /* ----------------------------------------------------------
     1. Caso capturado antes do cadastro.
  ---------------------------------------------------------- */

  await persistCase(
    prisma,
    casoDeTeste(protocoloA, CNPJ_A)
  );

  const antes = await prisma.case.findUnique({
    where: { protocol: protocoloA },
    select: { document: true, establishmentId: true },
  });

  conferir(
    "1. CNPJ gravado sem cadastro",
    antes?.document,
    CNPJ_A
  );

  conferir(
    "1. sem vínculo, e sem erro",
    antes?.establishmentId,
    null
  );

  /* ----------------------------------------------------------
     2. Cadastra o estabelecimento e varre.
  ---------------------------------------------------------- */

  const est = await prisma.establishment.create({
    data: {
      slug: `zz-vinculo-${marca.toLowerCase()}`,
      name: `ZZ Vínculo ${marca}`,
      document: CNPJ_A,
      plan: "Essencial",
      status: "Ativo",
    },
    select: { id: true },
  });

  const primeira = await varrer();

  const depois = await prisma.case.findUnique({
    where: { protocol: protocoloA },
    select: { establishmentId: true },
  });

  conferir("2. varredura vinculou", primeira >= 1, true);

  conferir(
    "2. apontando para o cadastro certo",
    depois?.establishmentId,
    est.id
  );

  /* ----------------------------------------------------------
     3. Idempotência — cron falha e é reexecutado.
  ---------------------------------------------------------- */

  const segunda = await varrer();

  conferir(
    "3. segunda varredura vincula zero",
    segunda,
    0
  );

  /* ----------------------------------------------------------
     4. Grafia com máscara casa com grafia sem máscara.
  ---------------------------------------------------------- */

  const estB = await prisma.establishment.create({
    data: {
      slug: `zz-vinculo-${marca.toLowerCase()}-b`,
      name: `ZZ Vínculo ${marca} B`,
      document: "44.555.666/0001-72",
      plan: "Essencial",
      status: "Ativo",
    },
    select: { id: true },
  });

  // Sem varredura: o próprio persistCase tem de achar na hora.
  await persistCase(
    prisma,
    casoDeTeste(protocoloB, CNPJ_B)
  );

  const comMascara = await prisma.case.findUnique({
    where: { protocol: protocoloB },
    select: { establishmentId: true },
  });

  conferir(
    "4. máscara casa com dígitos, ao gravar",
    comMascara?.establishmentId,
    estB.id
  );

  /* ----------------------------------------------------------
     5. Reimportar a planilha não apaga o vínculo.
  ---------------------------------------------------------- */

  // A planilha não traz CNPJ nem estabelecimento — e muda algo.
  const daPlanilha = casoDeTeste(protocoloA);

  daPlanilha.title = `Vínculo ${marca} (reimportado)`;

  await importCasesBulk(prisma, [daPlanilha]);

  const apos = await prisma.case.findUnique({
    where: { protocol: protocoloA },
    select: {
      document: true,
      establishmentId: true,
      title: true,
    },
  });

  conferir(
    "5. reimportação gravou a mudança",
    apos?.title,
    `Vínculo ${marca} (reimportado)`
  );

  conferir("5. CNPJ preservado", apos?.document, CNPJ_A);

  conferir(
    "5. vínculo preservado",
    apos?.establishmentId,
    est.id
  );

  /* ----------------------------------------------------------
     6. Desvincular na mão dura.
  ---------------------------------------------------------- */

  const desvinculado = await prisma.case.findUnique({
    where: { protocol: protocoloA },
    select: { id: true },
  });

  // É o que a tela faz: apaga o vínculo e marca a escolha.
  await prisma.case.update({
    where: { id: desvinculado!.id },
    data: {
      establishmentId: null,
      establishmentManual: true,
    },
  });

  const aposVarrer = await varrer();

  const aindaSolto = await prisma.case.findUnique({
    where: { protocol: protocoloA },
    select: { establishmentId: true },
  });

  conferir(
    "6. varredura não religa o que foi desvinculado",
    aposVarrer,
    0
  );

  conferir(
    "6. e ele continua solto",
    aindaSolto?.establishmentId,
    null
  );

  /* ----------------------------------------------------------
     7. Vincular na mão vence o CNPJ.
  ---------------------------------------------------------- */

  // CNPJ do A, mas vinculado à mão ao cadastro do B.
  await persistCase(prisma, {
    ...casoDeTeste(protocoloA, CNPJ_A),
    establishmentId: estB.id,
    establishmentManual: true,
  });

  const forcado = await prisma.case.findUnique({
    where: { protocol: protocoloA },
    select: { establishmentId: true },
  });

  conferir(
    "7. escolha da pessoa vence o CNPJ",
    forcado?.establishmentId,
    estB.id
  );

  /* ----------------------------------------------------------
     8. CPF vincula igual a CNPJ.
  ---------------------------------------------------------- */

  const estC = await prisma.establishment.create({
    data: {
      slug: `zz-vinculo-${marca.toLowerCase()}-c`,
      name: `ZZ Vínculo ${marca} C`,
      document: "390.533.447-05",
      plan: "Essencial",
      status: "Ativo",
    },
    select: { id: true },
  });

  await persistCase(
    prisma,
    casoDeTeste(protocoloC, CPF_C)
  );

  const porCpf = await prisma.case.findUnique({
    where: { protocol: protocoloC },
    select: { document: true, establishmentId: true },
  });

  conferir("8. CPF é guardado", porCpf?.document, CPF_C);

  conferir(
    "8. e vincula como o CNPJ vincula",
    porCpf?.establishmentId,
    estC.id
  );

  /* ----------------------------------------------------------
     Retrato da base.
  ---------------------------------------------------------- */

  // Os descartáveis deste script ficam de fora da conta.
  const reais = {
    protocol: {
      notIn: [protocoloA, protocoloB, protocoloC],
    },
  };

  const semTeste = {
    NOT: { name: { startsWith: "ZZ Vínculo " } },
  };

  const comDocumento = await prisma.case.count({
    where: { document: { not: null }, ...reais },
  });

  const vinculados = await prisma.case.count({
    where: { establishmentId: { not: null }, ...reais },
  });

  const totalCasos = await prisma.case.count({
    where: reais,
  });

  const cadastros = await prisma.establishment.count({
    where: semTeste,
  });

  const cadastrosComDocumento =
    await prisma.establishment.count({
      where: { document: { not: null }, ...semTeste },
    });

  console.log(
    `\n  hoje: ${comDocumento} de ${totalCasos} reclamações com documento, ${vinculados} vinculadas`
  );

  console.log(
    `        ${cadastrosComDocumento} de ${cadastros} estabelecimentos com documento cadastrado`
  );

  /**
   * O número que interessa é o segundo.
   *
   * É o documento **do cadastro** que a extensão consulta para ligar a
   * próxima captura sozinha. Reclamação com documento e cadastro sem
   * documento não se encontram — e é assim que a base fica quando o CW
   * Engine diz qual é o restaurante mas não diz o CPF/CNPJ dele.
   */
  console.log(
    "  (é o documento do cadastro que faz a próxima captura se ligar sozinha)"
  );
}

main()
  .catch((erro) => {
    falhas += 1;
    console.error("\n  ERRO:", erro);
  })
  .finally(async () => {

    // Limpeza: nada de teste fica na base.
    await prisma.case
      .deleteMany({
        where: {
          protocol: {
            in: [protocoloA, protocoloB, protocoloC],
          },
        },
      })
      .catch(() => {});

    await prisma.establishment
      .deleteMany({
        where: {
          name: { startsWith: `ZZ Vínculo ${marca}` },
        },
      })
      .catch(() => {});

    await prisma.$disconnect();

    console.log(
      falhas === 0
        ? "\n  Tudo certo.\n"
        : `\n  ${falhas} falha(s).\n`
    );

    process.exit(falhas === 0 ? 0 : 1);
  });
