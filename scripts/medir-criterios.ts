/**
 * Os critérios de criticidade contra os relatos reais.
 *
 *   npx tsx scripts/medir-criterios.ts
 *
 * Só leitura. Para cada critério com regra de texto: quantos relatos do
 * Reclame Aqui ele acende, a prioridade com que esses casos estão hoje e
 * dois trechos de exemplo — para ver se a regra pega o que diz pegar.
 * No fim, quantos relatos ficam sem critério nenhum.
 */
import "dotenv/config";

import { getPrisma } from "../lib/prisma";
import { CRITERIOS, prioridadePelosCriterios } from "../lib/models/case";
import { CRITERIOS_NO_TEXTO, criteriosPeloTexto, trechoDoPadrao } from "../lib/models/sugestaoPorTexto";

async function main() {
  const prisma = getPrisma();
  if (!prisma) throw new Error("Sem banco.");

  const casos = await prisma.case.findMany({
    where: { channel: "RECLAME_AQUI" },
    select: { protocol: true, title: true, description: true, priority: true, subcategory: { select: { name: true } } },
  });

  console.log(`\n  ${casos.length} relatos do Reclame Aqui\n`);

  for (const regra of CRITERIOS_NO_TEXTO) {
    const criterio = CRITERIOS.find((c) => c.id === regra.criterio);
    const acesos = casos.filter((c) => regra.padrao.test(normalizar(`${c.title} ${c.description}`)));
    const porPrioridade = contar(acesos.map((c) => c.priority));
    console.log(`  ${(criterio?.prioridade ?? "?").padEnd(8)} ${regra.criterio.padEnd(22)} ${String(acesos.length).padStart(4)}   hoje: ${porPrioridade}`);
    for (const c of acesos.slice(0, 2)) {
      const trecho = trechoDoPadrao(`${c.title} ${c.description}`, regra.padrao, 40);
      console.log(`           ${c.protocol} · ${c.subcategory?.name ?? "—"} · "${(trecho ?? "").replace(/\s+/g, " ").slice(0, 110)}"`);
    }
  }

  const niveis = casos.map((c) => {
    const ids = criteriosPeloTexto(`${c.title} ${c.description}`).map((s) => s.criterio);
    return { ids, nivel: ids.length === 0 ? "sem critério" : prioridadePelosCriterios(ids), atual: c.priority };
  });
  console.log(`\n  nível pelo texto: ${contar(niveis.map((n) => n.nivel))}`);
  console.log(`  sem critério nenhum (nem de Normal): ${niveis.filter((n) => n.ids.length === 0).length}`);
}

function normalizar(t: string) {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function contar(lista: string[]) {
  const m = new Map<string, number>();
  for (const x of lista) m.set(x, (m.get(x) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(" · ");
}

main().then(() => process.exit(0));
