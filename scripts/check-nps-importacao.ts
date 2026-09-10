/**
 * Reimportar do Wootric preserva o que a operação digitou?
 *
 *   npm run check:nps-importacao
 *
 * **O defeito que isto existe para não repetir.** A atualização gravava
 * `phone: item.phone || null`, e o Wootric manda telefone nulo em 100%
 * das respostas. Os 77 telefones do NPS foram digitados pela operação —
 * e uma recarga de 1 ano pela tela apagaria todos. Achado na revisão de
 * 10/09/2026.
 *
 * Usa uma resposta descartável, gravada pela função real da importação
 * (`gravarLote`), que a operação trabalha e o Wootric reimporta.
 * Apagada ao sair.
 */
import "dotenv/config";

import { getPrisma } from "../lib/prisma";

import { gravarLote } from "../lib/services/wootric.import";

const EXTERNO = "conferencia-nps-importacao";

let falhas = 0;

function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`${ok ? "  ok  " : "FALHA "} ${titulo.padEnd(50)} ${JSON.stringify(obtido)}`);
  if (!ok) console.log(`${" ".repeat(7)}${"esperado".padEnd(50)} ${JSON.stringify(esperado)}`);
}

async function main() {
  console.log("\n  NPS — reimportar do Wootric não apaga o que a operação digitou\n");

  const prisma = getPrisma();

  if (!prisma) {
    console.log("  --   sem banco\n");
    return;
  }

  const doWootric = {
    externalId: EXTERNO,
    score: 3,
    comment: "Demora no suporte.",
    respondedAt: new Date("2026-09-01T15:00:00Z"),
    customer: "conferencia.nps",
    email: "conferencia.nps@exemplo.invalid",
    phone: undefined,
    company: undefined,
    externalCompanyId: undefined,
    notasDoWootric: [],
    exigeTratativa: true,
  };

  try {
    await prisma.npsResponse.deleteMany({ where: { externalId: EXTERNO } });

    /* nasce pela importação */
    await gravarLote(prisma, [doWootric]);

    /* a operação trabalha nela */
    await prisma.npsResponse.update({
      where: { externalId: EXTERNO },
      data: {
        phone: "11 98888-7777",
        company: "Pizzaria da Conferência",
        status: "[Em contato] Tentativa 1",
      },
    });

    /* o Wootric volta, com a nota nova e o telefone nulo de sempre */
    await gravarLote(prisma, [
      { ...doWootric, score: 6, comment: "Melhorou depois do contato." },
    ]);

    const depois = await prisma.npsResponse.findUnique({
      where: { externalId: EXTERNO },
      select: { phone: true, company: true, status: true, score: true, comment: true, email: true },
    });

    conferir("telefone digitado continua", depois?.phone, "11 98888-7777");
    conferir("empresa digitada continua", depois?.company, "Pizzaria da Conferência");
    conferir("etapa da operação continua", depois?.status, "[Em contato] Tentativa 1");
    conferir("a nota nova do Wootric entra", depois?.score, 6);
    conferir("o comentário novo do Wootric entra", depois?.comment, "Melhorou depois do contato.");
    conferir("o e-mail do Wootric continua valendo", depois?.email, "conferencia.nps@exemplo.invalid");
  } finally {
    await prisma.npsResponse.deleteMany({ where: { externalId: EXTERNO } });
    await prisma.$disconnect();
  }

  console.log(
    falhas === 0
      ? "\n  Reimportar traz o que é do Wootric e deixa o resto como estava.\n"
      : `\n  ${falhas} ponto(s) em que a reimportação apagaria trabalho.\n`
  );

  process.exitCode = falhas === 0 ? 0 : 1;
}

main().catch((erro) => {
  console.error("\n  Erro:", erro);
  process.exitCode = 1;
});
