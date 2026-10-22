/**
 * Quem pode caber em moderação (22/10/2026) — sem banco.
 *
 *   npm run check:candidatas-moderacao
 */
import type { Case } from "../lib/models/case";
import { candidataAModeracao } from "../lib/models/candidatasAModeracao";

let falhas = 0;
function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(64)} ${JSON.stringify(obtido)?.slice(0, 50)}`);
  if (!ok) console.log(`        ${"esperado".padEnd(64)} ${JSON.stringify(esperado)?.slice(0, 50)}`);
}

const hoje = "2026-10-22";
const base = { source: "Reclame Aqui", evaluated: false, resolved: false, wouldDoBusiness: false, status: "Novo", email: "", document: "" } as unknown as Case;
const caso = (p: Partial<Case>) => ({ ...base, id: p.protocol, ...p }) as Case;

const consumidor = caso({ protocol: "RA-1", createdAt: "2026-10-20", title: "Meu pedido não chegou", description: "Pedi uma pizza e o restaurante cancelou sem me avisar." });
conferir("consumidor final reclamando do restaurante: cabe", candidataAModeracao(consumidor, [consumidor], hoje)?.por, "consumidor-final");
conferir("lojista falando de pedidos que não imprimem: não cabe", candidataAModeracao(caso({ protocol: "RA-2", createdAt: "2026-10-20", title: "Os pedidos de pizza não imprimem", description: "A impressão automática parou." }), [], hoje), null);
conferir("já avaliada como positiva: não cabe (tiraria nota boa)", candidataAModeracao({ ...consumidor, evaluated: true, score: 10, resolved: true }, [], hoje), null);
conferir("avaliada como negativa: cabe", candidataAModeracao({ ...consumidor, evaluated: true, score: 2 }, [], hoje)?.por, "consumidor-final");
conferir("moderação já pedida: não aparece de novo", candidataAModeracao({ ...consumidor, moderacaoPedidaEm: "2026-10-21" }, [], hoje), null);
conferir("fora da janela de 12 meses: não cabe", candidataAModeracao({ ...consumidor, createdAt: "2025-09-01" }, [], hoje), null);

const a = caso({ protocol: "RA-A", createdAt: "2026-10-01", document: "12.345.678/0001-90", title: "Repasse não caiu", description: "O repasse do pagamento online não caiu na minha conta." });
const b = caso({ protocol: "RA-B", createdAt: "2026-10-10", document: "12345678000190", title: "Dinheiro retido", description: "Meu saldo está retido, o repasse não chegou de novo." });
const c = caso({ protocol: "RA-C", createdAt: "2026-10-12", document: "12345678000190", title: "Impressora", description: "A impressão automática dos pedidos parou de funcionar." });
conferir("mesmo cliente, mesmo tema em 30 dias: duplicada, aponta a outra", [candidataAModeracao(b, [a, b, c], hoje)?.por, candidataAModeracao(b, [a, b, c], hoje)?.outra], ["duplicada", "RA-A"]);
conferir("mesmo cliente, tema diferente: não é duplicada", candidataAModeracao(c, [a, b, c], hoje), null);
conferir("a primeira não é duplicada da que veio depois", candidataAModeracao(a, [a, b, c], hoje), null);
conferir("mesmo tema mas outro cliente: não é duplicada", candidataAModeracao({ ...b, document: "99999999000199" }, [a, b, c], hoje), null);

console.log(falhas ? `\n  ${falhas} ponto(s) a corrigir.\n` : "\n  Só sugere moderação com fato, e nunca onde ela tiraria nota boa.\n");
if (falhas) process.exitCode = 1;
