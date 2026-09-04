/**
 * A carga do quadro ficou mais rápida sem mudar um dado?
 *
 *   npm run check:carga
 *
 * **Por que esta conferência é obrigatória.** `fetchCases` deixou de
 * usar o `include` do Prisma e passou a fazer um SELECT com JOIN
 * escrito à mão. O ganho é grande — de 541 ms para 124 ms, mediana de
 * cinco execuções contra a base real — e o risco também: SQL à mão não
 * acompanha o schema sozinho. Uma coluna renomeada, um `LEFT JOIN` que
 * virou `JOIN`, um campo esquecido, e a lista passa a mentir em silêncio
 * sobre trezentas reclamações.
 *
 * Então a conferência compara os dois caminhos **campo a campo, em
 * todos os casos**: a consulta nova contra a mesma leitura feita pelo
 * Prisma, do jeito antigo. Qualquer divergência aparece com o protocolo,
 * o campo e os dois valores.
 *
 * `description`, `dossier` e `publicResponse` são exceção declarada: os
 * três saem da lista de propósito, e a comparação sabe disso.
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { fetchCases } from "../lib/services/case.repository";
import { toCaseModel } from "../lib/services/case.mapper";
import type { Case } from "../lib/models/case";

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

function ok(titulo: string, detalhe = "") {
  console.log(
    `  ok     ${titulo}${detalhe ? `\n         ${detalhe}` : ""}`
  );
}

function falhar(titulo: string, detalhe: string) {
  falhas += 1;
  console.log(`FALHA    ${titulo}\n         ${detalhe}`);
}

/**
 * Os três que a lista não carrega, de propósito.
 *
 * Estão aqui como lista e não como silêncio: quem ler a conferência
 * precisa saber o que ela **não** compara, senão o verde vira promessa
 * maior do que ela cumpre.
 */
const FORA_DA_LISTA = new Set([
  "description",
  "dossier",
  "publicResponse",
]);

/** A mesma leitura, do jeito antigo — a referência. */
async function peloPrisma(): Promise<Case[]> {

  const rows = await prisma.case.findMany({
    include: {
      category: { select: { name: true } },
      subcategory: { select: { name: true } },
      owner: { select: { name: true } },
      team: { select: { name: true } },
      tags: {
        include: { tag: { select: { name: true } } },
      },
      establishment: { select: { name: true } },
    },
    orderBy: { publishedAt: "desc" },
  });

  return rows.map((row) => toCaseModel(row));
}

function comparavel(valor: unknown) {

  if (valor === null || valor === undefined) return "";

  if (Array.isArray(valor)) {
    return [...valor].sort().join("|");
  }

  return String(valor);
}

async function medir(
  nome: string,
  f: () => Promise<unknown>,
  vezes = 5
) {

  /* Aquece: a primeira conexão custa mais de um segundo. */
  await f();

  const tempos: number[] = [];

  for (let i = 0; i < vezes; i += 1) {
    const t = Date.now();
    await f();
    tempos.push(Date.now() - t);
  }

  tempos.sort((a, b) => a - b);

  const mediana = tempos[Math.floor(tempos.length / 2)];

  console.log(
    `  ${nome.padEnd(30)} mediana ${String(mediana).padStart(5)} ms   (${tempos.join(", ")})`
  );

  return mediana;
}

