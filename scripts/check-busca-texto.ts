/**
 * Prova a busca da tela contra a base real.
 *
 *   npm run check:busca-texto
 *
 * Não confundir com `check:busca`, que mede a consulta de candidatos da
 * extensão. Esta aqui é o campo "Buscar" do Kanban e da lista — a caixa
 * onde quem atende digita o que tem na mão.
 *
 * **Ela passou meses sem procurar por telefone.** A regra vivia dentro
 * de um `useMemo` do `CaseContext`, onde nada podia exercitá-la, e a
 * lista de campos simplesmente não incluía `phone`. Quem chegava com o
 * número do WhatsApp não achava nada e concluía que o caso não existia.
 * Por isso a regra saiu para `case.service` e por isso este script
 * existe: ele roda **a mesma função** que a tela roda.
 *
 * Os termos são tirados da própria base a cada execução — nada fixo,
 * nada inventado. Se a base mudar, o teste continua valendo.
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { casaComTermo } from "../lib/services/case.service";
import { toCaseModel } from "../lib/services/case.mapper";

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
    `${ok ? "  ok  " : "FALHA "} ${campo.padEnd(52)} ${JSON.stringify(obtido)}`
  );

  if (!ok) {
    console.log(
      `${" ".repeat(7)}${"esperado".padEnd(52)} ${JSON.stringify(esperado)}`
    );
  }
}

/** Máscara de telefone como uma pessoa digitaria. */
function comoAlguemDigita(digitos: string) {

  if (digitos.length === 11) {
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
  }

  if (digitos.length === 10) {
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`;
  }

  return digitos;
}

async function main() {

  console.log("\n  BUSCA DA TELA\n");

  const linhas = await prisma.case.findMany({
    include: {
      category: { select: { name: true } },
      subcategory: { select: { name: true } },
      owner: { select: { name: true } },
      team: { select: { name: true } },
      tags: { include: { tag: { select: { name: true } } } },
    },
  });

  const casos = linhas.map((r) => toCaseModel(r));

  console.log(`  base: ${casos.length} reclamações\n`);

  if (casos.length === 0) {
    console.error("  Base vazia — nada a conferir.\n");
    process.exit(1);
  }

  const buscar = (termo: string) =>
    casos.filter((c) => casaComTermo(c, termo));

  /* ---------- telefone ---------- */

  const comTelefone = casos.find(
    (c) => (c.phone ?? "").replace(/\D/g, "").length >= 10
  );

  if (!comTelefone) {
    console.error("  Nenhum caso com telefone — nada a conferir.\n");
    process.exit(1);
  }

  const digitos = comTelefone.phone!.replace(/\D/g, "");

  conferir(
    `telefone cru "${digitos}" acha o caso`,
    buscar(digitos).some(
      (c) => c.protocol === comTelefone.protocol
    ),
    true
  );

  const mascarado = comoAlguemDigita(digitos);

  conferir(
    `e com máscara "${mascarado}" também`,
    buscar(mascarado).some(
      (c) => c.protocol === comTelefone.protocol
    ),
    true
  );

  /**
   * O pedaço final é como as pessoas ditam o número.
   *
   * "termina em 4053" é o que se ouve no telefone, e é o que se digita
   * quando não se tem o número inteiro na tela.
   */
  conferir(
    `os últimos 8 dígitos "${digitos.slice(-8)}" bastam`,
    buscar(digitos.slice(-8)).some(
      (c) => c.protocol === comTelefone.protocol
    ),
    true
  );

  /* ---------- documento ---------- */

  const comDocumento = casos.find(
    (c) => (c.document ?? "").length >= 11
  );

  if (comDocumento) {
    conferir(
      "o CPF/CNPJ do cadastro acha o caso",
      buscar(comDocumento.document!).some(
        (c) => c.protocol === comDocumento.protocol
      ),
      true
    );
  }

  /* ---------- e-mail ---------- */

  const comEmail = casos.find((c) => c.email);

  if (comEmail) {
    conferir(
      "o e-mail acha o caso",
      buscar(comEmail.email!).some(
        (c) => c.protocol === comEmail.protocol
      ),
      true
    );
  }

  /* ---------- protocolo, nome, cidade ---------- */

  conferir(
    `o protocolo "${casos[0].protocol}" acha um só`,
    buscar(casos[0].protocol).length,
    1
  );

  conferir(
    "o nome do cliente acha o caso",
    buscar(casos[0].customer).some(
      (c) => c.protocol === casos[0].protocol
    ),
    true
  );

  const comCidade = casos.find((c) => c.city);

  if (comCidade) {
    conferir(
      `a cidade "${comCidade.city}" acha pelo menos um`,
      buscar(comCidade.city!).length >= 1,
      true
    );
  }

  /* ---------- o que NÃO pode acontecer ---------- */

  /**
   * Um número que não existe tem de devolver zero.
   *
   * Foi o que o painel disse ao Isaac em 23/08 — "não tem caso
   * registrado" — e estava certo. O erro daquele dia era outro: a tela
   * não procurava por telefone **nenhum**. Confirmar os dois lados é o
   * que separa "não achou porque não existe" de "não achou porque não
   * procura".
   */
  conferir(
    "número inexistente devolve zero",
    buscar("5199999999999").length,
    0
  );

  /**
   * Termo numérico curto não pode varrer a base.
   *
   * Sem piso, digitar "5" casaria com qualquer telefone que tivesse um
   * cinco — quase todos.
   */
  const curto = buscar("51");

  conferir(
    'termo numérico de 2 dígitos não vira busca por telefone',
    curto.every(
      (c) =>
        !(c.phone ?? "").replace(/\D/g, "").includes("51") ||
        [
          c.protocol,
          c.title,
          c.company,
          c.customer,
          c.category,
          c.owner,
          c.city,
          c.email,
        ]
          .filter(Boolean)
          .some((campo) =>
            String(campo).toLowerCase().includes("51")
          )
    ),
    true
  );

  conferir("busca vazia devolve tudo", buscar("").length, casos.length);
}

main()
  .catch((erro) => {
    falhas += 1;
    console.error("\n  ERRO:", erro);
  })
  .finally(async () => {
    await prisma.$disconnect();

    console.log(
      falhas === 0
        ? "\n  A busca acha por telefone, documento, e-mail e texto.\n"
        : `\n  ${falhas} falha(s).\n`
    );

    process.exit(falhas === 0 ? 0 : 1);
  });
