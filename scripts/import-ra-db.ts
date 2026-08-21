/**
 * Reimporta o export do Reclame Aqui direto no banco, **com o contato
 * completo**.
 *
 *   npm run ra:importar -- "C:/caminho/export.xlsx"
 *   npm run ra:importar -- "C:/caminho/export.xlsx" --seco
 *
 * Por que existe, se a tela de Transferir já importa: a tela é o caminho
 * do dia a dia, mas passa por uma server action com tempo de vida
 * limitado, e um export de período completo tem centenas de linhas.
 * Aqui roda sem navegador e sem prazo.
 *
 * **O ponto todo é o `keepPii: true`.** O dataset versionado do
 * repositório (`lib/data/mockCases.ts`) guarda telefone e e-mail
 * mascarados de propósito — ele está no git. O banco não: ali o contato
 * precisa estar inteiro, senão não dá para ligar de volta, e o
 * casamento por telefone da extensão fica preso em "provável" quando
 * poderia ser exato.
 *
 * Este script **não toca no arquivo versionado**. Ele lê o .xlsx e
 * grava no Postgres, e só.
 */
import "dotenv/config";

import fs from "node:fs";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import {
  ImportFormatError,
  parseReclameAqui,
} from "../lib/services/raImport.service";

import {
  fetchCases,
  importCasesBulk,
} from "../lib/services/case.repository";

const args = process.argv.slice(2);

const seco = args.includes("--seco");

const arquivo = args.find(
  (a) => !a.startsWith("--")
);

if (!arquivo) {
  console.error(
    "\n  Uso: npm run ra:importar -- <arquivo.xlsx> [--seco]\n"
  );
  process.exit(1);
}

if (!fs.existsSync(arquivo)) {
  console.error(`\n  Arquivo não encontrado: ${arquivo}\n`);
  process.exit(1);
}

const url =
  process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!url) {
  console.error(
    "\n  DATABASE_URL não definido — não há onde gravar.\n"
  );
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: url }),
});

/** Quantos dígitos o telefone tem depois de tirar a pontuação. */
function digitos(valor?: string) {
  return (valor ?? "").replace(/\D/g, "").length;
}

async function main() {

  console.log("");
  console.log(`  Arquivo: ${arquivo}`);
  console.log(
    seco ? "  Modo seco: nada será gravado.\n" : ""
  );

  const buffer = fs.readFileSync(arquivo as string);

  let lidas;

  try {
    lidas = parseReclameAqui(buffer, { keepPii: true });
  } catch (erro) {
    if (erro instanceof ImportFormatError) {
      console.error(`\n  ${erro.message}\n`);
      process.exit(1);
    }
    throw erro;
  }

  const casos = lidas.cases;

  console.log(`  Lidas:   ${casos.length} reclamação(ões)`);

  if (lidas.from || lidas.to) {
    console.log(
      `  Janela:  ${lidas.from ?? "?"} a ${lidas.to ?? "?"}`
    );
  }

  /* ---- o que muda no contato ---- */

  const comTelefoneInteiro = casos.filter(
    (c) => digitos(c.phone) >= 10
  ).length;

  const comEmailInteiro = casos.filter(
    (c) => (c.email ?? "").includes("@") &&
      !(c.email ?? "").includes("•")
  ).length;

  console.log("");
  console.log("  CONTATO NO ARQUIVO");
  console.log(
    `    telefone completo: ${comTelefoneInteiro} de ${casos.length}`
  );
  console.log(
    `    e-mail completo:   ${comEmailInteiro} de ${casos.length}`
  );

  const antes = await fetchCases(prisma);

  const mascaradosAntes = antes.filter((c) =>
    /[•*]/.test(c.phone ?? "")
  ).length;

  console.log("");
  console.log("  NO BANCO AGORA");
  console.log(`    reclamações: ${antes.length}`);
  console.log(
    `    com telefone mascarado: ${mascaradosAntes}`
  );

  if (seco) {
    console.log("\n  Modo seco — nada gravado.\n");
    return;
  }

  console.log("\n  Gravando...");

  const r = await importCasesBulk(prisma, casos);

  const depois = await fetchCases(prisma);

  const mascaradosDepois = depois.filter((c) =>
    /[•*]/.test(c.phone ?? "")
  ).length;

  console.log("");
  console.log(`  Gravadas:    ${r.gravadas ?? 0}`);
  console.log(`  Novas:       ${r.novas ?? 0}`);
  console.log(`  Inalteradas: ${r.inalteradas ?? 0}`);
  console.log("");
  console.log(
    `  Telefone mascarado: ${mascaradosAntes} -> ${mascaradosDepois}`
  );
  console.log(`  Total na base:      ${depois.length}`);

  if (mascaradosDepois === 0) {
    console.log(
      "\n  O casamento por telefone da extensão passa a ser exato."
    );
  }

  console.log("");
}

main()
  .catch((erro) => {
    console.error("\n  FALHOU:", erro.message, "\n");
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
