/**
 * Prova que as etapas e os tipos do NPS viraram cadastro de verdade.
 *
 *   npm run check:nps-etapas
 *
 * As quatro colunas do quadro e os sete tipos do guia eram listas fixas
 * no código. Virando cadastro, três coisas passaram a poder dar errado
 * em silêncio — e nenhuma delas aparece na tela:
 *
 * 1. **O prefixo `[Encerrado]`.** É ele, e não a coluna `final`, que o
 *    resto da aplicação lê para saber que um ciclo fechou: `isEncerrado`
 *    é função pura sobre o texto do status, usada no cartão do quadro,
 *    no filtro da tela, na fila da extensão e no indicador de resolução.
 *    Uma etapa marcada como final cujo nome não carregue o prefixo
 *    produziria um encerramento que ninguém enxerga — e o indicador de
 *    resolução passaria a contar como resolvido o que continua na fila.
 *
 * 2. **O arrasto ao renomear.** A resposta guarda o texto do status, não
 *    o id da etapa. Renomear sem atualizar os registros faria os ciclos
 *    sumirem do quadro sem ninguém ter movido nada.
 *
 * 3. **Quem chega em cada final.** Uma etapa final que não liste nenhum
 *    tipo — ou um tipo que não esteja em final nenhum — cria um ciclo
 *    que entra e não sai.
 *
 * Trabalha num cadastro **descartável**, criado e apagado aqui, mais um
 * ciclo de NPS descartável. Nenhuma resposta real é tocada.
 *
 * *Um efeito colateral, de propósito:* a primeira gravação materializa
 * no banco as nove etapas e os sete tipos do guia — é a mesma semeadura
 * que a tela faz ao salvar a primeira alteração, e o resultado é
 * idêntico ao que a aplicação já devolvia com as tabelas vazias. Rodar
 * este script não muda o que a operação vê.
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import {
  emAndamento,
  finaisDoTipo,
  isEncerrado,
  NpsStageOption,
  nomeDeEtapa,
  rotuloDeEtapa,
} from "../lib/models/nps";

import {
  gravarEtapa,
  gravarTipo,
  removerEtapa,
  removerTipo,
} from "../lib/services/npsCadastro.service";

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
    `${ok ? "  ok  " : "FALHA "} ${campo.padEnd(44)} ${JSON.stringify(obtido)}`
  );

  if (!ok) {
    console.log(
      `${" ".repeat(7)}${"esperado".padEnd(44)} ${JSON.stringify(esperado)}`
    );
  }
}

const marca = Date.now().toString(36).toUpperCase();

const NOME_ETAPA = `ZZ Auditoria ${marca}`;
const NOME_TIPO = `ZZ Auditoria ${marca}`;

/** Ids criados aqui, para a limpeza saber o que apagar. */
const criados = {
  etapas: [] as string[],
  tipos: [] as string[],
  respostas: [] as string[],
};

async function limpar() {

  for (const id of criados.respostas) {
    await prisma.npsResponse
      .delete({ where: { id } })
      .catch(() => {});
  }

  for (const id of criados.etapas) {
    await prisma.npsStage
      .delete({ where: { id } })
      .catch(() => {});
  }

  for (const id of criados.tipos) {
    await prisma.npsKind
      .delete({ where: { id } })
      .catch(() => {});
  }
}

/** A etapa como o banco a tem agora. */
async function lerEtapa(id: string) {

  const r = await prisma.npsStage.findUnique({
    where: { id },
  });

  return r
    ? ({
        id: r.id,
        name: r.name,
        color: r.color,
        order: r.order,
        active: r.active,
        final: r.final,
        kinds: r.kinds,
      } as NpsStageOption)
    : null;
}

