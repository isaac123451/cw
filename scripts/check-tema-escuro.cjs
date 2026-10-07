/**
 * Texto forte que o tema escuro não inverte.
 *
 *   npm run check:tema-escuro
 *
 * Sem banco e sem navegador. O tema escuro troca as cores por variável:
 * `.dark { --color-amber-900: … }` em `app/globals.css`. Um tom que não
 * está na lista continua com o valor do claro — e um 900 ou 950 do
 * claro é quase preto. Foi assim que "Lembretes de segurança" (âmbar
 * 950) e os quadros de destaque da Documentação (azul 900) ficaram
 * escuros sobre escuro (out/2026).
 *
 * Aqui: toda classe `text-<cor>-<600 ou mais>` usada em `app/` e
 * `components/` tem de ter a inversão. Cinza (zinc) tem regra própria e
 * fica de fora.
 */
const fs = require("node:fs");
const path = require("node:path");

const raiz = path.join(__dirname, "..");
const css = fs.readFileSync(path.join(raiz, "app/globals.css"), "utf8");

const invertidas = new Set();
for (const bloco of css.matchAll(/\.dark\s*\{([^}]*)\}/g)) {
  for (const v of bloco[1].matchAll(/--color-([a-z]+-\d+)/g)) invertidas.add(v[1]);
}
for (const regra of css.matchAll(/\.dark [^{]*\.text-([a-z]+-\d+)/g)) invertidas.add(regra[1]);

const usadas = new Map();
function andar(pasta) {
  for (const nome of fs.readdirSync(pasta)) {
    const caminho = path.join(pasta, nome);
    if (fs.statSync(caminho).isDirectory()) {
      andar(caminho);
      continue;
    }
    if (!/\.tsx?$/.test(nome)) continue;
    const texto = fs.readFileSync(caminho, "utf8");
    for (const m of texto.matchAll(/(?<![\w-])(?:[a-z-]+:)*text-([a-z]+)-(\d{2,3})(?!\d)/g)) {
      if (m[1] === "zinc" || Number(m[2]) < 600) continue;
      const chave = `${m[1]}-${m[2]}`;
      if (!usadas.has(chave)) usadas.set(chave, new Set());
      usadas.get(chave).add(path.relative(raiz, caminho));
    }
  }
}
andar(path.join(raiz, "app"));
andar(path.join(raiz, "components"));

const faltam = [...usadas].filter(([chave]) => !invertidas.has(chave)).sort();

console.log("\n  TEXTO FORTE NO TEMA ESCURO\n");
console.log(`  ${usadas.size} tons fortes em uso, ${usadas.size - faltam.length} com inversão.`);
for (const [chave, arquivos] of faltam) {
  console.log(`  FALHA text-${chave} sem inversão no .dark — ${[...arquivos].slice(0, 3).join(", ")}`);
}
console.log(faltam.length === 0 ? "\n  Nenhum texto escuro sobre fundo escuro.\n" : `\n  ${faltam.length} tom(ns) a inverter em app/globals.css.\n`);
process.exitCode = faltam.length === 0 ? 0 : 1;
