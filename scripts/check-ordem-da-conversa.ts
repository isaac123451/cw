/**
 * A conversa guardada fica na ordem em que aconteceu?
 *
 *   npm run check:ordem-da-conversa
 *
 * 10/11/2026 — "as conversas do whatsapp na plataforma estão ficando de
 * cabeça pra baixo ou sem nexo". Sem banco: o desempate dentro do minuto é
 * o id (sequencial na gravação); a mensagem sem hora fica junto da vizinha;
 * os avisos do WhatsApp não são fala; o áudio pega a hora do texto perto;
 * a extensão grava o texto antes de transcrever. E, lendo o banco (só
 * leitura), a conversa mais movimentada sai em ordem coerente.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { emOrdemDeConversa, ehAvisoDoWhatsApp } from "../lib/models/conversa";

let falhas = 0;
function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(64)} ${JSON.stringify(obtido)}`);
  if (!ok) console.log(`        ${"esperado".padEnd(64)} ${JSON.stringify(esperado)}`);
}

const min = (h: string) => new Date(`2026-11-06T${h}:00.000Z`);
console.log("\n  A ORDEM\n");
const lote = [
  { id: "cmvtn387x000r", em: min("14:29"), t: "Igual iffod" },
  { id: "cmvtn387x000o", em: min("14:29"), t: "Conseguiu ver?" },
  { id: "cmvtn3nnx0003", em: min("14:29"), t: "Perfeito!" },
  { id: "cmvtn387x000p", em: min("14:29"), t: "Ok" },
  { id: "cmvtn2ssf000m", em: min("14:27"), t: "Vou lhe mostrar!" },
];
conferir("dentro do minuto, a ordem da gravação (id)", emOrdemDeConversa(lote).map((m) => m.t), ["Vou lhe mostrar!", "Conseguiu ver?", "Ok", "Igual iffod", "Perfeito!"]);
const semHora = [
  { id: "c001", em: min("10:00"), t: "Oi" },
  { id: "c002", em: null, t: "[foto]" },
  { id: "c003", em: min("10:05"), t: "Tudo bem?" },
  { id: "c010", em: min("09:00"), t: "Bom dia (lote anterior)" },
];
conferir("sem hora fica junto da vizinha, não no topo", emOrdemDeConversa(semHora).map((m) => m.t), ["Bom dia (lote anterior)", "Oi", "[foto]", "Tudo bem?"]);
conferir("a primeira sem hora pega a hora da seguinte", emOrdemDeConversa([{ id: "a1", em: null, t: "x" }, { id: "a2", em: min("08:00"), t: "y" }, { id: "a0", em: min("07:00"), t: "z" }]).map((m) => m.t), ["z", "x", "y"]);

console.log("\n  O QUE NÃO É FALA\n");
for (const aviso of [
  "Aguardando mensagem. Essa ação pode levar alguns instantes.",
  "As mensagens e ligações são protegidas com a criptografia de ponta a ponta.",
  "+55 44 9907-1270 usa uma duração padrão para mensagens temporárias em conversas novas.",
  "A IA da Meta recebe as mensagens da conversa e pode usá-las",
]) conferir(`aviso: ${aviso.slice(0, 40)}…`, ehAvisoDoWhatsApp(aviso), true);
conferir("fala de verdade passa", ehAvisoDoWhatsApp("Aguardando o técnico ainda, pode me ajudar?"), false);

console.log("\n  A GRAVAÇÃO\n");
const servico = readFileSync("lib/services/conversas.service.ts", "utf8");
conferir("o servidor não grava aviso do WhatsApp", servico.includes("!ehAvisoDoWhatsApp(m.texto));"), true);
conferir("o 'Aguardando mensagem' guardado vira a mensagem de verdade", servico.includes("if (!real || !ehAvisoDoWhatsApp(e.texto)) continue;"), true);
conferir("toda leitura desempata pelo id", (servico.match(/ORDEM_DA_(CONVERSA|MAIS_NOVA)/g) ?? []).length >= 5, true);
const painel = readFileSync("extensao/conteudo/painel-contato.js", "utf8");
conferir("a extensão grava o texto antes de transcrever", painel.includes("novas.length || marcacoes.length ? [] : await transcreverAudios(audiosNovos)"), true);
conferir("a volta de gravar é de 8 s", painel.includes("INTERVALO_DE_GUARDAR_MS = 8_000"), true);
const whats = readFileSync("extensao/conteudo/whatsapp.js", "utf8");
conferir("o áudio leva a hora do texto mais perto", whats.includes("carimbo: carimboPerto(todasAsLinhas"), true);
const re = /\[([^\]]+)\]/;
conferir("e o carimbo é lido certo", "[14:36, 06/10/2026] Fulano: ".match(re)?.[1], "14:36, 06/10/2026");
conferir("a regex do carimbo no arquivo não perdeu as barras", whats.includes(String.raw`match(/\[([^\]]+)\]/)?.[1] ?? "").trim();`), true);

(async () => {
  if (process.env.DATABASE_URL) {
    console.log("\n  NA BASE (só leitura)\n");
    const { getPrisma } = await import("../lib/prisma");
    const p = getPrisma()!;
    const g: { conversaId: string }[] = await p.$queryRawUnsafe(`select "conversaId" from "MensagemDaConversa" where em is not null group by "conversaId", em having count(*) >= 4 order by count(*) desc limit 1`);
    if (g[0]) {
      const ms = await p.mensagemDaConversa.findMany({ where: { conversaId: g[0].conversaId }, select: { id: true, em: true, texto: true } });
      const ordem = emOrdemDeConversa(ms);
      const horas = ordem.filter((m) => m.em).map((m) => m.em!.getTime());
      conferir("a conversa mais cheia sai com a hora sempre andando para frente", horas.every((h, i) => i === 0 || h >= horas[i - 1]), true);
      conferir("nenhuma mensagem some", ordem.length, ms.length);
    }
  }
  console.log(falhas ? `\n  ${falhas} falha(s).\n` : "\n  Tudo certo.\n");
  process.exit(falhas ? 1 : 0);
})();
