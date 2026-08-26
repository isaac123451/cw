/**
 * A plataforma sabe que dia é hoje?
 *
 *   npm run check:data
 *
 * Esta verificação existe por causa de um defeito específico: a data da
 * operação era a constante `REFERENCE_DATE = "2026-08-10"`, e a
 * aplicação inteira ficou presa nela. Prazo de SLA, agenda, gráficos,
 * alertas, "hoje" da extensão — tudo calculado contra o dia 10 enquanto
 * o calendário andava. Em 25/08 o painel dizia que ainda faltavam quinze
 * dias para vencer o que já tinha vencido.
 *
 * O que torna esse defeito perigoso é que ele **não quebra nada**. Não
 * há erro, não há tela em branco, o `tsc` fica limpo e os números
 * continuam plausíveis — só que errados por um número de dias que
 * cresce sozinho. É o tipo de coisa que só um teste encontra, porque
 * ninguém revisando código repara que uma data parou.
 *
 * Por isso as três perguntas abaixo:
 *
 *  1. `hojeNaOperacao()` devolve mesmo o dia de hoje?
 *  2. Ela devolve o mesmo valor no fuso do servidor e no do navegador?
 *     (é isso que mantém a hidratação fechando)
 *  3. Sobrou alguma data congelada em módulo, esperando para repetir a
 *     história?
 */

import "dotenv/config";

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { hojeNaOperacao } from "../lib/services/reputation.service";

const RAIZ = process.cwd();

let falhas = 0;

function ok(titulo: string, detalhe: string) {
  console.log(`  ok     ${titulo}  ·  ${detalhe}`);
}

function falha(titulo: string, detalhe: string) {
  falhas += 1;
  console.log(`  FALHA  ${titulo}`);
  console.log(`         ${detalhe}`);
}

console.log("\n  DATA DA OPERAÇÃO — a plataforma anda com o calendário\n");

/* ---------------------------------------------------------------- 1 */

const hoje = hojeNaOperacao();

const doRelogio = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());

if (hoje === doRelogio) {
  ok("hojeNaOperacao() devolve o dia de hoje", hoje);
} else {
  falha(
    "hojeNaOperacao() devolve o dia de hoje",
    `devolveu ${hoje}, mas hoje em São Paulo é ${doRelogio}`
  );
}

if (/^\d{4}-\d{2}-\d{2}$/.test(hoje)) {
  ok("o formato é AAAA-MM-DD", hoje);
} else {
  falha(
    "o formato é AAAA-MM-DD",
    `veio "${hoje}" — as comparações da base são lexicográficas e dependem desse formato`
  );
}

/* ---------------------------------------------------------------- 2 */

/**
 * O mesmo dia visto de fusos diferentes.
 *
 * É o cenário que fez alguém congelar a data: servidor em UTC, navegador
 * em UTC−3. Entre 21h e meia-noite de Brasília os dois discordam sobre
 * a data — a menos que o fuso esteja fixado, que é o que se testa aqui.
 */
const fusoOriginal = process.env.TZ;

const emOutroFuso: string[] = [];

for (const tz of ["UTC", "America/Sao_Paulo", "Asia/Tokyo"]) {
  process.env.TZ = tz;
  emOutroFuso.push(hojeNaOperacao());
}

process.env.TZ = fusoOriginal;

const todosIguais = new Set(emOutroFuso).size === 1;

if (todosIguais) {
  ok(
    "o fuso do processo não muda a resposta",
    `UTC, São Paulo e Tóquio devolvem ${emOutroFuso[0]} — é o que mantém a hidratação fechando`
  );
} else {
  falha(
    "o fuso do processo não muda a resposta",
    `UTC=${emOutroFuso[0]} São Paulo=${emOutroFuso[1]} Tóquio=${emOutroFuso[2]} — servidor e navegador vão discordar, e a hidratação quebra`
  );
}

/* ---------------------------------------------------------------- 3 */

/**
 * Nenhuma data pode ficar guardada num módulo.
 *
 * `const HOJE = hojeNaOperacao()` no topo de um arquivo é o mesmo
 * defeito de antes com outra roupa: o valor é calculado quando o módulo
 * carrega e nunca mais. Num servidor de pé há três dias, é a data de
 * anteontem — e de novo sem erro nenhum para denunciar.
 */
const arquivos: string[] = [];

function varrer(dir: string) {
  for (const nome of readdirSync(dir)) {
    if (nome === "node_modules" || nome === ".next") continue;
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) varrer(p);
    else if (/\.tsx?$/.test(nome)) arquivos.push(p);
  }
}

for (const pasta of ["app", "lib", "components"]) {
  const p = join(RAIZ, pasta);
  try {
    varrer(p);
  } catch {
    /* pasta ausente não é erro */
  }
}

/** Atribuição em coluna zero: só escopo de módulo tem indentação zero. */
const CONGELADA =
  /^(?:const|let|var)\s+\w+\s*=\s*hojeNaOperacao\(\)/gm;

const congeladas: string[] = [];
const constantesAntigas: string[] = [];

for (const p of arquivos) {

  const texto = readFileSync(p, "utf8");
  const rel = relative(RAIZ, p).split("\\").join("/");

  for (const achado of texto.match(CONGELADA) ?? []) {
    congeladas.push(`${rel} — ${achado.trim()}`);
  }

  /*
    E a constante de data escrita à mão, que é como o defeito nasceu.
    Uma string AAAA-MM-DD atribuída a um nome em maiúsculas raramente é
    outra coisa que não uma data de referência disfarçada.
  */
  const antiga = texto.match(
    /^(?:export\s+)?const\s+[A-Z_]{4,}\s*=\s*["']\d{4}-\d{2}-\d{2}["']/gm
  );

  for (const achado of antiga ?? []) {
    constantesAntigas.push(`${rel} — ${achado.trim()}`);
  }
}

if (congeladas.length === 0) {
  ok(
    "nenhuma data guardada em escopo de módulo",
    `${arquivos.length} arquivo(s) varridos`
  );
} else {
  falha(
    "nenhuma data guardada em escopo de módulo",
    congeladas.join("\n         ")
  );
}

if (constantesAntigas.length === 0) {
  ok(
    "nenhuma data fixa escrita à mão",
    "nada como CONSTANTE = \"2026-08-10\""
  );
} else {
  falha(
    "nenhuma data fixa escrita à mão",
    constantesAntigas.join("\n         ")
  );
}

/* ---------------------------------------------------------------- */

console.log("");

if (falhas === 0) {
  console.log("  A plataforma anda com o calendário.\n");
  process.exit(0);
}

console.log(
  `  ${falhas} problema(s) — a plataforma vai discordar do calendário.\n`
);

process.exit(1);
