/**
 * Todo import existe com **exatamente** essa grafia?
 *
 *   npm run check:imports
 *
 * **Por que isto existe.** O build roda no Windows aqui e no Linux na
 * Vercel. O Windows não distingue maiúscula de minúscula em nome de
 * arquivo; o Linux distingue. Um `@/components/analytics/metricasCard`
 * apontando para `MetricasCard.tsx` compila na máquina de quem
 * escreveu e **quebra o build em produção** — com uma mensagem sobre
 * módulo não encontrado, num arquivo que está claramente lá.
 *
 * É a classe de erro mais cara que existe: invisível localmente,
 * fatal remotamente, e o deploy que falha continua servindo a versão
 * anterior sem avisar ninguém. Foi o que aconteceu em 04/09/2026 —
 * dois deploys seguidos com Error, a produção presa numa versão de
 * dias antes, e o sintoma chegando como "o banco não carrega nada".
 *
 * A varredura resolve cada import relativo e cada `@/` contra o disco,
 * comparando a grafia byte a byte com o que o sistema de arquivos
 * realmente tem.
 */
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";

import {
  basename,
  dirname,
  join,
  relative,
  resolve,
} from "node:path";

const RAIZ = resolve(__dirname, "..");

let falhas = 0;

/** Todos os arquivos de código abaixo de um diretório. */
function arquivos(dir: string): string[] {

  const saida: string[] = [];

  for (const nome of readdirSync(dir)) {

    if (nome === "node_modules" || nome === ".next") {
      continue;
    }

    const caminho = join(dir, nome);

    if (statSync(caminho).isDirectory()) {
      saida.push(...arquivos(caminho));
      continue;
    }

    if (/\.tsx?$/.test(nome)) saida.push(caminho);
  }

  return saida;
}

/** Os imports e reexports de um arquivo. */
function importesDe(fonte: string) {
  return [
    ...fonte.matchAll(
      /(?:^|\n)\s*(?:import|export)[^;'"]*?from\s+["']([^"']+)["']/g
    ),
    ...fonte.matchAll(
      /(?:^|\n)\s*import\s+["']([^"']+)["']/g
    ),
    ...fonte.matchAll(/\bimport\(\s*["']([^"']+)["']\s*\)/g),
  ].map((m) => m[1]);
}

/**
 * O caminho existe com esta grafia exata?
 *
 * `existsSync` no Windows responde `true` para grafia errada — é
 * justamente o que esconde o defeito. Por isso a conferência lê o
 * diretório e compara o nome com o que está lá.
 */
function grafiaConfere(caminho: string) {

  const pasta = dirname(caminho);
  const nome = basename(caminho);

  if (!existsSync(pasta)) return false;

  return readdirSync(pasta).includes(nome);
}

const SUFIXOS = [
  "",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  "/index.ts",
  "/index.tsx",
];

function resolver(deArquivo: string, spec: string) {

  let base: string;

  if (spec.startsWith("@/")) {
    base = resolve(RAIZ, spec.slice(2));
  } else if (spec.startsWith(".")) {
    base = resolve(dirname(deArquivo), spec);
  } else {
    /* Pacote do node_modules — fora do escopo desta varredura. */
    return "pacote";
  }

  for (const sufixo of SUFIXOS) {

    const tentativa = base + sufixo;

    if (!existsSync(tentativa)) continue;

    /*
      Existe pelo `existsSync`. Agora a pergunta que importa: existe
      com **esta** grafia? Cada segmento do caminho é conferido, porque
      o erro pode estar no nome da pasta e não no do arquivo.
    */
    const partes = relative(RAIZ, tentativa).split(/[\\/]/);

    let acumulado = RAIZ;
    let ok = true;

    for (const parte of partes) {
      const proximo = join(acumulado, parte);
      if (!grafiaConfere(proximo)) {
        ok = false;
        break;
      }
      acumulado = proximo;
    }

    return ok ? "ok" : "grafia";
  }

  return "sumido";
}

console.log(
  "\n  IMPORTS — existem com esta grafia exata?\n"
);

const todos = [
  ...arquivos(resolve(RAIZ, "app")),
  ...arquivos(resolve(RAIZ, "lib")),
  ...arquivos(resolve(RAIZ, "components")),
  ...arquivos(resolve(RAIZ, "scripts")),
];

let conferidos = 0;

const problemas: string[] = [];

for (const caminho of todos) {

  const fonte = readFileSync(caminho, "utf8");

  for (const spec of importesDe(fonte)) {

    const r = resolver(caminho, spec);

    if (r === "pacote") continue;

    conferidos += 1;

    if (r === "grafia") {
      problemas.push(
        `${relative(RAIZ, caminho)}\n           importa "${spec}" — existe, mas com outra grafia. Compila no Windows, quebra no Linux.`
      );
    }

    if (r === "sumido") {
      problemas.push(
        `${relative(RAIZ, caminho)}\n           importa "${spec}" — não achei o arquivo.`
      );
    }
  }
}

if (problemas.length === 0) {
  console.log(
    `  ok     ${conferidos} imports internos, todos com a grafia certa`
  );
  console.log(
    `         ${todos.length} arquivos varridos`
  );
} else {
  falhas = problemas.length;
  for (const p of problemas) {
    console.log(`FALHA    ${p}`);
  }
}

console.log(
  falhas === 0
    ? "\n  Nenhum import quebraria num sistema de arquivos sensível a maiúsculas.\n"
    : `\n  ${falhas} import(s) a corrigir antes do próximo deploy.\n`
);

process.exitCode = falhas === 0 ? 0 : 1;
