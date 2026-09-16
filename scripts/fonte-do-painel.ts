import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * O painel como um texto só, para as conferências que o leem.
 *
 * Na Fase 8.5 o `painel.js` virou sete arquivos, e o que atravessa a
 * fronteira entre eles ganhou o prefixo `P.` — o objeto compartilhado.
 * Três conferências antigas (`check:atalho`, `check:dossie`,
 * `check:respostas`) leem o painel como texto para perguntar coisas de
 * comportamento: "esta função é chamada em quatro telas?", "o resumo
 * usa as respostas prontas?".
 *
 * Elas continuam perguntando a mesma coisa. Para isso, aqui os sete
 * voltam a ser um, e o endereço some: `P.blocoDossie = function
 * blocoDossie(` vira `function blocoDossie(`, e `P.blocoDossie(` vira
 * `blocoDossie(`. O que se lê é o painel de antes da divisão — que é
 * exatamente o que essas conferências querem ler.
 *
 * Quem quiser conferir a **divisão** (nome sem dono, ordem de carga,
 * atalho de teclado) usa `check:painel`, que lê os arquivos como eles
 * são.
 */
export function fonteDoPainel(raiz = resolve(__dirname, "..")) {

  const pasta = resolve(raiz, "extensao/conteudo");

  const juntos = readdirSync(pasta)
    .filter((nome) => /^painel-.*\.js$/.test(nome))
    .sort()
    .map((nome) => readFileSync(resolve(pasta, nome), "utf8"))
    .join("\n");

  return juntos
    .replace(/\bP\.([A-Za-z_$][\w$]*)\s*=\s*(async\s+)?function\s+\1\b/g, "$2function $1")
    .replace(/\bP\.([A-Za-z_$][\w$]*)/g, "$1");
}
