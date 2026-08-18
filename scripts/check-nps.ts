/**
 * Confere o NPS importado contra o Wootric.
 *
 *   npm run check:nps            # últimos 30 dias
 *   npm run check:nps -- --dias=90
 *
 * A pergunta que isto responde: **a importação mexeu no indicador?**
 * Calcula o NPS dos dois lados na mesma janela — do banco daqui e da
 * API de lá — e mostra os dois. Se divergirem, alguma resposta ficou
 * de fora, entrou duplicada, ou caiu na janela errada por causa de
 * fuso, que é o erro mais fácil de cometer e o mais difícil de ver.
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import {
  exigeTratativa,
  listarRespostas,
  temWootric,
  traduzir,
} from "../lib/services/wootric.service";

import { MOODS, segmentOf } from "../lib/models/nps";

const args = process.argv.slice(2);

const diasArg = args.find((a) =>
  a.startsWith("--dias=")
);

const dias = diasArg
  ? Math.max(Number(diasArg.split("=")[1]) || 30, 1)
  : 30;

const url =
  process.env.DIRECT_URL || process.env.DATABASE_URL;

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: url as string }),
});

/** Fórmula oficial: % promotores − % detratores. */
function nps(notas: number[]) {

  if (notas.length === 0) return 0;

  const prom = notas.filter((n) => n >= 9).length;
  const det = notas.filter((n) => n <= 6).length;

  return Math.round(
    ((prom - det) / notas.length) * 100
  );
}

function linha(rotulo: string, notas: number[]) {

  const media =
    notas.length === 0
      ? 0
      : notas.reduce((s, n) => s + n, 0) / notas.length;

  console.log(
    `  ${rotulo.padEnd(12)} ${String(notas.length).padStart(5)} resposta(s)   NPS ${String(nps(notas)).padStart(4)}   média ${media.toFixed(2)}`
  );
}

async function main() {

  const desde = new Date(Date.now() - dias * 86400000);

  console.log("");
  console.log(
    `  Janela: últimos ${dias} dia(s) — desde ${desde.toISOString().slice(0, 10)}`
  );
  console.log("");

  /* ---- daqui ---- */

  const nossas = await prisma.npsResponse.findMany({
    where: {
      source: "Wootric",
      respondedAt: { gte: desde },
    },
    select: {
      score: true,
      externalId: true,
      status: true,
      comment: true,
      moodAfter: true,
      resolvedAfter: true,
    },
  });

  linha(
    "CW Reputação",
    nossas.map((r) => r.score)
  );

  /* ---- de lá ---- */

  if (!temWootric()) {
    console.log(
      "\n  Wootric não configurado — sem com o que comparar.\n"
    );
    return;
  }

  const brutas = await listarRespostas(desde);

  const deLa = brutas
    .map(traduzir)
    .filter((r) => r !== null);

  linha(
    "Wootric",
    deLa.map((r) => r.score)
  );

  /* ---- diferença ---- */

  const nossosIds = new Set(
    nossas.map((r) => r.externalId)
  );

  const faltando = deLa.filter(
    (r) => !nossosIds.has(r.externalId)
  );

  const sobrando = nossas.filter(
    (r) =>
      !deLa.some(
        (d) => d.externalId === r.externalId
      )
  );

  console.log("");

  if (faltando.length === 0 && sobrando.length === 0) {
    console.log(
      "  Conferem resposta a resposta: nenhuma faltando, nenhuma sobrando."
    );
  } else {
    console.log(
      `  ATENÇÃO — faltando aqui: ${faltando.length} · aqui e não lá: ${sobrando.length}`
    );

    for (const r of faltando.slice(0, 5)) {
      console.log(
        `    faltando: ${r.externalId} nota ${r.score} em ${r.respondedAt.toISOString().slice(0, 10)}`
      );
    }
  }

  /* ---- fila ---- */

  const precisam = nossas.filter((r) =>
    exigeTratativa(r.score, r.comment)
  );

  const abertos = nossas.filter(
    (r) => !r.status.startsWith("[Encerrado]")
  );

  console.log("");
  console.log("  FILA DE TRATATIVA");
  console.log(
    `    exigem tratativa pela régra: ${precisam.length}`
  );
  console.log(
    `    em aberto na tela:           ${abertos.length}`
  );
  console.log(
    `    promotor calado (fora da fila): ${nossas.length - precisam.length}`
  );

  const porSegmento = new Map<string, number>();

  for (const r of nossas) {
    const s = segmentOf(r.score).label;
    porSegmento.set(s, (porSegmento.get(s) ?? 0) + 1);
  }

  console.log("");
  console.log(
    `    ${[...porSegmento.entries()].map(([k, v]) => `${k}: ${v}`).join(" · ")}`
  );

  /* ---- pós-contato ---- */

  const comHumor = nossas.filter(
    (r) => typeof r.moodAfter === "number"
  );

  console.log("");
  console.log("  PÓS-CONTATO");
  console.log(
    `    com humor registrado: ${comHumor.length}`
  );

  if (comHumor.length > 0) {
    for (const m of MOODS) {
      const q = comHumor.filter(
        (r) => r.moodAfter === m.value
      ).length;
      if (q > 0) {
        console.log(
          `      ${m.emoji} ${m.label.padEnd(13)} ${q}`
        );
      }
    }
  }

  console.log(
    `    resolvidos: ${nossas.filter((r) => r.resolvedAfter === true).length} · não resolvidos: ${nossas.filter((r) => r.resolvedAfter === false).length}`
  );

  console.log("");
}

main()
  .catch((erro) => {
    console.error("\n  FALHOU:", erro.message, "\n");
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
