/**
 * A abertura da plataforma faz uma ida só, e não sete em fila?
 *
 *   npm run check:carga-inicial
 *
 * **Fase 10.2, desempenho medido.** O Next executa as server actions de
 * uma aba uma de cada vez. Os providers do layout raiz pediam cada um a
 * sua leitura — cadastro, casos, NPS, causas do NPS, preferências,
 * filtros e Google —, e cada uma esperava a anterior.
 *
 * Medido no painel, em dev, recarregando a página (16–17/09/2026):
 *
 *   antes   14 idas em fila (7 × 2 do StrictMode); a última terminava
 *           5,6 s depois da primeira — 2,9 s por passada
 *   depois  1 ida com os sete pedaços (223 kB) em 1,0 s, e só o
 *           calendário à parte
 *
 * O check segura a fiação: a action roda tudo em paralelo, cada provider
 * pega a sua parte, e a parte só vale na abertura — depois, cada um volta
 * ao caminho próprio, para nunca servir dado velho.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const RAIZ = resolve(__dirname, "..");

let falhas = 0;

function conferir(titulo: string, obtido: unknown, esperado: unknown) {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas += 1;
  console.log(`  ${ok ? "ok   " : "FALHA"} ${titulo.padEnd(64)} ${JSON.stringify(obtido)?.slice(0, 44)}`);
}

const ler = (arquivo: string) => readFileSync(resolve(RAIZ, arquivo), "utf8");

console.log("\n  CARGA INICIAL — uma ida, em paralelo\n");

const acao = ler("lib/actions/cargaInicial.ts");
conferir("a action lê as sete partes com Promise.all", /await Promise\.all\(\[/.test(acao) && (acao.match(/parte\("/g) ?? []).length, 7);
conferir("parte que falha não derruba as outras", /return \{ ok: false \}/.test(acao), true);

const cliente = ler("lib/context/cargaInicial.ts");
conferir("a parte só vale na abertura (validade curta)", /VALIDADE_MS = 10_000/.test(cliente) && /return caminhoProprio\(\);/.test(cliente), true);

const usos: [string, string][] = [
  ["lib/context/useWorkspace.ts", 'daCargaInicial("workspace"'],
  ["lib/context/CaseContext.tsx", 'daCargaInicial("casos"'],
  ["lib/context/NpsContext.tsx", 'daCargaInicial("nps"'],
  ["lib/context/NpsContext.tsx", 'daCargaInicial("causasDoNps"'],
  ["lib/context/PreferencesContext.tsx", 'daCargaInicial("preferencias"'],
  ["lib/context/SavedFiltersContext.tsx", 'daCargaInicial("filtros"'],
  ["lib/context/useAvaliacoesGoogle.ts", 'daCargaInicial("google"'],
];
for (const [arquivo, marca] of usos) {
  conferir(`${arquivo.split("/").pop()} pega ${marca.split('"')[1]} da ida única`, ler(arquivo).includes(marca), true);
}

conferir("recarregar o Google depois de gravar vai direto", ler("lib/context/useAvaliacoesGoogle.ts").includes("forcar ? listarAvaliacoesGoogle()"), true);

console.log(falhas === 0 ? "\n  A abertura faz uma ida só.\n" : `\n  ${falhas} ponto(s) a corrigir.\n`);
process.exit(falhas === 0 ? 0 : 1);
