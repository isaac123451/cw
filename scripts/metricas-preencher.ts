/**
 * Preenche o histórico diário de métricas.
 *
 *   npm run metricas:preencher                      (simula os últimos 60 dias)
 *   npm run metricas:preencher -- --de 2026-08-01 --ate 2026-08-31
 *   npm run metricas:preencher -- ... --gravar
 *
 * **O que ele reconstrói, e como.** Cada dia é medido com o que era
 * verdade naquele dia: quais reclamações já existiam, quais já tinham
 * resposta pública (pela data da resposta), quais já tinham sido
 * avaliadas. Não é o estado de hoje reaproveitado para trás — isso
 * produziria um histórico em que todo dia parece tão bom quanto o mais
 * recente, que é justamente o erro que gravar por dia evita.
 *
 * **O que ele não reconstrói.** Visualizações do RA, ciclos com selo
 * ativo e reclamações desativadas pela moderação só existem no portal.
 * Ficam nulos, e nulo quer dizer "ninguém preencheu" — nunca zero.
 *
 * **Regravar é seguro.** Os campos automáticos são recalculados; os
 * manuais ficam intocados. Quem digitou as visualizações não perde o
 * número porque a rotina rodou de novo.
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { fetchCases } from "../lib/services/case.repository";

import {
  diasEntre,
  gravarDia,
  medirDia,
} from "../lib/services/metricas.service";

import { hojeNaOperacao } from "../lib/services/reputation.service";

const url =
  process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!url) {
  console.error("\n  DATABASE_URL não definido.\n");
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: url }),
});

const args = process.argv.slice(2);

function opcao(nome: string) {
  const i = args.indexOf(nome);
  return i >= 0 ? args[i + 1] : undefined;
}

const gravar = args.includes("--gravar");

async function main() {

  const ate = opcao("--ate") ?? hojeNaOperacao();

  const de =
    opcao("--de") ??
    (() => {
      const d = new Date(`${ate}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() - 59);
      return d.toISOString().slice(0, 10);
    })();

  console.log(
    `\n  MÉTRICAS DIÁRIAS — de ${de} a ${ate}\n`
  );

  const cases = await fetchCases(prisma);

  const impactos = await prisma.impactRecord.findMany({
    select: { date: true, wouldHaveChurned: true },
  });

  console.log(
    `  base: ${cases.length} reclamação(ões) · ${impactos.length} registro(s) de impacto\n`
  );

  const dias = diasEntre(de, ate);

  console.log(
    "  dia          entram  resp.  s/resp   nota   consum.  volta%  resolv%  h méd  churn"
  );
  console.log(
    "  " + "─".repeat(84)
  );

  let gravados = 0;

  for (const d of dias) {

    const m = medirDia(cases, impactos, d);

    /* Só imprime linha por linha quando o intervalo cabe na tela. */
    if (dias.length <= 40) {
      console.log(
        [
          `  ${d}`,
          String(m.entrantes).padStart(7),
          String(m.respondidas).padStart(6),
          String(m.naoRespondidas).padStart(7),
          m.notaReputacao.toFixed(1).padStart(7),
          m.notaConsumidor.toFixed(2).padStart(8),
          `${m.voltariam.toFixed(1)}%`.padStart(8),
          `${m.resolvidasPct.toFixed(1)}%`.padStart(8),
          m.tempoMedioHoras.toFixed(1).padStart(7),
          String(m.churn).padStart(6),
        ].join("")
      );
    }

    if (gravar) {
      await gravarDia(prisma, m);
      gravados += 1;
    }
  }

  if (dias.length > 40) {
    console.log(
      `  (${dias.length} dias — rode com um intervalo menor para ver linha a linha)`
    );
  }

  console.log(
    gravar
      ? `\n  ${gravados} dia(s) gravados. Os campos do portal — visualizações, selo, desativadas — continuam como estavam.\n`
      : "\n  SIMULAÇÃO — nada foi gravado. Repita com --gravar.\n"
  );

  await prisma.$disconnect();
}

main().catch(async (erro) => {
  console.error("\n  Erro:", erro);
  await prisma.$disconnect();
  process.exit(1);
});
