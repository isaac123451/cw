/**
 * O que deste código chega a alguma tela?
 *
 *   npm run check:mortos
 *
 * Já foram removidos dois blocos de código morto neste projeto —
 * `lib/actions/case.actions.ts` e `components/case-details/` — e os
 * dois foram achados por acaso, olhando outra coisa. Isto procura de
 * propósito.
 *
 * **Código morto aqui não é só desperdício.** Os dois casos achados
 * tinham a mesma forma: uma tela de aparência normal, alimentada por
 * dados inventados, com botões que não gravavam nada. Enquanto o
 * arquivo existe, alguém pode importá-lo por engano — o nome é
 * plausível, o componente compila, e o defeito só aparece quando um
 * cliente vê o dado errado.
 *
 * O método é o único que dá resposta confiável: partir das raízes que o
 * Next carrega de fato (`app/**` e os arquivos de configuração) e
 * seguir cada `import`. O que a caminhada não alcançar, ninguém
 * alcança.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const RAIZ = resolve(__dirname, "..");

const EXTENSOES = [
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
];

/**
 * Diretórios fora da varredura, **pelo caminho e não pelo nome**.
 *
 * A primeira versão comparava só o nome da pasta, e isso escondeu
 * `app/api/extensao/` — que tem o mesmo nome da pasta da extensão de
 * navegador, na raiz. Resultado: as sete rotas que a extensão chama
 * ficaram fora da caminhada, e `lib/api/extensao.ts` apareceu como
 * órfão sendo importado por todas elas.
 *
 * Um detector de código morto que dá falso positivo é pior do que
 * nenhum: a resposta dele é uma lista de arquivos para apagar.
 */
const IGNORAR = [
  "node_modules",
  ".next",
  ".git",
  "extensao",
  "public",
];

function listar(dir: string): string[] {

  const saida: string[] = [];

  for (const nome of readdirSync(dir)) {

    const rel = relative(join(dir, nome), RAIZ)
      ? relative(RAIZ, join(dir, nome)).replace(
          /\\/g,
          "/"
        )
      : "";

    if (IGNORAR.includes(rel)) continue;

    const caminho = join(dir, nome);

    if (statSync(caminho).isDirectory()) {
      saida.push(...listar(caminho));
      continue;
    }

    if (EXTENSOES.some((e) => nome.endsWith(e))) {
      saida.push(caminho);
    }
  }

  return saida;
}

/** Resolve um import para um arquivo real, como o bundler faria. */
function resolver(
  deOndeVeio: string,
  especificador: string
): string | null {

  let base: string;

  if (especificador.startsWith("@/")) {
    base = join(RAIZ, especificador.slice(2));
  } else if (especificador.startsWith(".")) {
    base = resolve(dirname(deOndeVeio), especificador);
  } else {
    // Pacote do node_modules — fora do escopo.
    return null;
  }

  for (const ext of ["", ...EXTENSOES]) {
    const tentativa = base + ext;
    try {
      if (statSync(tentativa).isFile()) return tentativa;
    } catch {
      /* segue */
    }
  }

  for (const ext of EXTENSOES) {
    const tentativa = join(base, "index" + ext);
    try {
      if (statSync(tentativa).isFile()) return tentativa;
    } catch {
      /* segue */
    }
  }

  return null;
}

function importsDe(arquivo: string): string[] {

  const texto = readFileSync(arquivo, "utf8");

  const achados: string[] = [];

  const padroes = [
    /import\s+[^"']*?from\s*["']([^"']+)["']/g,
    /import\s*["']([^"']+)["']/g,
    /export\s+[^"']*?from\s*["']([^"']+)["']/g,
    /import\(\s*["']([^"']+)["']\s*\)/g,
    /require\(\s*["']([^"']+)["']\s*\)/g,
  ];

  for (const padrao of padroes) {
    for (const m of texto.matchAll(padrao)) {
      achados.push(m[1]);
    }
  }

  return achados;
}

/**
 * As raízes.
 *
 * Tudo em `app/` (o Next carrega por convenção de arquivo, não por
 * import), o middleware, a configuração e os scripts — que são pontos
 * de entrada de verdade, ainda que fora do navegador.
 */
const todos = listar(RAIZ).map((f) =>
  f.replace(/\\/g, "/")
);

const raizes = todos.filter((f) => {

  const rel = relative(RAIZ, f).replace(/\\/g, "/");

  return (
    rel.startsWith("app/") ||
    // O seed é ponto de entrada de verdade: npm run db:seed.
    rel === "prisma/seed.ts" ||
    rel.startsWith("scripts/") ||
    rel === "middleware.ts" ||
    rel.startsWith("core/") ||
    /^(next|tailwind|postcss|prisma|eslint)\.config\./.test(
      rel
    )
  );
});

const vivos = new Set<string>();
const fila = [...raizes];

while (fila.length > 0) {

  const atual = fila.pop()!;

  if (vivos.has(atual)) continue;

  vivos.add(atual);

  for (const spec of importsDe(atual)) {

    const destino = resolver(atual, spec);

    if (destino) {
      fila.push(destino.replace(/\\/g, "/"));
    }
  }
}

/**
 * Órfãos por natureza, com motivo declarado.
 *
 * `next-env.d.ts` é gerado pelo próprio Next a cada build e existe só
 * para o TypeScript enxergar os tipos do framework. Ninguém o importa,
 * e apagá-lo faz o `tsc` perder as definições — ele volta sozinho no
 * build seguinte.
 */
const ORFAOS_LEGITIMOS = ["next-env.d.ts"];

const mortos = todos
  .filter((f) => !vivos.has(f))
  .map((f) => relative(RAIZ, f).replace(/\\/g, "/"))
  .filter((f) => !ORFAOS_LEGITIMOS.includes(f))
  .sort();

console.log(
  "\n  MORTOS — o que nenhuma tela alcança\n"
);

console.log(
  `  ${todos.length} arquivos varridos · ${vivos.size} alcançados · ${mortos.length} órfãos\n`
);

let linhasMortas = 0;

for (const m of mortos) {

  const n = readFileSync(
    join(RAIZ, m),
    "utf8"
  ).split("\n").length;

  linhasMortas += n;

  console.log(
    `  ${String(n).padStart(5)} linhas   ${m}`
  );
}

console.log(
  mortos.length === 0
    ? "\n  Todo arquivo chega a alguma tela.\n"
    : `\n  ${linhasMortas} linhas que ninguém alcança.\n`
);

process.exit(mortos.length === 0 ? 0 : 1);