async function main() {

  console.log(
    "\n  CARGA DO QUADRO — mais rápida, e igual\n"
  );

  const novo = await fetchCases(prisma);
  const antigo = await peloPrisma();

  console.log(
    `  ${novo.length} pelo caminho novo · ${antigo.length} pelo antigo\n`
  );

  if (novo.length !== antigo.length) {
    falhar(
      "os dois caminhos trazem a mesma quantidade",
      `novo ${novo.length}, antigo ${antigo.length}`
    );
  } else {
    ok(
      "os dois caminhos trazem a mesma quantidade",
      `${novo.length} reclamações`
    );
  }

  /* ---------------- campo a campo ---------------- */

  const porProtocolo = new Map(
    antigo.map((c) => [c.protocol, c])
  );

  const divergencias: string[] = [];

  const campos = new Set<string>();

  for (const c of [...novo, ...antigo]) {
    for (const k of Object.keys(c)) campos.add(k);
  }

  for (const n of novo) {

    const a = porProtocolo.get(n.protocol);

    if (!a) {
      divergencias.push(
        `${n.protocol}: existe no caminho novo e não no antigo`
      );
      continue;
    }

    for (const campo of campos) {

      if (FORA_DA_LISTA.has(campo)) continue;

      /*
        `respondida` é o campo que substituiu o texto: no caminho
        antigo ele nasce do `publicResponse`, no novo vem do SELECT.
        Comparar os dois é justamente o ponto — se divergirem, o índice
        de resposta muda e a nota junto.
      */
      const x = comparavel(
        (n as unknown as Record<string, unknown>)[campo]
      );

      const y = comparavel(
        (a as unknown as Record<string, unknown>)[campo]
      );

      if (x !== y) {
        divergencias.push(
          `${n.protocol} · ${campo}: novo="${x.slice(0, 40)}" antigo="${y.slice(0, 40)}"`
        );
      }
    }
  }

  if (divergencias.length === 0) {
    ok(
      "todo campo é idêntico nos dois caminhos",
      `${campos.size - FORA_DA_LISTA.size} campos × ${novo.length} reclamações, sem uma diferença`
    );
  } else {
    falhar(
      "todo campo é idêntico nos dois caminhos",
      divergencias.slice(0, 12).join("\n         ") +
        (divergencias.length > 12
          ? `\n         … e mais ${divergencias.length - 12}`
          : "")
    );
  }

  /* ---------------- e a ordem ---------------- */

  const ordemIgual = novo.every(
    (c, i) => c.protocol === antigo[i]?.protocol
  );

  if (ordemIgual) {
    ok(
      "a ordem é a mesma",
      "mais recente primeiro, como o quadro espera"
    );
  } else {
    falhar(
      "a ordem é a mesma",
      "a lista chegaria embaralhada em relação ao que a tela mostrava"
    );
  }

  /* ---------------- o tempo ---------------- */

  console.log("");

  const rapido = await medir("caminho novo (JOIN)", () =>
    fetchCases(prisma)
  );

  const lento = await medir(
    "caminho antigo (include)",
    peloPrisma
  );

  console.log("");

  /**
   * O piso da rede, medido no mesmo instante.
   *
   * **Por que o teto absoluto sozinho nao serve como conferencia.** Uma
   * maquina no Brasil falando com o Supabase por internet aberta paga
   * de 60 a 300 ms so para dizer "ola" — e esse numero muda a cada
   * hora do dia. Reprovar a carga por causa disso seria reprovar a
   * operadora, e um verificador que falha por causa do ambiente ensina
   * a ignorar o vermelho dele.
   *
   * Entao a conferencia tem duas partes:
   *
   * 1. **Sempre:** o caminho novo e´ mais rapido que o antigo. E´ o que
   *    protege a otimizacao de ser desfeita sem querer.
   * 2. **So quando a rede esta boa** (piso abaixo de 100 ms): o teto de
   *    500 ms que o Isaac pediu. Nessa condicao a medida representa o
   *    que a producao vai sentir, com funcao e banco na mesma regiao.
   */
  const piso = await medir(
    "piso da rede (só contar)",
    () => prisma.case.count()
  );

  console.log("");

  const TETO = 500;

  if (rapido < lento) {
    ok(
      "o caminho novo é mais rápido que o antigo",
      `${rapido} ms contra ${lento} ms — ${(lento / rapido).toFixed(1)}× mais rápido`
    );
  } else {
    falhar(
      "o caminho novo é mais rápido que o antigo",
      `novo ${rapido} ms, antigo ${lento} ms. A troca por SQL cru deixou de valer a pena.`
    );
  }

  if (piso >= 100) {
    console.log(
      [
        `  --     teto de ${TETO} ms não avaliado`,
        `         O piso da rede aqui está em ${piso} ms — só o "olá" ao banco.`,
        "         Medir o teto nessa condição mede a operadora, não a consulta.",
        "         Na Vercel, com função e banco na mesma região, o piso é de",
        "         poucos milissegundos e o teto passa a valer.",
      ].join("\n")
    );
  } else if (rapido <= TETO) {
    ok(
      `a carga cabe em ${TETO} ms`,
      `${rapido} ms, com piso de rede em ${piso} ms`
    );
  } else {
    falhar(
      `a carga cabe em ${TETO} ms`,
      `${rapido} ms, e o piso da rede é só ${piso} ms — a diferença é a consulta, não a rede.`
    );
  }

  console.log(
    falhas === 0
      ? "\n  Mais rápida, e nem um dado diferente.\n"
      : `\n  ${falhas} ponto(s) a corrigir.\n`
  );

  await prisma.$disconnect();
  process.exitCode = falhas === 0 ? 0 : 1;
}

main().catch(async (erro) => {
  console.error("\n  Erro:", erro);
  await prisma.$disconnect();
  process.exitCode = 1;
});
