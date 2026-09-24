/**
 * O que fazer agora na conversa (Fase 28).
 *
 *   npm run check:momento
 *
 * Sem banco e sem IA: cada situação leva à abordagem certa — escalar,
 * escutar, assumir, esperar a área, Meet, áudio, responder —, com o
 * porquê, e o fora do expediente é marcado.
 */
import { foraDoExpediente, instanteDoCarimbo, oQueFazerAgora, rajadaDoCliente, type MensagemDoMomento } from "../lib/models/oQueFazerAgora";
import { instanteDe } from "../lib/services/horasUteis";

let falhas = 0;
function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(70)} ${JSON.stringify(obtido)?.slice(0, 60)}`);
  if (!ok) console.log(`        ${"esperado".padEnd(70)} ${JSON.stringify(esperado)?.slice(0, 60)}`);
}

const c = (texto: string): MensagemDoMomento => ({ de: "cliente", texto });
const n = (texto: string): MensagemDoMomento => ({ de: "nos", texto });
const quarta10h = instanteDe("2026-09-23", 10 * 60);
const acao = (mensagens: MensagemDoMomento[], humor: 1 | 2 | 3 | 4 | 5, historico = {}) => oQueFazerAgora({ mensagens, humor, agora: quarta10h, historico })?.acao;

console.log("\n  Cada situação, a sua abordagem\n");
conferir("fala em Procon: escalar", acao([n("Oi"), c("Vou no Procon amanhã se não resolverem")], 2), "escalar");
conferir("irritado e reincidente: escalar", acao([c("de novo isso"), c("ridículo")], 1, { reclamacoes: 3 }), "escalar");
conferir("irritado sem histórico não escala", acao([n("Oi, tudo bem?"), c("ridículo isso")], 1) !== "escalar", true);
conferir("5 mensagens seguidas e irritado: só escutar", acao([n("Olá"), c("não funciona"), c("perdi vendas"), c("absurdo"), c("ninguém resolve"), c("péssimo")], 2), "escutar");
conferir("3 seguidas e de bom humor: não é desabafo", acao([n("Olá"), c("oi"), c("tudo bem"), c("obrigado pela ajuda")], 4), "responder");
conferir("aponta erro nosso: assumir", acao([n("Olá"), c("Vocês cobraram errado a minha mensalidade")], 3), "assumir");
conferir("área com o caso e pergunta do andamento: esperar a área", acao([n("Encaminhei ao financeiro"), c("E aí, alguma novidade?")], 3, { areaAcionada: "Financeiro", areaVenceEm: "25/09 10:00" }), "esperar-area");
conferir("pergunta do andamento sem área acionada: responder", acao([n("Olá"), c("E aí, alguma novidade?")], 3), "responder");
const longa = Array.from({ length: 16 }, (_, i) => (i % 2 ? n("Vá em configurações e depois em impressoras") : c("não entendi onde fica")));
conferir("16 mensagens e não entendeu: Meet", acao(longa, 3), "meet");
conferir("não entendeu, conversa curta: áudio", acao([n("Faça assim..."), c("Não entendi, onde fica isso?")], 3), "audio");
conferir("nossos textos longos: áudio", acao([n("x".repeat(600)), c("ok"), n("y".repeat(600)), c("hm")], 3), "audio");
conferir("de bom humor e sem sinal: responder", acao([n("Pronto, resolvido"), c("Obrigado, deu certo!")], 5), "responder");
conferir("sem mensagem do cliente: nada", oQueFazerAgora({ mensagens: [n("Oi")], humor: 3, agora: quarta10h }), null);

console.log("\n  O porquê, o roteiro e a hora\n");
const m = oQueFazerAgora({ mensagens: [n("Encaminhei"), c("tem previsão?")], humor: 3, agora: quarta10h, historico: { areaAcionada: "Financeiro", areaVenceEm: "25/09 10:00" } })!;
conferir("porquê cita a área e a pergunta", m.porque, ["o caso está com Financeiro", "o cliente pergunta do andamento"]);
conferir("roteiro traz a data do retorno", m.roteiro[1], "Dê a data do retorno: 25/09 10:00.");
conferir("rajada: conta só as do fim", rajadaDoCliente([c("a"), n("b"), c("c"), c("d")]), 2);
conferir("carimbo do WhatsApp vira instante de Brasília", instanteDoCarimbo("10:32, 14/09/2026")?.toISOString(), "2026-09-14T13:32:00.000Z");
conferir("carimbo inválido", instanteDoCarimbo("ontem"), null);
conferir("quarta 10h: no expediente", foraDoExpediente(quarta10h), false);
conferir("quarta 19h: fora", foraDoExpediente(instanteDe("2026-09-23", 19 * 60)), true);
conferir("sábado 10h: fora", foraDoExpediente(instanteDe("2026-09-26", 10 * 60)), true);
conferir("fora do horário vem marcado", oQueFazerAgora({ mensagens: [c("oi")], humor: 3, agora: instanteDe("2026-09-23", 21 * 60) })?.foraDoHorario, true);

console.log(falhas ? `\n  ${falhas} falha(s).\n` : "\n  Tudo certo.\n");
process.exit(falhas ? 1 : 0);
