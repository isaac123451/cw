/**
 * Expressões regulares que perderam a barra.
 *
 *   npm run check:barras
 *
 * Uma edição feita por ferramenta já engoliu a barra de `\d`, `\s` e
 * `\w` mais de uma vez, e o código continua compilando: `/^d{4}-d{2}-d{2}$/`
 * é uma expressão válida — só que casa com o texto "dddd-dd-dd". Foi
 * assim que a exportação da Planilha de Métricas passou a recusar toda
 * data ("Intervalo de datas inválido"), que o resumo da conversa saiu na
 * exportação com cada "s" trocado por espaço ("Re umo salvo") e que a
 * prova de envio dos disparos deixou de juntar os espaços. Nenhum teste
 * pegava, porque nenhum teste lia a expressão.
 *
 * Esta conferência lê os literais de regex do código e acusa `d{`, `d+`,
 * `s+`, `s*` e `w+` sem barra, fora de classe de caracteres.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { pluralDe } from "../lib/plural";

const RAIZ = join(__dirname, "..");
const PASTAS = ["lib", "app", "components", "extensao", "core", "scripts"];

/**
 * O que parece e não é: "d?[oa]" é "do/da/o/a" de propósito (o pedido
 * de cancelamento), e não um dígito opcional.
 */
const PERMITIDOS = [/\(d\?\[oa\] /];

const LITERAL = /(?:^|[(,=:\[!&|?]|return)\s*\/((?:\\.|\[(?:\\.|[^\]\\])*\]|[^/\n\\[])+)\/[gimsuy]*/g;
const SUSPEITO = /(?:^|[^\\a-zA-Z])(d\{\d|d[+*?](?![a-z])|s[+*](?![a-z])|w[+*](?![a-z]))/;

const achados: string[] = [];

function andar(pasta: string) {
  for (const item of readdirSync(pasta, { withFileTypes: true })) {
    const caminho = join(pasta, item.name);
    if (item.isDirectory()) {
      if (!/node_modules|\.next|generated|\.tmp/.test(caminho)) andar(caminho);
      continue;
    }
    if (!/\.(ts|tsx|js|cjs|mjs)$/.test(item.name) || caminho.endsWith("check-barras.ts")) continue;

    let dentroDeComentario = false;
    readFileSync(caminho, "utf8")
      .split(/\r?\n/)
      .forEach((linha, i) => {
        /* Comentário de bloco cita a expressão quebrada para explicar o conserto — não é código. */
        if (dentroDeComentario || /^\s*\/\*/.test(linha)) {
          dentroDeComentario = !linha.includes("*/");
          return;
        }
        if (/^\s*(\*|\/\/)/.test(linha)) return;
        LITERAL.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = LITERAL.exec(linha))) {
          const corpo = m[1].replace(/\[(?:\\.|[^\]\\])*\]/g, "[]");
          if (SUSPEITO.test(corpo) && !PERMITIDOS.some((p) => p.test(m![1]))) {
            achados.push(`  ${relative(RAIZ, caminho)}:${i + 1}  /${m[1].slice(0, 70)}/`);
          }
        }
      });
  }
}

for (const p of PASTAS) andar(join(RAIZ, p));

console.log("\n  EXPRESSÕES SEM A BARRA\n");
if (achados.length) {
  console.log(achados.join("\n"));
  console.log(`\n  ${achados.length} ${pluralDe(achados.length, "expressão", "expressões")} com \\d, \\s ou \\w sem a barra — confira cada uma.\n`);
  process.exitCode = 1;
} else {
  console.log("  Nenhum \\d, \\s ou \\w perdeu a barra.\n");
}
