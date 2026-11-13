/**
 * A extensão está disponível na plataforma e se atualiza sozinha?
 *
 *   npm run check:extensao-atualiza
 *
 * 13/11/2026 — "deixe disponível na plataforma a extensão", "ela precisa
 * sempre atualizar certinho". Sem banco e sem Chrome: o zip, as peças da
 * atualização no service worker, a ponte e a página.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

import { compararVersoes } from "../extensao/fundo/atualizacao.js";

let falhas = 0;
function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(64)} ${JSON.stringify(obtido)}`);
  if (!ok) console.log(`        ${"esperado".padEnd(64)} ${JSON.stringify(esperado)}`);
}

console.log("\n  O ZIP\n");
execFileSync("node", ["scripts/zip-da-extensao.js"], { stdio: "ignore" });
const versao = JSON.parse(readFileSync("extensao/manifest.json", "utf8")).version;
const info = JSON.parse(readFileSync("public/extensao/versao.json", "utf8"));
conferir("o zip leva a versão do manifesto", info.versao, versao);
const zip = readFileSync("public/extensao/cw-reputacao-extensao.zip");
conferir("é zip de verdade (começa com PK)", zip.subarray(0, 2).toString("latin1"), "PK");
conferir("tem o manifesto dentro da pasta", zip.includes(Buffer.from("cw-reputacao-extensao/manifest.json")), true);
conferir("tem o módulo de atualização", zip.includes(Buffer.from("cw-reputacao-extensao/fundo/atualizacao.js")), true);
conferir("o build gera o zip (também na Vercel)", JSON.parse(readFileSync("package.json", "utf8")).scripts.build.includes("node scripts/zip-da-extensao.js"), true);
conferir("o zip não vai para o repositório", readFileSync(".gitignore", "utf8").includes("public/extensao/"), true);

console.log("\n  A ATUALIZAÇÃO SOZINHA\n");
conferir("1.1.9 < 1.1.10 (número, não texto)", compararVersoes("1.1.9", "1.1.10"), -1);
const sw = readFileSync("extensao/fundo/service-worker.js", "utf8");
const at = readFileSync("extensao/fundo/atualizacao.js", "utf8");
conferir("confere a pasta a cada 5 minutos", at.includes("periodInMinutes: INTERVALO_MIN") && at.includes("const INTERVALO_MIN = 5;"), true);
conferir("pasta diferente → recarrega", at.includes("if (disco && disco !== rodando)") && at.includes("chrome.runtime.reload()"), true);
conferir("o relógio está ligado ao alarme", sw.includes("if (alarme.name === ALARME_ATUALIZACAO) rodadaDeAtualizacao()"), true);
conferir("ao abrir o Chrome também confere", sw.includes('conferirAtualizacao({ motivo: "inicio" })'), true);
conferir("depois de atualizar, volta às abas abertas", sw.includes('if (detalhe?.reason === "update")') && sw.includes("voltarAsAbasAbertas()"), true);
conferir("tira o painel velho antes de injetar o novo", at.includes("el.remove()") && at.includes("files: entrada.js"), true);
conferir("plataforma mais nova → avisa uma vez por versão", at.includes("CHAVE_AVISADA") && at.includes("Há uma versão nova da extensão"), true);
conferir("o aviso leva à página Extensão", sw.includes("chrome.tabs.create({ url: `${base}/extensao` })"), true);
conferir("a plataforma diz a versão dela à extensão", readFileSync("app/api/extensao/sessao/route.ts", "utf8").includes("versaoDaPlataforma: process.env.NEXT_PUBLIC_VERSAO"), true);
conferir("a ponte repassa o 'atualizar agora'", readFileSync("extensao/conteudo/ponte.js", "utf8").includes('"atualizarAgora"'), true);
conferir("o service worker atende o 'atualizar agora'", sw.includes('if (mensagem?.tipo === "atualizarAgora")'), true);

console.log("\n  A PÁGINA\n");
conferir("a página existe", existsSync("app/extensao/page.tsx"), true);
conferir("está no menu", readFileSync("core/navigation/menu.ts", "utf8").includes('href: "/extensao"'), true);
const pagina = readFileSync("components/extensao/PaginaDaExtensao.tsx", "utf8");
conferir("tem o botão de baixar o zip", pagina.includes('href="/extensao/cw-reputacao-extensao.zip"'), true);
conferir("tem o 'atualizar agora'", pagina.includes('pedirAExtensao<') && pagina.includes('"atualizarAgora"'), true);

console.log(falhas ? `\n  ${falhas} falha(s).\n` : "\n  Tudo certo.\n");
process.exit(falhas ? 1 : 0);
