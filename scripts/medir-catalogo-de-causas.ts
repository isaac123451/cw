/**
 * As famílias de causa sobre a base real — só leitura.
 *
 *   npx tsx scripts/medir-catalogo-de-causas.ts
 *
 * A mesma conta da tela Causas raiz (`propostaDoCatalogo`), no terminal:
 * quantos registros de cada frente caem em cada família, o que já está
 * no catálogo e o que sobra sem família.
 */
import "dotenv/config";

import { getPrisma } from "../lib/prisma";
import { propostaDoCatalogo, type TextoDaBase } from "../lib/models/catalogoDeCausas";

async function main() {
  const prisma = getPrisma();
  if (!prisma) throw new Error("Sem banco.");

  const [casos, nps, google, causas] = await Promise.all([
    prisma.case.findMany({ select: { protocol: true, title: true, description: true, channel: true } }),
    prisma.npsResponse.findMany({ where: { comment: { not: "" } }, select: { comment: true, score: true } }),
    prisma.avaliacaoGoogle.findMany({ where: { texto: { not: null } }, select: { texto: true } }),
    prisma.npsRootCause.findMany({ select: { name: true } }),
  ]);

  const registros: TextoDaBase[] = [
    ...casos.map((c) => ({ frente: "reclame-aqui" as const, texto: `${c.title}\n${c.description ?? ""}`, ref: c.protocol })),
    ...nps.map((n) => ({ frente: "nps" as const, texto: n.comment, ref: `NPS ${n.score}` })),
    ...google.map((g) => ({ frente: "google" as const, texto: g.texto ?? "", ref: "Google" })),
  ];

  const p = propostaDoCatalogo(registros, causas.map((c) => c.name));
  console.log(`\n  base ${p.base} (RA ${p.basePorFrente["reclame-aqui"]} · NPS ${p.basePorFrente.nps} · Google ${p.basePorFrente.google})\n`);
  for (const l of p.linhas) {
    const f = l as unknown as { familia: { nome: string; area: string }; total: number; porFrente: Record<string, number>; jaExiste?: string };
    console.log(`  ${String(f.total).padStart(4)}  ${f.familia.nome.padEnd(42)} ${f.familia.area.padEnd(18)} RA ${f.porFrente["reclame-aqui"]} · NPS ${f.porFrente.nps} · G ${f.porFrente.google}${f.jaExiste ? `  (já existe: ${f.jaExiste})` : ""}`);
  }
  console.log(`\n  sem família: ${p.semFamilia.total} · ${p.semFamilia.palavras.slice(0, 15).map((x) => `${x.palavra} ${x.registros}`).join(", ")}\n`);
  process.exit(0);
}

main();
