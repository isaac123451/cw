/**
 * Importar a planilha preserva o trabalho da operação?
 *
 *   npm run check:importacao
 *
 * **O defeito que isto existe para não repetir.** O botão Importar da
 * tela regravava a linha inteira de toda reclamação em que algum campo
 * da planilha diferisse do banco. Medido em 10/09/2026, sem gravar
 * nada, com a última planilha: um clique teria trocado **142 respostas
 * públicas reais** pelo marcador de 38 caracteres, **tirado o
 * responsável de 141** reclamações e refeito as etiquetas de 71.
 *
 * Duas partes:
 *
 *  1. **A regra, sem banco** — `mudancasDoPortal` com os casos que
 *     doem: marcador contra resposta real, coluna própria da operação,
 *     coluna final, contato mascarado.
 *  2. **A função real, contra o banco** — `importCasesBulk` numa
 *     reclamação descartável que recebe trabalho da operação e depois é
 *     reimportada com a versão da planilha. Tudo o que a operação fez
 *     tem de sobreviver; só o que o portal decide pode mudar.
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { Case } from "../lib/models/case";

import {
  fetchCases,
  importCasesBulk,
} from "../lib/services/case.repository";

import {
  CONTATO,
  DO_PORTAL,
  mudancasDoPortal,
  NoBancoDoPortal,
} from "../lib/services/atualizacaoDoPortal";

import { RESPOSTA_SINTETICA } from "../lib/services/raMarcadores";

let falhas = 0;

function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(
    `${ok ? "  ok  " : "FALHA "} ${titulo.padEnd(58)} ${JSON.stringify(obtido)?.slice(0, 60)}`
  );
  if (!ok) {
    console.log(`${" ".repeat(7)}${"esperado".padEnd(58)} ${JSON.stringify(esperado)?.slice(0, 60)}`);
  }
}

/* ============================================================
   1. A REGRA
============================================================ */

const BANCO: NoBancoDoPortal = {
  status: "Novo",
  publicResponse:
    "Olá, Marina. Verificamos o seu pedido e o estorno foi feito hoje, com prazo de até sete dias úteis para aparecer na fatura.",
  publicResponseAt: new Date("2026-08-20T00:00:00Z"),
  evaluated: false,
  score: null,
  resolved: false,
  wouldDoBusiness: false,
  evaluatedAt: null,
  email: "marina.lopes@exemplo.com",
  phone: "(11)•••••-1234",
  city: null,
  state: "SP",
};

function daPlanilha(parcial: Partial<Case>): Case {
  return {
    protocol: "RA-ZzRegraDaPlanilh",
    status: "Novo",
    publicResponse: RESPOSTA_SINTETICA,
    ...parcial,
  } as Case;
}

function regra() {
  console.log("\n  A REGRA — o que a planilha pode mudar\n");

  const comMarcador = mudancasDoPortal(daPlanilha({}), BANCO);

  conferir(
    "o marcador não substitui a resposta real",
    "publicResponse" in comMarcador.dados,
    false
  );

  conferir(
    "coluna própria da operação não é tocada",
    "status" in
      mudancasDoPortal(daPlanilha({ status: "Resolvido" }), {
        ...BANCO,
        status: "Em análise jurídica",
      }).dados,
    false
  );

  conferir(
    "coluna final não volta para trás",
    "status" in
      mudancasDoPortal(daPlanilha({ status: "Novo" }), {
        ...BANCO,
        status: "Resolvido",
      }).dados,
    false
  );

  conferir(
    "coluna do portal anda para frente",
    mudancasDoPortal(
      daPlanilha({ status: "Aguardando avaliação" }),
      BANCO
    ).dados.status,
    "Aguardando avaliação"
  );

  const contato = mudancasDoPortal(
    daPlanilha({
      phone: "11 98765-1234",
      email: "outro@exemplo.com",
      city: "Campinas",
      state: "RJ",
    }),
    BANCO
  ).dados;

  conferir("telefone mascarado no banco é completado", contato.phone, "11 98765-1234");
  conferir("cidade vazia no banco é completada", contato.city, "Campinas");
  conferir("e-mail real no banco fica", "email" in contato, false);
  conferir("UF real no banco fica", "state" in contato, false);

  conferir(
    "máscara da planilha nunca entra",
    "phone" in
      mudancasDoPortal(daPlanilha({ phone: "(11)•••••-9999" }), {
        ...BANCO,
        phone: null,
      }).dados,
    false
  );

  const permitidos = new Set<string>([...DO_PORTAL, ...CONTATO]);

  const tudo = mudancasDoPortal(
    daPlanilha({
      status: "Aguardando avaliação",
      owner: "Outra pessoa",
      priority: "Baixa",
      category: "Outra categoria",
      draftResponse: "",
      churnRisk: false,
      tags: [],
      publicResponse: "Resposta nova de verdade, escrita no portal.",
    } as Partial<Case>),
    BANCO
  ).dados;

  conferir(
    "nada fora dos campos do portal e do contato",
    Object.keys(tudo).filter((k) => !permitidos.has(k)),
    []
  );
}

