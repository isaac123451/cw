/**
 * Lista vazia explica o porquê e oferece o próximo passo?
 *
 *   npm run check:telas-sem-saida
 *
 * **O roadmap 1.0** ("Para dar vontade de usar"): "Nenhuma tela sem
 * saída: lista vazia explica o porquê e oferece o próximo passo."
 *
 * A varredura de 16/09/2026 achou sete listas principais que só diziam
 * "Nenhum…" — sem dizer se era base vazia ou filtro, e sem botão. Elas
 * passaram a usar `VazioComSaida`, e este check impede que voltem a ser
 * uma frase solta.
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

console.log("\n  NENHUMA TELA SEM SAÍDA\n");

const componente = ler("components/shared/VazioComSaida.tsx");
conferir("o componente tem porquê e saídas (link ou botão)", /porque\?:/.test(componente) && /s\.href \?/.test(componente) && /onClick=\{s\.onClick\}/.test(componente), true);

const telas: [string, string, RegExp][] = [
  ["Respostas prontas", "app/base-conhecimento/page.tsx", /rotulo: "Limpar a busca e a categoria"/],
  ["Clientes", "app/clientes/page.tsx", /rotulo: "Limpar a busca e o tipo"/],
  ["Reclame Aqui (lista)", "components/reclame-aqui/list/ListView.tsx", /onClick: clearFilters/],
  ["NPS (lista)", "components/nps/NpsList.tsx", /rotulo: "Limpar o recorte"/],
  ["NPS (a página passa como limpar)", "app/nps/page.tsx", /onLimparRecorte=\{\(\) => \{/],
  ["Google", "app/google/page.tsx", /rotulo: "Ver todas"/],
  ["Análise do NPS", "app/nps/analise/page.tsx", /rotulo: "Ver tudo"/],
  ["Cliente (impacto)", "components/clientes/ClientDetail.tsx", /rotulo: "Abrir Impacto no negócio"/],
];

for (const [nome, arquivo, marca] of telas) {
  const texto = ler(arquivo);
  const usa = arquivo === "app/nps/page.tsx" || /<VazioComSaida/.test(texto);
  conferir(`${nome}: vazio com saída`, usa && marca.test(texto), true);
}

/* A frase solta que motivou a varredura não volta. */
conferir(
  "a lista do RA não volta a ser só uma frase",
  /<p className="px-6 py-16 text-center text-sm text-zinc-400">\s*Nenhuma reclamação corresponde/.test(ler("components/reclame-aqui/list/ListView.tsx")),
  false
);

console.log(falhas === 0 ? "\n  As listas vazias dizem por quê e oferecem o próximo passo.\n" : `\n  ${falhas} ponto(s) a corrigir.\n`);
process.exit(falhas === 0 ? 0 : 1);
