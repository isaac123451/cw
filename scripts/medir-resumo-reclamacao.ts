/**
 * O resumo da área da empresa contra os relatos reais.
 *
 *   npx tsx scripts/medir-resumo-reclamacao.ts
 *
 * Só leitura. Quantos relatos têm o pedido achado, como o tom se
 * distribui, e três exemplos para conferir a leitura.
 */
import "dotenv/config";

import { getPrisma } from "../lib/prisma";
import { resumoDaReclamacao } from "../lib/models/resumoDaReclamacao";

async function main() {
  const prisma = getPrisma();
  if (!prisma) throw new Error("Sem banco.");
  const casos = await prisma.case.findMany({ where: { channel: "RECLAME_AQUI" }, select: { protocol: true, title: true, description: true } });
  const resumos = casos.map((c) => ({ c, r: resumoDaReclamacao(c.title, c.description ?? "") }));
  const comPedido = resumos.filter((x) => x.r.quer).length;
  const tons = resumos.reduce<Record<string, number>>((m, x) => ((m[x.r.tom] = (m[x.r.tom] ?? 0) + 1), m), {});
  const comSinal = resumos.filter((x) => x.r.sinais.length > 0).length;
  console.log({ relatos: casos.length, comPedido, comSinal, tons, mediaDePalavras: Math.round(resumos.reduce((s, x) => s + x.r.palavras, 0) / casos.length) });
  for (const { c, r } of resumos.filter((x) => x.r.quer).slice(0, 3)) {
    console.log(`\n${c.protocol} · ${r.tom} · ${r.nivel}\n  aconteceu: ${r.aconteceu}\n  quer: ${r.quer}\n  sinais: ${r.sinais.map((s) => `${s.nivel}: ${s.texto}`).join(" | ")}`);
  }
}

main().then(() => process.exit(0));
