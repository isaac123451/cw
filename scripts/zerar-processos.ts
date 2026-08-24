/**
 * Esvazia Processos e SLA, para a operação começar do zero.
 *
 *   npm run zerar:processos            (simula, não apaga)
 *   npm run zerar:processos -- --gravar
 *
 * As regras que estavam lá eram **semente**, não decisão de ninguém:
 * seis SLAs e cinco prazos de movimentação criados pelo `db:seed` para
 * a tela não nascer vazia. O Isaac pediu para zerar, e o motivo é bom —
 * regra de prazo que ninguém escolheu é pior do que nenhuma: ela pinta
 * casos de vermelho por um combinado que nunca existiu, e a equipe
 * aprende a ignorar o vermelho.
 *
 * **Apagar sozinho não bastava.** O `db:seed` replantava as duas:
 * `movementRule` por `upsert` em toda execução, e `slaRule` sempre que
 * a tabela estivesse vazia — que é exatamente o estado em que este
 * script a deixa. Por isso o seed foi ajustado junto; sem isso, o
 * próximo `npm run db:seed` desfaria tudo em silêncio.
 *
 * O que **não** é apagado: `CaseMovement`. Aquilo é movimentação
 * registrada de reclamação real — histórico de caso, não regra.
 */
import "dotenv/config";

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

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

const gravar = process.argv.includes("--gravar");

async function main() {

  console.log(
    `\n  ZERAR PROCESSOS E SLA ${gravar ? "" : "— simulação, nada será apagado"}\n`
  );

  const [slas, movimentos, movimentacoes] =
    await Promise.all([
      prisma.slaRule.findMany(),
      prisma.movementRule.findMany(),
      prisma.caseMovement.count(),
    ]);

  console.log(
    `  ${slas.length} regra(s) de SLA · ${movimentos.length} prazo(s) de movimentação`
  );

  console.log(
    `  ${movimentacoes} movimentação(ões) de caso — preservadas, é histórico de reclamação\n`
  );

  if (slas.length === 0 && movimentos.length === 0) {
    console.log("  Já está vazio. Nada a fazer.\n");
    return;
  }

  for (const r of slas) {
    console.log(
      `    SLA  ${r.category}${r.priority ? ` / ${r.priority}` : ""}  →  resposta ${r.responseHours}h, solução ${r.solutionHours}h${r.team ? ` (${r.team})` : ""}`
    );
  }

  for (const r of movimentos) {
    console.log(
      `    MOV  ${r.destination}  →  ${r.hours}h`
    );
  }

  if (!gravar) {
    console.log(
      "\n  Simulação. Rode com --gravar para apagar de verdade.\n"
    );
    return;
  }

  /**
   * A cópia sai **antes** de qualquer apagamento.
   *
   * São poucas linhas e todas de semente, mas apagar não desfaz — e o
   * custo de escrever um JSON é zero perto do de reconstruir à mão uma
   * regra que alguém tinha ajustado sem contar para ninguém.
   */
  const destino = resolve(
    __dirname,
    `../backup-processos-${new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/[:T]/g, "-")}.json`
  );

  writeFileSync(
    destino,
    JSON.stringify(
      { slaRules: slas, movementRules: movimentos },
      null,
      2
    )
  );

  console.log(`\n  cópia em ${destino}`);

  const apagadosSla = await prisma.slaRule.deleteMany({});

  const apagadosMov =
    await prisma.movementRule.deleteMany({});

  console.log(
    `\n  ${apagadosSla.count} regra(s) de SLA e ${apagadosMov.count} prazo(s) de movimentação apagados.`
  );

  const sobrou =
    (await prisma.slaRule.count()) +
    (await prisma.movementRule.count());

  console.log(
    sobrou === 0
      ? "  Processos e SLA agora estão vazios.\n"
      : `  ATENÇÃO: sobraram ${sobrou} linha(s).\n`
  );
}

main()
  .catch((erro) => {
    console.error("\n  Erro:", erro);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
