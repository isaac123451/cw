/**
 * A plataforma sabe se a extensão de cada pessoa está em dia?
 *
 *   npm run check:versao-da-extensao
 *
 * 12/11/2026 (1.1.74). Sem banco: a comparação de versões, a leitura do
 * gravado, o freio de gravação, o cabeçalho que a extensão manda e o aviso
 * do sino. E a garantia de que nenhuma leitura das preferências pede a
 * linha inteira — senão a coluna nova quebraria tudo antes do db:push.
 */
import { readFileSync } from "node:fs";

import { compararVersoes, lerExtensaoVista, precisaGravar, situacaoDaExtensao } from "../lib/models/versaoDaExtensao";
import { buildNotifications } from "../lib/services/notifications.service";

let falhas = 0;
function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(62)} ${JSON.stringify(obtido)}`);
  if (!ok) console.log(`        ${"esperado".padEnd(62)} ${JSON.stringify(esperado)}`);
}

console.log("\n  A COMPARAÇÃO\n");
conferir("1.1.9 é menor que 1.1.10 (número, não texto)", compararVersoes("1.1.9", "1.1.10"), -1);
conferir("iguais", compararVersoes("1.1.74", "1.1.74"), 0);
const vista = (versao: string) => ({ versao, vistaEm: "2026-11-12T12:00:00.000Z" });
conferir("atrás da plataforma: desatualizada", situacaoDaExtensao(vista("1.1.70"), "1.1.74"), "desatualizada");
conferir("igual: em dia", situacaoDaExtensao(vista("1.1.74"), "1.1.74"), "em-dia");
conferir("à frente (extensão do disco antes do deploy): em dia", situacaoDaExtensao(vista("1.1.75"), "1.1.74"), "em-dia");
conferir("nunca vista", situacaoDaExtensao(null, "1.1.74"), "nunca-vista");
conferir("gravado estranho vira nada", [lerExtensaoVista({ versao: "abc", vistaEm: "x" }), lerExtensaoVista(null)], [null, null]);
const agora = new Date("2026-11-12T12:05:00.000Z");
conferir("mesma versão há 5 min: não grava de novo", precisaGravar(vista("1.1.74"), "1.1.74", agora), false);
conferir("versão nova: grava", precisaGravar(vista("1.1.73"), "1.1.74", agora), true);
conferir("mesma versão há 11 min: grava", precisaGravar(vista("1.1.74"), "1.1.74", new Date("2026-11-12T12:11:00.000Z")), true);

console.log("\n  O SINO\n");
const avisos = (v: string | null) =>
  buildNotifications([], [], undefined, undefined, [], [], undefined, {
    extensao: { vista: v ? vista(v) : null, plataforma: "1.1.74" },
  } as never).filter((n) => n.id === "extensao-desatualizada");
conferir("extensão atrás: avisa, com as duas versões", avisos("1.1.70").map((n) => n.detail?.includes("1.1.70") && n.detail?.includes("1.1.74")), [true]);
conferir("extensão em dia: não avisa", avisos("1.1.74").length, 0);
conferir("nunca vista: não avisa (ainda não instalou)", avisos(null).length, 0);

console.log("\n  A EXTENSÃO E O SERVIDOR\n");
conferir("a extensão manda a versão em toda chamada", readFileSync("extensao/fundo/service-worker.js", "utf8").includes('"X-CW-Versao": chrome.runtime.getManifest().version'), true);
const api = readFileSync("lib/api/extensao.ts", "utf8");
conferir("o servidor aceita o cabeçalho (CORS)", api.includes("X-CW-Sessao, X-CW-Versao, Content-Type"), true);
conferir("e grava ao autenticar", api.includes('registrarVersao(prisma, user.id, request.headers.get("x-cw-versao"))'), true);
const arquivos = ["lib/actions/preferences.ts", "lib/actions/primeiroAcesso.ts", "lib/actions/proximoPasso.ts", "lib/actions/recuperacao.ts", "lib/api/extensao.ts"];
const semSelect = arquivos.filter((f) => {
  const s = readFileSync(f, "utf8");
  /* Uma linha só ("…findUnique({ where…, select… })") ou várias, até o "})" no começo da linha. */
  return [...s.matchAll(/userPreference\s*\.(findUnique|upsert)\(\{([^\n]*\}\)|[\s\S]*?\n\s*\}\))/g)].some((m) => !m[2].includes("select"));
});
conferir("nenhuma leitura ou gravação de preferência pede a linha inteira", semSelect, []);

console.log(falhas ? `\n  ${falhas} falha(s).\n` : "\n  Tudo certo.\n");
process.exit(falhas ? 1 : 0);
