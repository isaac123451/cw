/**
 * Cancelamento e retenção — a leitura dos sinais e o desfecho por cliente.
 *
 *   npm run check:cancelamento
 *
 * Sem banco. Textos reais da base (resumidos) e casos montados à mão.
 */
import { clientesEmCancelamento, resumoDeRetencao, sinaisDoTexto, type CasoParaCancelamento } from "../lib/models/cancelamento";

let falhas = 0;
function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(62)} ${String(JSON.stringify(obtido)).slice(0, 36)}`);
  if (!ok) console.log(`        ${"esperado".padEnd(62)} ${String(JSON.stringify(esperado)).slice(0, 36)}`);
}
const tipos = (t: string) => sinaisDoTexto(t).map((s) => s.tipo).sort();

console.log("\n  CANCELAMENTO E RETENÇÃO\n");

conferir("\"Quero cancelar meu plano\" é pedido", tipos("Quero cancelar meu plano de cardápio web"), ["pedido"]);
conferir("\"Solicito o cancelamento do contrato\" é pedido", tipos("solicito o cancelamento do contrato"), ["pedido"]);
conferir("\"Estou analisando trocar de plataforma\" é pedido (risco)", tipos("Estou analisando trocar de plataforma"), ["pedido"]);
conferir("o pedido do consumidor cancelado não é", tipos("O restaurante cancelou meu pedido e não devolveu"), []);
conferir("\"cancelar o pedido\" também não", tipos("quero cancelar o pedido de ontem"), []);
conferir("\"desisti de cancelar\" é pedido e retenção", tipos("Conversei com a equipe e desisti de cancelar"), ["pedido", "retido"]);
conferir("\"vou continuar com vocês\" é retido", tipos("vou continuar com vocês"), ["retido"]);
conferir("\"vou ficar no prejuízo\" não é retido", tipos("E EU VOU FICAR NO PREJUÍZO"), []);
conferir("\"cobrança após solicitação de cancelamento\": pediu e saiu", tipos("Cobrança indevida após solicitação de cancelamento do serviço"), ["cancelado", "pedido"]);
conferir("\"se eu tivesse cancelado o plano\" não é cancelado", tipos("Se eu tivesse cancelado o plano e voltado"), []);
conferir("\"cancelamento foi efetuado\" é cancelado", tipos("Me informaram que o cancelamento foi efetuado"), ["cancelado"]);

const base = (x: Partial<CasoParaCancelamento>): CasoParaCancelamento => ({ protocolo: "RA-1", frente: "reclame-aqui", cliente: "Ana", titulo: "t", criadoEm: "2026-08-01T12:00:00Z", ...x });
const clientes = clientesEmCancelamento({
  casos: [
    base({ protocolo: "RA-1", titulo: "Quero cancelar o plano", avaliado: true, voltaria: true, avaliadoEm: "2026-08-10T12:00:00Z", contaId: "c1", contaNome: "Pizzaria Um" }),
    base({ protocolo: "RA-2", titulo: "Quero cancelar o contrato", avaliado: true, voltaria: false, resolvido: true, contaId: "c2" }),
    base({ protocolo: "RA-3", titulo: "Solicito o cancelamento do sistema", documento: "12.345.678/0001-90" }),
    base({ protocolo: "RA-4", titulo: "Pedido não chegou", contaId: "c4" }),
  ],
  nps: [],
  mensagens: [{ conversaId: "v1", texto: "pensamos bem e desistimos de cancelar", quando: "2026-08-20T12:00:00Z", caseProtocolo: "RA-3" }],
});
const porConta = Object.fromEntries(clientes.map((c) => [c.chave, c.desfecho]));
conferir("avaliou voltaria: retido", porConta["conta:c1"], "retido");
conferir("avaliou não voltaria: cancelado", porConta["conta:c2"], "cancelado");
conferir("a conversa do WhatsApp junta-se ao caso e decide: retido", porConta["doc:12345678000190"], "retido");
conferir("caso sem cancelamento fica fora", "conta:c4" in porConta, false);
const r = resumoDeRetencao(clientes);
conferir("resumo: 3 clientes, 2 retidos, 1 cancelado, 67%", [r.clientes, r.retidos, r.cancelados, Math.round((r.taxaDeRetencao ?? 0) * 100)], [3, 2, 1, 67]);

const manual = clientesEmCancelamento({
  casos: [base({ protocolo: "RA-9", titulo: "Quero cancelar o plano", contaId: "c9" })],
  nps: [],
  mensagens: [],
  manuais: new Map([["conta:c9", { desfecho: "nao-e-cancelamento" as const }]]),
});
conferir("\"não é cancelamento\" à mão tira da conta", manual.length, 0);

console.log(`\n  ${falhas === 0 ? "Tudo certo." : `${falhas} falha(s).`}\n`);
process.exit(falhas === 0 ? 0 : 1);
