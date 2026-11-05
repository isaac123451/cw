/**
 * Nenhum texto de tela com plural entre parênteses?
 *
 *   npm run check:plural
 *
 * "2 caso(s)", "dia(s) útil(eis)" foram trocados por plural de verdade em
 * out/2026 (mais de 440 textos) — e um voltou em 05/11/2026, no "sem
 * notícia" do Meu dia. Esta conferência varre o código da plataforma e da
 * extensão para não voltar de novo. As Novidades citam o erro antigo de
 * propósito e ficam de fora.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const RAIZ = resolve(__dirname, "..");
const PASTAS = ["app", "components", "lib", "core", "extensao"];
const FORA = [/lib[\/]models[\/]mudancas\.ts$/, /lib[\/]models[\/]novidades\.ts$/, /[\/]node_modules[\/]/, /[\/]generated[\/]/];
const PLURAL = /[a-záéíóúâêôãõç]\((s|es|is|eis|ns)\)/i;

function arquivos(pasta: string): string[] {
  return readdirSync(pasta).flatMap((nome) => {
    const caminho = join(pasta, nome);
    if (statSync(caminho).isDirectory()) return arquivos(caminho);
    return /\.(tsx?|js|html)$/.test(nome) ? [caminho] : [];
  });
}

const achados: string[] = [];
for (const pasta of PASTAS) {
  for (const arquivo of arquivos(join(RAIZ, pasta))) {
    if (FORA.some((r) => r.test(arquivo))) continue;
    readFileSync(arquivo, "utf8")
      .split("\n")
      .forEach((linha, i) => {
        /* Só dentro de texto (aspas ou crase), não em código como "fn(s)". */
        const textos = linha.match(/(["'`])(?:(?!\1).)*\1/g) ?? [];
        /* O que está dentro de ${…} é código ("escapar(s)"), não texto. */
        const temPlural = textos.some((t) => {
          const semCodigo = t.replace(/\$\{[^}]*\}/g, "");
          return PLURAL.test(semCodigo) && /\s/.test(semCodigo);
        });
        if (temPlural) achados.push(`${arquivo.slice(RAIZ.length + 1)}:${i + 1}: ${linha.trim().slice(0, 100)}`);
      });
  }
}

for (const a of achados) console.log(`  FALHA ${a}`);
console.log(achados.length ? `\n  ${achados.length} ${achados.length === 1 ? "texto" : "textos"} com plural entre parênteses.\n` : "\n  Nenhum plural entre parênteses.\n");
process.exit(achados.length ? 1 : 0);
