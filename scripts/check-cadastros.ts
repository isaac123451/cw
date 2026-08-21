/**
 * Prova que os cadastros gravam mesmo — contra o banco de verdade.
 *
 *   npm run check:cadastros
 *
 * Existe por causa de um defeito concreto: a aba **Times** do módulo
 * Reclame Aqui aplicava a alteração na tela e não gravava nada. Não
 * havia erro, não havia aviso — o time cadastrado simplesmente sumia no
 * recarregamento seguinte. `tsc` e `lint` passavam limpos, porque não
 * gravar é sintaticamente perfeito.
 *
 * O teste que pega esse tipo de bug é **ida e volta**: escrever o que a
 * tela escreveria, ler de novo pelo mesmo caminho da carga, e conferir
 * campo a campo. Cada bloco limpa o que criou — o banco termina como
 * começou.
 *
 * Cobre os três buracos encontrados em 21/08/2026:
 *   1. Times (`TeamOption` → tabela `Team`)
 *   2. Metas dos indicadores (`ReputationGoal`, tabela que existia e
 *      nunca era escrita)
 *   3. Clientes — enriquecimento e cadastro manual (`ClientProfile`)
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { RA1000_TARGETS } from "../lib/services/reputation.service";

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
    `${ok ? "  ok  " : "FALHA "} ${campo.padEnd(34)} ${JSON.stringify(obtido)}`
  );

  if (!ok) {
    console.log(
      `${" ".repeat(7)}${"esperado".padEnd(34)} ${JSON.stringify(esperado)}`
    );
  }
}

/**
 * Sufixo próprio de cada execução.
 *
 * O banco é o de produção: um nome fixo colidiria com o `@unique` na
 * segunda rodada, e — pior — poderia esbarrar num time de verdade.
 */
const marca = `zz-teste-${Date.now().toString(36)}`;

async function times() {

  console.log("\nTimes — a aba do módulo Reclame Aqui\n");

  const id = `${marca}-time`;

  // O que `saveTeamOption` grava.
  await prisma.team.upsert({
    where: { id },
    update: {},
    create: {
      id,
      name: `Time ${marca}`,
      legacyName: "nome-antigo-da-planilha",
      order: 42,
      active: true,
    },
  });

  // O que a carga lê e transforma em `teamOptions`.
  const criado = await prisma.team.findUnique({
    where: { id },
  });

  conferir("nome", criado?.name, `Time ${marca}`);
  conferir(
    "valor legado",
    criado?.legacyName,
    "nome-antigo-da-planilha"
  );
  conferir("ordem", criado?.order, 42);
  conferir("ativo", criado?.active, true);

  // Editar de novo tem de valer — foi o que não acontecia.
  await prisma.team.update({
    where: { id },
    data: { name: `Time ${marca} renomeado`, active: false },
  });

  const editado = await prisma.team.findUnique({
    where: { id },
  });

  conferir(
    "renomear vale",
    editado?.name,
    `Time ${marca} renomeado`
  );
  conferir("desativar vale", editado?.active, false);

  /**
   * A trava que separa as duas telas: gravar pelo caminho da aba Times
   * não pode apagar descrição, departamento e líder, que são da tela de
   * Times (pessoas). São a mesma linha do banco.
   */
  await prisma.team.update({
    where: { id },
    data: {
      description: "descrição da outra tela",
      department: "Suporte",
      leader: "Fulano",
    },
  });

  await prisma.team.update({
    where: { id },
    data: {
      name: `Time ${marca} de novo`,
      legacyName: "outro",
      order: 7,
      active: true,
    },
  });

  const depois = await prisma.team.findUnique({
    where: { id },
  });

  conferir(
    "descrição sobrevive",
    depois?.description,
    "descrição da outra tela"
  );
  conferir(
    "departamento sobrevive",
    depois?.department,
    "Suporte"
  );
  conferir("líder sobrevive", depois?.leader, "Fulano");

  await prisma.team.delete({ where: { id } });

  conferir(
    "apagado sai da base",
    await prisma.team.findUnique({ where: { id } }),
    null
  );
}

async function metas() {

  console.log("\nMetas dos indicadores\n");

  const indicador = `${marca}-resposta`;
  const padrao = RA1000_TARGETS.resposta;

  await prisma.reputationGoal.upsert({
    where: { indicator: indicador },
    update: { target: 95 },
    create: { indicator: indicador, target: 95 },
  });

  const salva = await prisma.reputationGoal.findUnique({
    where: { indicator: indicador },
  });

  conferir("meta ajustada grava", salva?.target, 95);

  /**
   * A regra que importa: voltar ao valor de fábrica **apaga** a linha,
   * em vez de gravá-la igual ao padrão. É o que faz uma mudança futura
   * do critério do Reclame Aqui chegar sozinha a quem nunca mexeu.
   */
  await prisma.reputationGoal.deleteMany({
    where: { indicator: indicador, target: padrao },
  });

  await prisma.reputationGoal.update({
    where: { indicator: indicador },
    data: { target: padrao },
  });

  await prisma.reputationGoal.deleteMany({
    where: { indicator: indicador, target: padrao },
  });

  conferir(
    "voltar ao padrão apaga a linha",
    await prisma.reputationGoal.findUnique({
      where: { indicator: indicador },
    }),
    null
  );

  conferir(
    "padrão do RA1000 continua o público",
    padrao,
    90
  );
}