/* ============================================================
   2. A FUNÇÃO, CONTRA O BANCO
============================================================ */

const PROTOCOLO = "RA-ZzConferenciaImp";

async function funcao(prisma: PrismaClient) {
  console.log("\n  A FUNÇÃO — importCasesBulk numa reclamação descartável\n");

  const modelo = (await fetchCases(prisma)).find((c) =>
    c.protocol.startsWith("RA-")
  );

  const dono = await prisma.user.findFirst({
    where: { active: true },
    select: { id: true, name: true },
  });

  const etiqueta = await prisma.tag.findFirst({ select: { id: true } });

  if (!modelo || !dono || !etiqueta) {
    console.log("  --   base sem reclamação, usuário ou etiqueta para montar o teste");
    return;
  }

  const nova: Case = {
    ...modelo,
    id: PROTOCOLO,
    protocol: PROTOCOLO,
    status: "Novo",
    publicResponse: RESPOSTA_SINTETICA,
    evaluated: false,
    score: undefined,
    evaluatedAt: undefined,
    tags: [],
    owner: undefined,
  };

  try {
    /* nasce pela importação, como uma reclamação nova da planilha */
    const primeira = await importCasesBulk(prisma, [nova]);

    conferir("reclamação nova entra inteira", primeira.novas, 1);

    /* a operação trabalha nela */
    const RESPOSTA_REAL =
      "Olá! Refizemos a configuração da sua loja e o problema foi resolvido. Qualquer coisa, estamos aqui.";

    const trabalhada = await prisma.case.update({
      where: { protocol: PROTOCOLO },
      data: {
        ownerId: dono.id,
        draftResponse: "Rascunho que a operação estava escrevendo.",
        churnRisk: true,
        priority: "CRITICA",
        publicResponse: RESPOSTA_REAL,
        tags: { create: [{ tagId: etiqueta.id }] },
      },
      select: { id: true, categoryId: true },
    });

    /* a planilha volta, sem saber de nada disso */
    const segunda = await importCasesBulk(prisma, [
      {
        ...nova,
        status: "Aguardando avaliação",
        priority: "Baixa",
        category: `${modelo.category} (outra)`,
        publicResponse: RESPOSTA_SINTETICA,
        evaluated: true,
        score: 8,
      },
    ]);

    conferir("a reimportação atualiza a reclamação", segunda.gravadas, 1);

    const depois = await prisma.case.findUnique({
      where: { protocol: PROTOCOLO },
      select: {
        ownerId: true,
        draftResponse: true,
        churnRisk: true,
        priority: true,
        categoryId: true,
        publicResponse: true,
        status: true,
        evaluated: true,
        score: true,
        _count: { select: { tags: true } },
      },
    });

    conferir("responsável continua", depois?.ownerId, dono.id);
    conferir("rascunho continua", depois?.draftResponse, "Rascunho que a operação estava escrevendo.");
    conferir("risco de cancelamento continua", depois?.churnRisk, true);
    conferir("prioridade da operação continua", depois?.priority, "CRITICA");
    conferir("categoria da operação continua", depois?.categoryId, trabalhada.categoryId);
    conferir("etiqueta da operação continua", depois?._count.tags, 1);
    conferir("a resposta real não vira marcador", depois?.publicResponse, RESPOSTA_REAL);
    conferir("a etapa anda, porque o portal diz", depois?.status, "Aguardando avaliação");
    conferir("e a avaliação do portal entra", [depois?.evaluated, depois?.score], [true, 8]);
  } finally {
    await prisma.caseTag.deleteMany({ where: { case: { protocol: PROTOCOLO } } });
    await prisma.case.deleteMany({ where: { protocol: PROTOCOLO } });
  }
}

async function main() {
  regra();

  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;

  if (!url) {
    console.log("\n  --   sem banco: a parte 2 depende dele\n");
  } else {
    const prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: url }),
    });

    try {
      await funcao(prisma);
    } finally {
      await prisma.$disconnect();
    }
  }

  console.log(
    falhas === 0
      ? "\n  A planilha só muda o que é do portal. O trabalho da operação fica.\n"
      : `\n  ${falhas} ponto(s) em que a importação desfaria trabalho.\n`
  );

  process.exitCode = falhas === 0 ? 0 : 1;
}

main().catch((erro) => {
  console.error("\n  Erro:", erro);
  process.exitCode = 1;
});
