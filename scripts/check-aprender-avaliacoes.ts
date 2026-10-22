/**
 * A IA aprende com o resultado das respostas públicas (22/10/2026).
 *
 *   npm run check:aprender-avaliacoes
 *
 * Contra a base real, sem chamar a IA (a leitura é trocada por uma que só
 * olha o que iria):
 *
 *  1. vai exemplo dos dois lados — avaliação boa e ruim;
 *  2. nada que identifique alguém sai daqui: e-mail, telefone, CPF, CNPJ;
 *  3. no máximo uma leitura por dia;
 *  4. o que a IA aprendeu chega ao pedido das sugestões de resposta quando
 *     a conversa é do mesmo assunto, e não chega quando não é.
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { aprenderComAsAvaliacoes, saberParaOPrompt } from "../lib/services/aprendizados.service";

let falhas = 0;
function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(66)} ${JSON.stringify(obtido)?.slice(0, 60)}`);
  if (!ok) console.log(`        ${"esperado".padEnd(66)} ${JSON.stringify(esperado)?.slice(0, 60)}`);
}

async function main() {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) {
    console.log("  --   sem banco");
    return;
  }
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    let lidos: string[] = [];
    const espiao = async (blocos: string[]) => {
      lidos = blocos;
      return 0;
    };
    await aprenderComAsAvaliacoes(prisma, { forcar: true, extrair: espiao });
    const tudo = lidos.join("\n");
    conferir("vão exemplos dos dois lados (boa e ruim)", [lidos.some((b) => b.startsWith("[BOA]")), lidos.some((b) => b.startsWith("[RUIM]"))], [true, true]);
    conferir("nenhum e-mail, telefone, CPF ou CNPJ vai para a IA", [/[\w.+-]+@[\w-]+\.\w/.test(tudo), /\(?\d{2}\)?\s?9\d{4}-?\d{4}/.test(tudo), /\d{3}\.\d{3}\.\d{3}-\d{2}/.test(tudo), /\d{2}\.\d{3}\.\d{3}\/\d{4}/.test(tudo)], [false, false, false, false]);
    lidos = [];
    await aprenderComAsAvaliacoes(prisma, { extrair: espiao });
    conferir("uma leitura por dia: a segunda no mesmo dia não lê", lidos.length, 0);

    const estorno = await saberParaOPrompt(prisma, "cliente cobrando o estorno do reembolso que não caiu, quer saber o prazo");
    conferir("conversa de estorno recebe o que o time aprendeu", estorno.includes("O que o time já aprendeu"), true);
    conferir("conversa sem assunto não recebe nada", await saberParaOPrompt(prisma, "bom dia, tudo bem?"), "");
  } finally {
    await prisma.$disconnect();
  }
  console.log(falhas ? `\n  ${falhas} ponto(s) a corrigir.\n` : "\n  A IA aprende com as avaliações sem levar dado de ninguém, e usa o que aprendeu.\n");
  if (falhas) process.exitCode = 1;
}

main();
