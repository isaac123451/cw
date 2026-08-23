/**
 * Prova o modo incremental da carga contra o banco real.
 *
 *   npm run check:incremental
 *
 * O modo `--somente-novas` é o do dia a dia: chega um export novo do
 * portal e a pergunta é "o que aqui ainda não está lá?". Ele tem duas
 * obrigações opostas, e errar qualquer uma é caro:
 *
 * 1. **Criar o que falta.** Se ele não criar, a reclamação nova some e
 *    ninguém percebe — o comando termina dizendo "nada a criar".
 * 2. **Não tocar no que existe.** Se ele regravar, leva junto a etapa
 *    para onde a operação moveu o caso, as etiquetas e as anotações. O
 *    portal reescreve status e nota; quem move o caso no quadro é gente.
 *
 * A prova monta uma planilha **descartável** com duas linhas: uma que já
 * está na base (com a etapa mexida de propósito, para ver se sobrevive)
 * e uma inventada. Depois apaga a inventada e o arquivo.
 *
 * Nenhuma reclamação real é criada nem alterada.
 */
import "dotenv/config";

import { unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

import * as XLSX from "xlsx";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const url =
  process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!url) {
  console.error("\n  DATABASE_URL não definido.\n");
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
    `${ok ? "  ok  " : "FALHA "} ${campo.padEnd(50)} ${JSON.stringify(obtido)}`
  );

  if (!ok) {
    console.log(
      `${" ".repeat(7)}${"esperado".padEnd(50)} ${JSON.stringify(esperado)}`
    );
  }
}

/**
 * O comando roda pelo Node, e não pelo `npx`.
 *
 * No Windows, `npx` é um `.cmd`, e `execFileSync` não sabe executar
 * arquivo de lote sem shell — falhava com `pid 0` e nenhuma saída.
 * Chamar o CLI do `tsx` direto pelo `process.execPath` não depende de
 * shell nenhum, e é o mesmo binário que o `npm run` usaria.
 */
const tsxCli = createRequire(import.meta.url).resolve(
  "tsx/cli"
);

function rodarCarga(arquivo: string) {
  return execFileSync(
    process.execPath,
    [
      tsxCli,
      "scripts/import-ra-completo.ts",
      "--base",
      arquivo,
      "--somente-novas",
      "--gravar",
    ],
    { encoding: "utf8", cwd: process.cwd() }
  );
}

const marca = Date.now().toString(36).toUpperCase();
const idNovo = `ZZINC${marca}`;
const protocoloNovo = `RA-${idNovo}`;

const arquivo = resolve(
  process.cwd(),
  `_check-incremental-${marca}.xlsx`
);

/** As colunas do relatório "Previsão para o RA1000", na ordem dele. */
const COLUNAS = [
  "Data Reclamação",
  "Status RA",
  "Título",
  "Nome",
  "Seu problema foi resolvido?",
  "Voltaria a fazer negócio?",
  "Nota",
  "Texto da Reclamação",
  "Data Avaliacao",
  "Motivo da Reclamação RA",
  "Sentimento RA*",
  "CPF/CNPJ",
  "Email",
  "Telefones",
  "Cidade",
  "Estado",
  "Data de Resposta",
  "ID Reclame Aqui",
];

function linha(valores: Record<string, string>) {
  return COLUNAS.map((c) => valores[c] ?? "");
}

