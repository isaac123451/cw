/**
 * Valor em reais digitado num campo.
 *
 *   npm run check:dinheiro
 *
 * Sem banco. O formulário de estabelecimento abria a mensalidade como
 * "209.99" e, ao salvar, tirava o ponto como milhar — abrir e salvar sem
 * mexer multiplicava o valor por 100 (uma conta de R$ 209,99 virou
 * R$ 20.999). Aqui: cada grafia comum lida certo, e o ida-e-volta do
 * campo não muda o valor.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { lerReais, reaisNoCampo } from "../lib/models/dinheiro";

let falhas = 0;
function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(54)} ${JSON.stringify(obtido)}`);
  if (!ok) console.log(`        ${"esperado".padEnd(54)} ${JSON.stringify(esperado)}`);
}

console.log("\n  VALOR EM REAIS\n");

conferir("vírgula decimal", lerReais("209,99"), 209.99);
conferir("milhar com ponto e decimal com vírgula", lerReais("1.234,56"), 1234.56);
conferir("ponto decimal com duas casas", lerReais("209.99"), 209.99);
conferir("ponto decimal com uma casa", lerReais("20.5"), 20.5);
conferir("ponto de milhar sem decimal", lerReais("1.234"), 1234);
conferir("com R$ e espaço", lerReais("R$ 1.234,56"), 1234.56);
conferir("vazio e texto não são número", [lerReais(""), lerReais("abc")].map(Number.isNaN), [true, true]);

for (const valor of [209.99, 20, 1234.5, 0.99, 18000]) {
  conferir(`abrir e salvar sem mexer mantém ${valor}`, lerReais(reaisNoCampo(valor)), valor);
}

const form = readFileSync(resolve(__dirname, "../components/estabelecimentos/EstablishmentForm.tsx"), "utf8");
conferir("o formulário abre a mensalidade no formato do campo", form.includes("reaisNoCampo(editing.mrr)"), true);
conferir("e lê com a mesma regra", form.includes("lerReais(mrr)"), true);

console.log(falhas === 0 ? "\n  Nenhum valor muda de tamanho entre o campo e o banco.\n" : `\n  ${falhas} ponto(s) a corrigir.\n`);
process.exitCode = falhas === 0 ? 0 : 1;
