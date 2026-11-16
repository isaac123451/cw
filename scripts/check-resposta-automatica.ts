/**
 * A resposta automática do WhatsApp do cliente não conta como ele falando?
 *
 *   npm run check:resposta-automatica
 *
 * 16/11/2026 — o "Humor do detrator depois" e o "respondeu" liam o robô de
 * atendimento do número do cliente como se fosse ele. Sem banco.
 */
import { readFileSync } from "node:fs";

import { ehFalaDoCliente, ehRespostaAutomatica } from "../lib/models/conversa";
import { leituraDaResposta } from "../lib/models/iaDoDia";

let falhas = 0;
function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(64)} ${JSON.stringify(obtido)}`);
  if (!ok) console.log(`        ${"esperado".padEnd(64)} ${JSON.stringify(esperado)}`);
}

console.log("\n  O QUE É ROBÔ (falas reais guardadas até 16/11)\n");
const robos = [
  "Fora do horário Olá! Recebemos sua mensagem e agradecemos o contato com o All Suites Mangabeiras & Manacás.",
  "Desculpe, não posso responder a isso. Estou aqui para ajudar com informações sobre o estabelecimento.",
  "Eu sou apenas um bot e, infelizmente, não sou capaz de entender frases muito longas.",
  "Serviços Automotivos Cláudio agradece seu Contato como podemos ajudar",
  "Olá, Tudo bem? Big Boys Hambúrgueria agradece seu contato!",
  "Olá Cardápio boa noite!!! tudo bem? seja bem vindo(a) a JJ STEAK BURGER",
  "Infelizmente não entendi a sua mensagem. Poderia perguntar de uma outra forma, por favor?",
];
conferir("as 7 respostas automáticas são reconhecidas", robos.filter(ehRespostaAutomatica).length, robos.length);
const gente = [
  "Bom, vamos lá... que é um comportamento padrão do sistema, eu já entendi. Vocês quiseram definir que o pedido realizado pelo QRCODE ou link, com escolha de pagamento via PIX AUTOMÁTICO",
  "Obrigado",
  "Muito prejuízo infelizmente",
  "Pode sim Por favor Vai ajudar demais",
  "E ninguém me reponde no WhatsApp",
  "Agradeço o contato, vou ver com a menina",
];
conferir("nenhuma fala de gente é tomada por robô", gente.filter(ehRespostaAutomatica), []);
conferir("fala do cliente: nem aviso nem robô", [ehFalaDoCliente({ de: "cliente", texto: "Obrigado" }), ehFalaDoCliente({ de: "cliente", texto: robos[0] }), ehFalaDoCliente({ de: "nos", texto: "Obrigado" })], [true, false, false]);

console.log("\n  O HUMOR NA LEITURA DA IA\n");
const base = { sobre_este_cliente: true, segmento: "nps", vale_anotar: true, resumo: "x", pendente: "nada", importantes: [], retorno: { precisa: false }, cancelamento: "nao", pedimos_avaliacao: false, solucao: "nao", causa: "" };
conferir("humor 4 passa", leituraDaResposta({ ...base, humor: 4 }, ["nps"], "2026-11-16").humor, 4);
conferir("0 vira nada", leituraDaResposta({ ...base, humor: 0 }, ["nps"], "2026-11-16").humor, null);
conferir("fora de 1 a 5 vira nada", leituraDaResposta({ ...base, humor: 9 }, ["nps"], "2026-11-16").humor, null);
conferir("conversa que mistura outro cliente: sem humor", leituraDaResposta({ ...base, sobre_este_cliente: false, humor: 2 }, ["nps"], "2026-11-16").humor, null);

console.log("\n  ONDE O FILTRO VALE\n");
const ia = readFileSync("lib/services/iaDoDia.service.ts", "utf8");
conferir("a IA do dia só conta fala de verdade", ia.includes("const dele = c.mensagens.filter((m) => ehFalaDoCliente(m));"), true);
conferir("e grava o humor só onde ninguém marcou", ia.includes("if (falou && leitura.humor && (nps.moodAfter ?? null) === null)"), true);
conferir("a tentativa só vira 'respondeu' com fala de verdade", readFileSync("lib/services/conversas.service.ts", "utf8").includes('ehFalaDoCliente({ de: "cliente", texto: f.texto })'), true);

console.log(falhas ? `\n  ${falhas} falha(s).\n` : "\n  Tudo certo.\n");
process.exit(falhas ? 1 : 0);