async function main() {

  console.log(
    "\nCadastro descartável:",
    NOME_ETAPA,
    "\n"
  );

  /* ============================================================
     1. O NOME NORMALIZA — SEM BANCO
  ============================================================ */

  conferir(
    "final ganha o prefixo",
    nomeDeEtapa("Auditado", true),
    "[Encerrado] Auditado"
  );

  conferir(
    "não final perde o prefixo",
    nomeDeEtapa("[Encerrado] Auditado", false),
    "Auditado"
  );

  conferir(
    "gravar duas vezes não duplica o prefixo",
    nomeDeEtapa(nomeDeEtapa("Auditado", true), true),
    "[Encerrado] Auditado"
  );

  conferir(
    "o rótulo da coluna sai sem o prefixo",
    rotuloDeEtapa("[Encerrado] Auditado"),
    "Auditado"
  );

  /* ============================================================
     2. UM TIPO NOVO
  ============================================================ */

  const idTipo = await gravarTipo(prisma, {
    id: "",
    name: NOME_TIPO,
    emoji: "🧪",
    color: "#7B3FBF",
    action: "Tipo descartável de conferência.",
    requiresConfirmation: true,
    requiresRootCause: true,
    opensProcessReview: false,
    order: 90,
    active: true,
  });

  if (!idTipo) throw new Error("Não gravou o tipo.");

  criados.tipos.push(idTipo);

  conferir(
    "tipo novo existe no banco",
    Boolean(
      await prisma.npsKind.findUnique({
        where: { id: idTipo },
      })
    ),
    true
  );

  /**
   * A primeira gravação materializa os sete do guia.
   *
   * Sem isso, criar um tipo faria os outros sumirem da tela de uma vez
   * — a listagem deixa de cair no padrão assim que existe qualquer
   * linha no banco.
   */
  conferir(
    "os sete do guia foram semeados junto",
    (await prisma.npsKind.count()) >= 8,
    true
  );

  /* ============================================================
     3. UMA ETAPA DE ANDAMENTO E UMA FINAL
  ============================================================ */

  const idAndamento = await gravarEtapa(prisma, {
    id: "",
    name: NOME_ETAPA,
    color: "#0EA5E9",
    order: 91,
    active: true,
    final: false,
    // Etapa de andamento não guarda tipo: a lista é dos finais.
    kinds: [NOME_TIPO],
  });

  if (!idAndamento) {
    throw new Error("Não gravou a etapa de andamento.");
  }

  criados.etapas.push(idAndamento);

  const andamento = await lerEtapa(idAndamento);

  conferir(
    "etapa de andamento fica sem prefixo",
    andamento?.name,
    NOME_ETAPA
  );

  conferir(
    "isEncerrado concorda com final=false",
    isEncerrado(andamento?.name ?? ""),
    false
  );

  conferir(
    "etapa de andamento não guarda tipos",
    andamento?.kinds,
    []
  );

  const idFinal = await gravarEtapa(prisma, {
    id: "",
    name: `${NOME_ETAPA} concluída`,
    color: "#22C55E",
    order: 92,
    active: true,
    final: true,
    kinds: [NOME_TIPO],
  });

  if (!idFinal) throw new Error("Não gravou a final.");

  criados.etapas.push(idFinal);

  const final = await lerEtapa(idFinal);

  conferir(
    "etapa final ganha o prefixo no banco",
    final?.name,
    `[Encerrado] ${NOME_ETAPA} concluída`
  );

  conferir(
    "isEncerrado concorda com final=true",
    isEncerrado(final?.name ?? ""),
    true
  );

  /* ============================================================
     4. A ESCADA E OS FINAIS
  ============================================================ */

  const todas = (
    await prisma.npsStage.findMany({
      orderBy: [{ order: "asc" }, { name: "asc" }],
    })
  ).map(
    (r) =>
      ({
        id: r.id,
        name: r.name,
        color: r.color,
        order: r.order,
        active: r.active,
        final: r.final,
        kinds: r.kinds,
      }) as NpsStageOption
  );

  const escada = emAndamento(todas).map((e) => e.name);

  console.log(
    "\n  escada de andamento:",
    escada.join(" → "),
    "\n"
  );

  conferir(
    "a etapa nova entrou na escada",
    escada.includes(NOME_ETAPA),
    true
  );

  conferir(
    "nenhuma etapa final entrou na escada",
    escada.some(isEncerrado),
    false
  );

  const finaisDoNovo = finaisDoTipo(
    todas,
    NOME_TIPO
  ).map((e) => e.name);

  conferir(
    "o tipo novo alcança a final nova",
    finaisDoNovo.includes(
      `[Encerrado] ${NOME_ETAPA} concluída`
    ),
    true
  );

  /**
   * Um tipo do guia **não** alcança a final restrita.
   *
   * É a metade que faz a lista valer alguma coisa: se todo tipo
   * chegasse em todo final, "Elogio" poderia ser encerrado como
   * "Sem Retorno".
   */
  conferir(
    "outro tipo não alcança a final restrita",
    finaisDoTipo(todas, "Elogio")
      .map((e) => e.name)
      .includes(`[Encerrado] ${NOME_ETAPA} concluída`),
    false
  );

  /* ============================================================
     5. RENOMEAR ARRASTA O CICLO JUNTO
  ============================================================ */

  const resposta = await prisma.npsResponse.create({
    data: {
      score: 3,
      comment: "Registro descartável de conferência.",
      respondedAt: new Date(),
      customer: `ZZ Conferência ${marca}`,
      status: NOME_ETAPA,
      kind: NOME_TIPO,
      firstContactDueAt: new Date(),
    },
    select: { id: true },
  });

  criados.respostas.push(resposta.id);

  const NOME_RENOMEADO = `${NOME_ETAPA} revisada`;

  await gravarEtapa(prisma, {
    ...(andamento as NpsStageOption),
    name: NOME_RENOMEADO,
  });

  conferir(
    "renomear a etapa moveu o ciclo junto",
    (
      await prisma.npsResponse.findUnique({
        where: { id: resposta.id },
        select: { status: true },
      })
    )?.status,
    NOME_RENOMEADO
  );

  /* ============================================================
     6. RENOMEAR O TIPO ARRASTA O CICLO **E** A ETAPA FINAL
  ============================================================ */

  const TIPO_RENOMEADO = `${NOME_TIPO} revisado`;

  await gravarTipo(prisma, {
    id: idTipo,
    name: TIPO_RENOMEADO,
    emoji: "🧪",
    color: "#7B3FBF",
    action: "Tipo descartável de conferência.",
    requiresConfirmation: true,
    requiresRootCause: true,
    opensProcessReview: false,
    order: 90,
    active: true,
  });

  conferir(
    "renomear o tipo moveu o ciclo junto",
    (
      await prisma.npsResponse.findUnique({
        where: { id: resposta.id },
        select: { kind: true },
      })
    )?.kind,
    TIPO_RENOMEADO
  );

  conferir(
    "a etapa final acompanhou o nome do tipo",
    (await lerEtapa(idFinal))?.kinds,
    [TIPO_RENOMEADO]
  );

  /* ============================================================
     7. ETAPA EM USO É DESATIVADA, NÃO APAGADA
  ============================================================ */

  const emUso = await removerEtapa(prisma, idAndamento);

  conferir(
    "excluir etapa em uso devolve quantos usam",
    emUso,
    1
  );

  conferir(
    "a etapa continua no banco, desativada",
    (await lerEtapa(idAndamento))?.active,
    false
  );

  /**
   * O ciclo continua visível.
   *
   * É a razão de desativar em vez de apagar: o status segue gravado no
   * registro, e sem a etapa o quadro não teria coluna para desenhá-lo.
   */
  conferir(
    "o ciclo parado nela não perdeu o status",
    (
      await prisma.npsResponse.findUnique({
        where: { id: resposta.id },
        select: { status: true },
      })
    )?.status,
    NOME_RENOMEADO
  );

  /* ============================================================
     8. SEM USO, APAGA MESMO
  ============================================================ */

  const semUso = await removerEtapa(prisma, idFinal);

  conferir(
    "excluir etapa sem uso devolve zero",
    semUso,
    0
  );

  conferir(
    "e ela saiu do banco",
    await lerEtapa(idFinal),
    null
  );

  const tipoEmUso = await removerTipo(prisma, idTipo);

  conferir(
    "excluir tipo em uso devolve quantos usam",
    tipoEmUso,
    1
  );

  conferir(
    "o tipo continua no banco, desativado",
    (
      await prisma.npsKind.findUnique({
        where: { id: idTipo },
        select: { active: true },
      })
    )?.active,
    false
  );

  /* ---- limpeza ---- */

  await limpar();

  conferir(
    "cadastro descartável saiu da base",
    await prisma.npsStage.findFirst({
      where: { name: { contains: marca } },
    }),
    null
  );

  await prisma.$disconnect();

  console.log(
    falhas === 0
      ? "\nEtapas e tipos do NPS se comportam como o quadro promete.\n"
      : `\n${falhas} conferência(s) fora do esperado.\n`
  );

  process.exit(falhas === 0 ? 0 : 1);
}

main().catch(async (erro) => {

  console.error("\n  Falhou:", erro);

  // Não deixa lixo para trás nem quando quebra no meio.
  await limpar().catch(() => {});

  await prisma.$disconnect();
  process.exit(1);
});
