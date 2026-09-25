/**
 * Identificação que acerta mais — as pistas e a regra do nome.
 *
 *   npm run check:identificacao
 *
 * Sem banco: `pistasDoTexto` e `nomeSustentaSugestao`. A busca no banco
 * foi medida com `scripts/medir-identificacao.ts`.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { nomeSustentaSugestao, pistasDoTexto } from "../lib/services/contatoConhecido.service";

let falhas = 0;
function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(60)} ${String(JSON.stringify(obtido)).slice(0, 44)}`);
  if (!ok) console.log(`        ${"esperado".padEnd(60)} ${String(JSON.stringify(esperado)).slice(0, 44)}`);
}

console.log("\n  IDENTIFICAÇÃO — pistas e nome\n");

const p = pistasDoTexto("meu cnpj é 12.345.678/0001-90 e o cpf 123.456.789-09; email Loja@Exemplo.com; cardápio https://app.cardapioweb.com/pizzaria-bella e bella.cardapioweb.com; site https://www.google.com");
conferir("CNPJ e CPF viram dígitos", p.documentos, ["12345678000190", "12345678909"]);
conferir("e-mail em minúsculas", p.emails, ["loja@exemplo.com"]);
conferir("as duas formas do endereço do cardápio; outro site não", p.slugs, ["pizzaria-bella", "bella"]);
conferir("telefone não vira documento", pistasDoTexto("me liga no 48 99664-0777").documentos, []);

conferir("\"Bella Napoli\" casa com \"Pizzaria Bella Napoli\"", nomeSustentaSugestao("Bella Napoli", "Pizzaria Bella Napoli"), true);
conferir("\"Napoli\" sozinho casa com \"Pizzaria Napoli\"", nomeSustentaSugestao("Napoli", "Pizzaria Napoli"), true);
conferir("sobrenome não liga pessoa a loja (Gomes)", nomeSustentaSugestao("Marcia Gomes da Cunha", "Lanche do Gomes"), false);
conferir("sobrenome não liga pessoa a loja (Neto)", nomeSustentaSugestao("Dilson Neto", "Açaí do Neto"), false);
conferir("só palavra genérica não liga nada", nomeSustentaSugestao("Pizzaria", "Pizzaria Central"), false);

const painel = readFileSync(resolve(__dirname, "../extensao/conteudo/painel-contato.js"), "utf8");
conferir("o painel manda as pistas, não o texto da conversa", [painel.includes('tipo: "quemE", nome, pistas'), /tipo: "quemE"[^\n]*texto/.test(painel)], [true, false]);

console.log(`\n  ${falhas === 0 ? "Tudo certo." : `${falhas} falha(s).`}\n`);
process.exit(falhas === 0 ? 0 : 1);
