/**
 * Prova o casamento por telefone contra o banco de verdade.
 *
 *   npm run check:contato
 *
 * A extensão sai do WhatsApp com um número inteiro — `5527999996862` —
 * e precisa achar a reclamação certa numa base cujo telefone está
 * **mascarado**: `(27)•••••-4053`, só DDD e os quatro últimos dígitos.
 * Isso não é detalhe de implementação, é a regra que decide se o painel
 * serve ou engana.
 *
 * Então aqui, para cada reclamação da base, é montado um número no
 * formato que o WhatsApp entregaria — mesmo DDD, mesmos quatro finais,
 * miolo aleatório — e o casamento roda como rodaria em produção. O que
 * o relatório responde:
 *
 *   1. o número sintético reencontra a própria reclamação?
 *   2. quantas vezes a chave aponta para mais de um cliente?
 *   3. os formatos que o WhatsApp usa (com +55, com espaço, com
 *      parênteses, sem DDI) chegam todos no mesmo lugar?
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import {
  chaveTelefone,
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

/** Número no formato que o WhatsApp entregaria para esta linha. */
function comoNoWhatsApp(mascarado: string) {

  const lido = lerTelefone(mascarado);

  if (!lido?.ddd || !lido.ultimos4) return null;

  const miolo = String(
    Math.floor(Math.random() * 10000)
  ).padStart(4, "0");

  return `55${lido.ddd}9${miolo}${lido.ultimos4}`;
}

async function main() {

  const casos = await prisma.case.findMany({
    select: {
      protocol: true,
      customer: true,
      phone: true,
    },
  });

  const comTelefone = casos.filter(
    (item) => (item.phone ?? "").trim() !== ""
  );

  console.log("");
  console.log(`  Reclamações no banco: ${casos.length}`);
  console.log(`  Com telefone:         ${comTelefone.length}`);

  let reencontrou = 0;
  let unico = 0;
  let ambiguo = 0;
  let perdeu = 0;

  const chavesAmbiguas: string[] = [];

  for (const alvo of comTelefone) {

    const doWhatsApp = comoNoWhatsApp(alvo.phone as string);

    if (!doWhatsApp) {
      perdeu += 1;
      continue;
    }

    const lido = lerTelefone(doWhatsApp);

    const encontrados = comTelefone.filter((item) =>
      compararTelefone(lido, lerTelefone(item.phone))
    );

    const achouOProprio = encontrados.some(
      (item) => item.protocol === alvo.protocol
    );

    if (!achouOProprio) {
      perdeu += 1;
      continue;
    }

    reencontrou += 1;

    const pessoas = new Set(
      encontrados.map((item) =>
        item.customer.toLowerCase().trim()
      )
    );

    if (pessoas.size > 1) {
      ambiguo += 1;

      const chave = chaveTelefone(lido);
      if (chave) chavesAmbiguas.push(chave);
    } else {
      unico += 1;
    }
  }

  const porcento = (parte: number) =>
    comTelefone.length === 0
      ? "0%"
      : `${((parte / comTelefone.length) * 100).toFixed(1)}%`;

  console.log("");
  console.log("  NÚMERO DO WHATSAPP → RECLAMAÇÃO DA BASE");
  console.log(
    `    reencontrou a própria:      ${reencontrou} (${porcento(reencontrou)})`
  );
  console.log(
    `      e aponta para um cliente: ${unico} (${porcento(unico)})`
  );
  console.log(
    `      aponta para mais de um:   ${ambiguo} (${porcento(ambiguo)})`
  );
  console.log(
    `    não reencontrou:            ${perdeu} (${porcento(perdeu)})`
  );

  if (chavesAmbiguas.length > 0) {
    console.log("");
    console.log(
      `    chaves ambíguas: ${[...new Set(chavesAmbiguas)].join(", ")}`
    );
    console.log(
      "    (o painel marca estes casos como 'ambíguo' e avisa na tela)"
    );
  }

  /* ---- formatos ---- */

  const exemplo = comTelefone.find((item) =>
    lerTelefone(item.phone)
  );

  if (exemplo) {

    const lidoBase = lerTelefone(exemplo.phone);
    const ddd = lidoBase?.ddd ?? "11";
    const fim = lidoBase?.ultimos4 ?? "0000";

    const formatos = [
      `+55 ${ddd} 91234-${fim}`,
      `55${ddd}91234${fim}`,
      `(${ddd}) 91234-${fim}`,
      `${ddd}91234${fim}`,
      `+55 (${ddd}) 1234-${fim}`,
      `91234${fim}`,
    ];

    console.log("");
    console.log("  FORMATOS DE ENTRADA");

    for (const formato of formatos) {

      const resultado = compararTelefone(
        lerTelefone(formato),
        lidoBase
      );

      console.log(
        `    ${formato.padEnd(22)} ${
          resultado ?? "não casa"
        }`
      );
    }

    console.log("");
    console.log(
      "    O último caso — celular sem DDD — casa mesmo assim: sem DDD"
    );
    console.log(
      "    dos dois lados a comparação usa só os quatro finais, o que é"
    );
    console.log(
      "    mais frouxo. O painel rotula como 'provável', nunca 'exata'."
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
