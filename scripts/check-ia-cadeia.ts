/**
 * A cadeia de IA gratuita passa de um provedor para o outro?
 *
 *   npm run check:ia-cadeia
 *
 * Fase 16: Gemini, Groq e OpenRouter, um de cada vez, até um responder.
 * As chaves do Groq e do OpenRouter ainda não existem, então este check
 * sobe um servidor local no lugar dos dois (GROQ_BASE_URL e
 * OPENROUTER_BASE_URL) e prova o caminho inteiro: a ordem, a passagem
 * quando um cai, a leitura do JSON que vem entre cercas, o campo
 * obrigatório que falta, a mensagem de modelo aposentado e o fluxo do
 * assistente. Não sai nada para a internet e não gasta cota.
 *
 * O que ele não prova: que o modelo padrão de cada um ainda existe. Isso
 * só a primeira chamada com a chave de verdade mostra (npm run check:ia).
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

/* Só a cadeia deste teste: nada de chave real nem de banco. */
for (const v of ["ANTHROPIC_API_KEY", "GEMINI_API_KEY", "DATABASE_URL", "DIRECT_URL", "IA_PROVEDOR"]) delete process.env[v];

let falhas = 0;
function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(62)} ${JSON.stringify(obtido)?.slice(0, 50)}`);
  if (!ok) console.log(`        ${"esperado".padEnd(62)} ${JSON.stringify(esperado)?.slice(0, 50)}`);
}

type Roteiro = (corpo: Record<string, unknown>, res: ServerResponse) => void;
const roteiro: Record<string, Roteiro> = {};
const recebidos: Record<string, Record<string, unknown>[]> = { groq: [], openrouter: [] };

function responderJson(res: ServerResponse, status: number, corpo: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(corpo));
}
const comConteudo = (texto: string) => ({ choices: [{ message: { content: texto } }], usage: { prompt_tokens: 12, completion_tokens: 7 } });

async function main() {

  const servidor = createServer((req: IncomingMessage, res: ServerResponse) => {
    let bruto = "";
    req.on("data", (c) => (bruto += c));
    req.on("end", () => {
      const quem = req.url?.startsWith("/groq") ? "groq" : "openrouter";
      const corpo = JSON.parse(bruto || "{}");
      recebidos[quem].push({ ...corpo, _auth: req.headers.authorization });
      roteiro[quem](corpo, res);
    });
  });
  await new Promise<void>((ok) => servidor.listen(0, "127.0.0.1", ok));
  const porta = (servidor.address() as AddressInfo).port;

  process.env.GROQ_API_KEY = "gsk-teste";
  process.env.OPENROUTER_API_KEY = "sk-or-teste";
  process.env.GROQ_BASE_URL = `http://127.0.0.1:${porta}/groq`;
  process.env.OPENROUTER_BASE_URL = `http://127.0.0.1:${porta}/openrouter`;

  const ia = await import("../lib/services/ia.service");
  const { lerJsonDaResposta } = await import("../lib/services/iaCompativel");

  const pedido = {
    sistema: "Resuma.",
    prompt: "Cliente: o pedido atrasou de novo.",
    esquema: { type: "object", properties: { resumo: { type: "string" }, humor: { type: "number" } }, required: ["resumo", "humor"] },
  };

  console.log("\n  CADEIA DE IA GRATUITA\n");

  conferir("sem Gemini, a cadeia é Groq e depois OpenRouter", ia.cadeiaDeProvedores(), ["groq", "openrouter"]);
  conferir("a preferência passa o escolhido para a frente", ia.cadeiaDeProvedores("openrouter"), ["openrouter", "groq"]);
  conferir("preferência sem chave não muda a ordem", ia.cadeiaDeProvedores("gemini"), ["groq", "openrouter"]);
  conferir("provedorDeIA responde se o escolhido está utilizável", [ia.provedorDeIA("groq"), ia.provedorDeIA("gemini")], ["groq", "groq"]);
  conferir("a reserva do Groq é o OpenRouter", ia.provedorReserva("groq"), "openrouter");
  process.env.GEMINI_API_KEY = "chave-de-teste";
  conferir("com a chave do Gemini, ele vem antes dos dois", ia.cadeiaDeProvedores(), ["gemini", "groq", "openrouter"]);
  delete process.env.GEMINI_API_KEY;

  /* 1. Groq responde: o formato chega certo e a resposta é lida. */
  roteiro.groq = (_c, res) => responderJson(res, 200, comConteudo('{"resumo":"Atraso recorrente.","humor":2}'));
  let r = await ia.pedirEstruturado(pedido);
  conferir("o Groq responde e os dados chegam", [r.provedor, r.dados], ["groq", { resumo: "Atraso recorrente.", humor: 2 }]);
  const ultimoGroq = recebidos.groq.at(-1)!;
  conferir("pede JSON e manda o esquema na instrução", [
    (ultimoGroq.response_format as { type: string }).type,
    JSON.stringify(ultimoGroq.messages).includes('\\"required\\":[\\"resumo\\",\\"humor\\"]'),
  ], ["json_object", true]);
  conferir("a chave vai no cabeçalho", ultimoGroq._auth, "Bearer gsk-teste");
  conferir("o uso de tokens volta", r.uso, { entrada: 12, saida: 7 });

  /* 2. Groq congestionado: o OpenRouter responde no lugar, com cerca de markdown. */
  roteiro.groq = (_c, res) => responderJson(res, 503, { error: "overloaded" });
  roteiro.openrouter = (_c, res) => responderJson(res, 200, comConteudo('```json\n{"resumo":"Pelo reserva.","humor":3}\n```'));
  r = await ia.pedirEstruturado(pedido);
  conferir("Groq em 503 → o OpenRouter responde", [r.provedor, r.dados?.resumo], ["openrouter", "Pelo reserva."]);

  /* 3. Resposta sem campo obrigatório conta como falha e passa adiante. */
  roteiro.groq = (_c, res) => responderJson(res, 200, comConteudo('{"resumo":"sem humor"}'));
  r = await ia.pedirEstruturado(pedido);
  conferir("faltou campo obrigatório → tenta o próximo", r.provedor, "openrouter");

  /* 4. Os dois caem: volta o erro do primeiro, em português. */
  roteiro.groq = (_c, res) => responderJson(res, 429, { error: "rate" });
  roteiro.openrouter = (_c, res) => responderJson(res, 404, { error: "no model" });
  r = await ia.pedirEstruturado(pedido);
  conferir("os dois caem → o erro é o do primeiro", [r.provedor, r.status, r.erro], ["groq", 503, "A cota gratuita do Groq acabou por agora. Tente de novo em alguns minutos."]);

  /* 5. Modelo aposentado diz qual variável trocar. */
  const soOpen = await (await import("../lib/services/iaCompativel")).pelaApiCompativel("openrouter", pedido, 5000);
  conferir("modelo aposentado aponta a variável", soOpen.erro?.includes("OPENROUTER_MODELO"), true);

  /* 6. Chave recusada. */
  roteiro.groq = (_c, res) => responderJson(res, 401, { error: "bad key" });
  const recusada = await (await import("../lib/services/iaCompativel")).pelaApiCompativel("groq", pedido, 5000);
  conferir("chave recusada aponta a variável", recusada.erro, "O Groq recusou a chave. Confira GROQ_API_KEY.");

  /* 7. O motor próprio continua sendo a última rede: sem nenhuma chave, a cadeia é vazia. */
  const guardadas = [process.env.GROQ_API_KEY, process.env.OPENROUTER_API_KEY];
  delete process.env.GROQ_API_KEY;
  process.env.OPENROUTER_API_KEY = "sk-or-...";
  conferir("marcador do .env.example não conta como chave", ia.cadeiaDeProvedores(), []);
  r = await ia.pedirEstruturado(pedido);
  conferir("sem chave nenhuma, erro claro (o chamador cai no motor próprio)", [r.status, r.erro?.startsWith("Nenhuma IA configurada")], [503, true]);
  [process.env.GROQ_API_KEY, process.env.OPENROUTER_API_KEY] = guardadas;

  /* 8. O assistente em fluxo pelo Groq. */
  roteiro.groq = (_c, res) => {
    res.writeHead(200, { "Content-Type": "text/event-stream" });
    res.write('data: {"choices":[{"delta":{"content":"Olá, "}}]}\n\n');
    res.write(": comentário de manutenção\n\n");
    res.write('data: {"choices":[{"delta":{"content":"tudo certo."}}]}\n\n');
    res.write('data: {"choices":[],"usage":{"prompt_tokens":30,"completion_tokens":4}}\n\n');
    res.end("data: [DONE]\n\n");
  };
  const pedacos: string[] = [];
  let fim: unknown = null;
  for await (const p of ia.conversar({ sistema: "Assistente.", turnos: [{ role: "user", content: "Oi" }] })) {
    if (p.tipo === "delta") pedacos.push(p.texto);
    if (p.tipo === "fim") fim = p.uso;
    if (p.tipo === "erro") pedacos.push(`ERRO ${p.mensagem}`);
  }
  conferir("o assistente responde em fluxo pelo Groq", pedacos.join(""), "Olá, tudo certo.");
  conferir("e o uso chega no fim", fim, { entrada: 30, saida: 4 });

  conferir("JSON entre texto solto também é lido", lerJsonDaResposta('Aqui está: {"a":1} pronto'), { a: 1 });
  conferir("texto sem JSON não vira objeto", lerJsonDaResposta("não sei"), null);

  servidor.closeAllConnections();
  await new Promise<void>((ok) => servidor.close(() => ok()));
  console.log(falhas === 0 ? "\n  A cadeia passa de um para o outro, e o erro que sobra diz o que fazer.\n" : `\n  ${falhas} ponto(s) a corrigir.\n`);
  /* process.exit com o pool do fetch fechando derruba o Node no Windows; sair sozinho, com o código. */
  process.exitCode = falhas === 0 ? 0 : 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