async function clientes() {

  console.log("\nClientes — enriquecimento e cadastro manual\n");

  const slugManual = `${marca}-manual`;
  const slugDerivado = `${marca}-derivado`;

  // Cadastro à mão: nome e contato vêm do formulário.
  await prisma.clientProfile.create({
    data: {
      slug: slugManual,
      manual: true,
      name: "Cliente de teste",
      email: "teste@exemplo.com",
      phone: "51 90000-0000",
      city: "Campo Bom",
      state: "RS",
      kind: "Proprietário",
      document: "12345678000199",
      notes: "nota de teste",
      tags: ["teste", "cadastro"],
    },
  });

  // Enriquecimento de quem veio de uma reclamação: sem nome nem contato.
  await prisma.clientProfile.upsert({
    where: { slug: slugDerivado },
    update: { kind: "Operador" },
    create: {
      slug: slugDerivado,
      manual: false,
      kind: "Operador",
      notes: "veio de reclamação",
      tags: [],
    },
  });

  const linhas = await prisma.clientProfile.findMany({
    where: { slug: { in: [slugManual, slugDerivado] } },
    orderBy: { createdAt: "desc" },
  });

  conferir("as duas linhas existem", linhas.length, 2);

  const manuais = linhas.filter((r) => r.manual);
  const derivados = linhas.filter((r) => !r.manual);

  conferir("um manual", manuais.length, 1);
  conferir("um derivado", derivados.length, 1);

  conferir(
    "nome do manual",
    manuais[0]?.name,
    "Cliente de teste"
  );
  conferir(
    "etiquetas do manual",
    manuais[0]?.tags,
    ["teste", "cadastro"]
  );
  conferir(
    "tipo do derivado",
    derivados[0]?.kind,
    "Operador"
  );

  /**
   * O derivado **não** tem nome: a identidade dele é a reclamação, e o
   * nome vem de lá. Gravar nome aqui criaria duas fontes para o mesmo
   * dado, que divergem na primeira correção.
   */
  conferir(
    "derivado não guarda nome",
    derivados[0]?.name,
    null
  );

  // Enriquecer de novo tem de atualizar, não duplicar.
  await prisma.clientProfile.upsert({
    where: { slug: slugDerivado },
    update: { kind: "Parceiro" },
    create: {
      slug: slugDerivado,
      manual: false,
      tags: [],
    },
  });

  conferir(
    "segundo enriquecimento atualiza",
    (
      await prisma.clientProfile.findUnique({
        where: { slug: slugDerivado },
      })
    )?.kind,
    "Parceiro"
  );

  conferir(
    "e não duplica",
    await prisma.clientProfile.count({
      where: { slug: slugDerivado },
    }),
    1
  );

  /**
   * A trava do apagar: `removeManualClient` filtra por `manual: true`.
   * Um cliente vindo de reclamação não pode sumir da base por um clique
   * de exclusão — a reclamação dele continua existindo.
   */
  await prisma.clientProfile.deleteMany({
    where: { slug: slugDerivado, manual: true },
  });

  conferir(
    "derivado resiste ao apagar",
    await prisma.clientProfile.count({
      where: { slug: slugDerivado },
    }),
    1
  );

  await prisma.clientProfile.deleteMany({
    where: { slug: slugManual, manual: true },
  });

  conferir(
    "manual é apagado",
    await prisma.clientProfile.count({
      where: { slug: slugManual },
    }),
    0
  );

  // Limpeza do que a trava, corretamente, não deixou apagar.
  await prisma.clientProfile.deleteMany({
    where: { slug: slugDerivado },
  });
}

async function main() {

  try {
    await times();
    await metas();
    await clientes();
  } finally {
    await prisma.$disconnect();
  }

  console.log(
    falhas === 0
      ? "\nTodos os cadastros sobrevivem ao recarregamento.\n"
      : `\n${falhas} conferência(s) fora do esperado.\n`
  );

  process.exit(falhas === 0 ? 0 : 1);
}

main().catch(async (erro) => {
  console.error("\n  Falhou:", erro);
  await prisma.$disconnect();
  process.exit(1);
});
