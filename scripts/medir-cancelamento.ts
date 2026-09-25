/**
 * Cancelamento e retenção sobre a base real — só leitura.
 *
 *   npx tsx scripts/medir-cancelamento.ts [--todos]
 *
 * A mesma conta da tela: quantos clientes pediram, quantos ficaram e
 * quantos saíram, por mês, e alguns exemplos com o trecho que decidiu.
 */
import "dotenv/config";

import { getPrisma } from "../lib/prisma";
import { resumoDeRetencao } from "../lib/models/cancelamento";
import { lerClientesEmCancelamento } from "../lib/services/cancelamento.service";

async function main() {
  const prisma = getPrisma();
  if (!prisma) throw new Error("Sem banco.");
  const t0 = Date.now();
  const clientes = await lerClientesEmCancelamento(prisma);
  const r = resumoDeRetencao(clientes);
  console.log(`\n  ${r.clientes} clientes em cancelamento (${Date.now() - t0} ms) · ${r.retidos} retidos · ${r.cancelados} cancelados · ${r.emAberto} em aberto · retenção ${r.taxaDeRetencao === null ? "—" : `${Math.round(r.taxaDeRetencao * 100)}%`}\n`);
  for (const m of r.porMes.slice(0, 8)) console.log(`  ${m.mes}  ${String(m.clientes).padStart(3)} pediram · ${m.retidos} retidos · ${m.cancelados} cancelados · ${m.emAberto} em aberto`);
  const todos = process.argv.includes("--todos");
  for (const desfecho of ["retido", "cancelado", "em-aberto"] as const) {
    const lista = clientes.filter((c) => c.desfecho === desfecho);
    console.log(`\n  ${desfecho.toUpperCase()} (${lista.length})`);
    for (const c of lista.slice(0, todos ? 999 : 6)) {
      const pedido = c.sinais.find((s) => s.tipo === "pedido");
      console.log(`  - ${c.nome.slice(0, 30).padEnd(30)} ${c.protocolos.slice(0, 2).join(",").padEnd(24)} pedido: ${(pedido?.trecho ?? "—").slice(0, 70)}`);
      if (desfecho !== "em-aberto") console.log(`    ${"".padEnd(55)} porque: ${c.porque.slice(0, 70)}`);
    }
  }
  console.log("");
  process.exit(0);
}

main();