async function main() {

  console.log("\n  CARGA INCREMENTAL\n");

  /* ---------- de onde partir ---------- */

  const antes = await prisma.case.count();

  const existente = await prisma.case.findFirst({
    where: { protocol: { startsWith: "RA-" } },
    select: {
      protocol: true,
      status: true,
      title: true,
      publishedAt: true,
      customer: true,
    },
    orderBy: { protocol: "asc" },
  });

  if (!existente) {
    console.error("  Base vazia — nada a conferir.\n");
    process.exit(1);
  }

  console.log(
    `  base: ${antes} reclamações · a existente do teste é ${existente.protocol} (etapa "${existente.status}")\n`
  );

  /**
   * A linha da existente vem com a etapa **oposta** à que está no banco.
   *
   * É o que torna a segunda obrigação verificável: se a carga tocar no
   * que já existe, a etapa muda, e a conferência pega.
   */
  const statusRaContrario =
    existente.status === "Resolvido"
      ? "Não respondida"
      : "Avaliado Resolvido";

  const dataBr = (d: Date) =>
    `${String(d.getUTCDate()).padStart(2, "0")}/${String(
      d.getUTCMonth() + 1
    ).padStart(2, "0")}/${d.getUTCFullYear()} 09:00`;

  const grade = [
    ["Previsão para o RA1000"],
    [],
    [],
    COLUNAS,
    linha({
      "Data Reclamação": dataBr(existente.publishedAt),
      "Status RA": statusRaContrario,
      Título: existente.title,
      Nome: existente.customer,
      "ID Reclame Aqui": existente.protocol.replace(
        /^RA-/,
        ""
      ),
    }),
    linha({
      "Data Reclamação": "15/06/2026 14:30",
      "Status RA": "Respondido",
      Título: `ZZ Incremental ${marca}`,
      Nome: "Consumidor Descartável",
      "Texto da Reclamação":
        "Reclamação descartável criada pelo check:incremental.",
      "CPF/CNPJ": "12345678901",
      Email: "descartavel@exemplo.com",
      Telefones: "11999990000",
      Cidade: "São Paulo",
      Estado: "SP",
      "Data de Resposta": "15/06/2026 16:00",
      "ID Reclame Aqui": idNovo,
    }),
  ];

  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(grade),
    "Relatório de Tickets"
  );

  XLSX.writeFile(wb, arquivo);

  /* ---------- roda o comando de verdade ---------- */

  const saida = rodarCarga(arquivo);

  const disse = (trecho: string) =>
    saida.includes(trecho);

  conferir(
    "1. reconheceu a que já existe",
    disse("1 já estão lá e 1 são novas"),
    true
  );

  /* ---------- o que aconteceu no banco ---------- */

  const depois = await prisma.case.count();

  conferir(
    "2. criou exatamente uma",
    depois - antes,
    1
  );

  const nova = await prisma.case.findUnique({
    where: { protocol: protocoloNovo },
    select: {
      title: true,
      phone: true,
      email: true,
      document: true,
      status: true,
    },
  });

  conferir(
    "2. com o título do arquivo",
    nova?.title,
    `ZZ Incremental ${marca}`
  );

  conferir(
    "2. e com o contato completo",
    `${nova?.phone} ${nova?.email}`,
    "11999990000 descartavel@exemplo.com"
  );

  conferir(
    "2. o CPF virou documento",
    nova?.document,
    "12345678901"
  );

  const intacta = await prisma.case.findUnique({
    where: { protocol: existente.protocol },
    select: { status: true },
  });

  /**
   * A obrigação que ninguém lembra de testar.
   *
   * A linha da existente foi para o arquivo com a etapa trocada. Se ela
   * mudou no banco, a carga sobrescreveu o que a operação tinha feito —
   * e esse é o tipo de perda que só aparece dias depois, quando alguém
   * pergunta por que o caso voltou para "Novo".
   */
  conferir(
    "3. não mexeu na que já existia",
    intacta?.status,
    existente.status
  );

  /* ---------- rodar de novo não cria de novo ---------- */

  rodarCarga(arquivo);

  conferir(
    "4. segunda passada não duplica",
    await prisma.case.count(),
    depois
  );
}

main()
  .catch((erro) => {
    falhas += 1;
    console.error("\n  ERRO:", erro?.stdout ?? erro);
  })
  .finally(async () => {

    await prisma.case
      .deleteMany({ where: { protocol: protocoloNovo } })
      .catch(() => {});

    await prisma.clientProfile
      .deleteMany({
        where: { slug: "consumidor-descartavel" },
      })
      .catch(() => {});

    try {
      unlinkSync(arquivo);
    } catch {
      /* já não existe */
    }

    await prisma.$disconnect();

    console.log(
      falhas === 0
        ? "\n  A carga incremental cria o que falta e não toca no resto.\n"
        : `\n  ${falhas} falha(s).\n`
    );

    process.exit(falhas === 0 ? 0 : 1);
  });
