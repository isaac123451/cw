/**
 * As tags que a IA põe e tira (21/10/2026) — simula; com `--aplicar`, grava.
 *
 *   npx tsx scripts/tags-automaticas.ts [--aplicar]
 */
import "dotenv/config";

import { getPrisma } from "../lib/prisma";
import { sincronizarTagsAutomaticas } from "../lib/services/tagsAutomaticas.service";

(async () => {
  const prisma = getPrisma();
  if (!prisma) throw new Error("Sem banco.");
  const aplicar = process.argv.includes("--aplicar");
  const { mudancas, aplicadas } = await sincronizarTagsAutomaticas(prisma, { aplicar });
  const resumo: Record<string, number> = {};
  for (const m of mudancas) resumo[`${m.acao} ${m.tag}`] = (resumo[`${m.acao} ${m.tag}`] ?? 0) + 1;
  console.log(resumo);
  for (const m of mudancas.filter((m) => m.acao === "por").slice(0, 30)) console.log(`  + ${m.protocolo} ${m.tag} — ${m.motivo}`);
  console.log(aplicar ? `\n  ${aplicadas} aplicadas.` : "\n  Simulação — nada gravado. Use --aplicar.");
  process.exit(0);
})();
