/**
 * Prova que estreitar no banco não perdeu nenhum caso.
 *
 *   npm run check:busca
 *
 * O painel da extensão carregava as 334 reclamações inteiras — 1.448 ms
 * e 233 KB por consulta — e decidia em JavaScript quem casava com o
 * contato. Agora o banco estreita antes, e o casamento decide sobre os
 * candidatos.
 *
 * A troca só é válida se o filtro do banco for um **superconjunto** do
 * que o casamento aceitaria. Este script confere isso do único jeito
 * confiável: para uma amostra de contatos reais da base, roda as duas
 * versões e compara conjunto com conjunto.
 *
 * E mede as duas, porque o motivo da mudança foi o tempo.
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import {
  fetchCandidateCases,
  fetchCases,
} from "../lib/services/case.repository";

import {
  compararTelefone,
  lerTelefone,
} from "../lib/services/contato.service";

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

/** O casamento por telefone, isolado — é o caminho mais usado. */
function casamPorTelefone<
  T extends { phone?: string },
>(base: T[], telefone: string): T[] {
  const lido = lerTelefone(telefone);

  return base.filter((item) =>
    compararTelefone(lido, lerTelefone(item.phone))
  );
}

async function main() {

  console.log("\nCarregando a base inteira (o jeito antigo)…\n");

  const antes = Date.now();
  const tudo = await fetchCases(prisma);
  const msTudo = Date.now() - antes;

  console.log(
    `  ${tudo.length} reclamações em ${msTudo} ms\n`
  );

  /** Amostra de contatos que existem de verdade. */
  const amostra = tudo
    .filter((item) => (item.phone ?? "").trim() !== "")
    .slice(0, 12);

  console.log(
    `Comparando as duas buscas em ${amostra.length} contatos reais\n`
  );

  let somaCandidatos = 0;
  let somaMs = 0;

  for (const referencia of amostra) {

    const telefone = referencia.phone!;

    /* ---- jeito antigo: filtra a base inteira ---- */
    const esperado = casamPorTelefone(tudo, telefone)
      .map((item) => item.protocol)
      .sort();

    /* ---- jeito novo: o banco estreita, o JS decide ---- */
    const t = Date.now();

    const candidatos = await fetchCandidateCases(prisma, {
      digitosDoTelefone: telefone.replace(/\D/g, ""),
    });

    somaMs += Date.now() - t;
    somaCandidatos += candidatos.length;

    const obtido = casamPorTelefone(candidatos, telefone)
      .map((item) => item.protocol)
      .sort();

    const igual =
      JSON.stringify(esperado) === JSON.stringify(obtido);

    if (!igual) {
      falhas += 1;
      console.log(
        `  FALHA ${telefone}: antes ${esperado.length}, agora ${obtido.length}`
      );
      console.log(
        `        faltando: ${esperado.filter((p) => !obtido.includes(p)).join(", ")}`
      );
    }
  }

  console.log(
    falhas === 0
      ? `  ok    os ${amostra.length} contatos encontram exatamente os mesmos casos`
      : `  ${falhas} contato(s) perderam casos`
  );

  console.log(
    `\n  candidatos por consulta: ${(somaCandidatos / amostra.length).toFixed(1)} (era ${tudo.length})`
  );
  console.log(
    `  tempo por consulta:      ${(somaMs / amostra.length).toFixed(0)} ms (era ${msTudo} ms)`
  );

  /* ---- o nome do estabelecimento também entra ---- */

  console.log("\nBusca pelo nome da empresa\n");

  const comEmpresa = tudo.find(
    (item) =>
      item.company &&
      item.company !== item.customer &&
      item.company.trim().split(/\s+/).length >= 2
  );

  if (!comEmpresa) {
    console.log(
      "  (nenhum caso com empresa diferente do consumidor na base — nada a conferir)"
    );
  } else {

    const achados = await fetchCandidateCases(prisma, {
      nome: comEmpresa.company,
    });

    const achou = achados.some(
      (item) => item.protocol === comEmpresa.protocol
    );

    if (!achou) falhas += 1;

    console.log(
      `  ${achou ? "ok   " : "FALHA"} "${comEmpresa.company}" encontra ${comEmpresa.protocol}`
    );
  }

  /* ---- e sem nada para procurar, não devolve a base ---- */

  const vazio = await fetchCandidateCases(prisma, {});

  if (vazio.length !== 0) falhas += 1;

  console.log(
    `  ${vazio.length === 0 ? "ok   " : "FALHA"} sem contato, devolve ${vazio.length} casos (tem de ser 0)`
  );

  await prisma.$disconnect();

  console.log(
    falhas === 0
      ? "\nA busca ficou rápida sem perder nenhum caso.\n"
      : `\n${falhas} conferência(s) fora do esperado.\n`
  );

  process.exitCode = falhas === 0 ? 0 : 1;
}

main().catch((erro) => {
  console.error("\n  Falhou:", erro);
  process.exitCode = 1;
});
