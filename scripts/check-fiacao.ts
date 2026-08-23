/**
 * A fiação da extensão: nenhum botão solto, nenhuma rota inventada.
 *
 *   npm run check:fiacao
 *
 * O painel da extensão é HTML montado em texto, e os cliques são
 * despachados por `data-acao`. Nada disso passa por `tsc`: um botão com
 * `data-acao="triar"` e nenhum `case "triar"` compila, renderiza,
 * aparece bonito na tela e **não faz nada** ao ser clicado.
 *
 * São três elos, e o rompimento de qualquer um é silencioso:
 *
 *   botão  →  tratador do clique  →  service worker  →  rota da API
 *
 * `check:extensao` prova o último elo contra a aplicação no ar. Este
 * prova os três primeiros, sem precisar de servidor — é estático de
 * propósito, para rodar antes de subir.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const RAIZ = resolve(__dirname, "..");

const painel = readFileSync(
  resolve(RAIZ, "extensao/conteudo/painel.js"),
  "utf8"
);

const worker = readFileSync(
  resolve(RAIZ, "extensao/fundo/service-worker.js"),
  "utf8"
);

let falhas = 0;

function reportar(titulo: string, faltando: string[]) {

  if (faltando.length > 0) falhas += 1;

  console.log(
    `${faltando.length === 0 ? "  ok  " : "FALHA "} ${titulo}${
      faltando.length === 0
        ? ""
        : `  →  ${faltando.join(", ")}`
    }`
  );
}

function unicos(
  fonte: string,
  padrao: RegExp,
  grupo = 1
) {
  return [
    ...new Set(
      [...fonte.matchAll(padrao)].map((m) => m[grupo])
    ),
  ].sort();
}

console.log("\n  FIAÇÃO DA EXTENSÃO\n");

/* ============================================================
   1. BOTÃO → TRATADOR
============================================================ */

const declarados = unicos(
  painel,
  /data-acao="([a-z-]+)"/g
);

/**
 * Só `acao === "..."`, com a palavra isolada.
 *
 * Sem a fronteira, o padrão casa o fim de `situacao === "estourado"` e
 * acusa três valores de SLA como se fossem botões órfãos — foi o que
 * aconteceu na primeira tentativa desta varredura.
 */
const tratados = unicos(
  painel,
  /(?:^|[^a-zA-Z])acao === "([a-z-]+)"/gm
);

reportar(
  `${declarados.length} botões declarados, todos com tratador`,
  declarados.filter((a) => !tratados.includes(a))
);

/* ============================================================
   2. PAINEL → SERVICE WORKER
============================================================ */

/**
 * O tipo da mensagem é o primeiro campo do objeto enviado.
 *
 * `CW.enviar({ tipo: "anotar", anotacao: { tipo: "caso" } })` tem dois
 * campos chamados `tipo`, e só o de fora é o da mensagem. A âncora em
 * `enviar({` recorta o certo — sem ela, a varredura acusa `"caso"` como
 * mensagem sem tratador, que foi o primeiro alarme falso daqui.
 */
const enviados = unicos(
  painel,
  /CW\.enviar\(\{\s*tipo:\s*"([a-zA-Z]+)"/g
);

const atendidos = unicos(
  worker,
  /mensagem\?\.tipo === "([a-zA-Z]+)"/g
);

reportar(
  `${enviados.length} tipos de mensagem, todos atendidos`,
  enviados.filter((t) => !atendidos.includes(t))
);

/**
 * O contrário também é defeito, embora mais barato.
 *
 * Tratador sem quem chame é código que ninguém exercita — e que
 * ninguém percebe quando quebra.
 */
const orfaosNoWorker = atendidos.filter(
  (t) => !enviados.includes(t)
);

console.log(
  orfaosNoWorker.length === 0
    ? `  ok   nenhum tratador sobrando no service worker`
    : `  --   tratadores sem quem chame: ${orfaosNoWorker.join(", ")}`
);

/* ============================================================
   3. SERVICE WORKER → ROTA DA API
============================================================ */

const caminhos = unicos(
  worker,
  /["'`](\/api\/[a-z0-9/-]+)["'`]/g
);

const semRota = caminhos.filter(
  (c) =>
    !existsSync(
      resolve(RAIZ, "app", c.slice(1), "route.ts")
    )
);

reportar(
  `${caminhos.length} rotas chamadas, todas existem`,
  semRota
);

/* ============================================================
   4. A VERSÃO ANDA JUNTO
============================================================ */

const manifesto = JSON.parse(
  readFileSync(
    resolve(RAIZ, "extensao/manifest.json"),
    "utf8"
  )
) as { version: string };

const pacote = JSON.parse(
  readFileSync(resolve(RAIZ, "package.json"), "utf8")
) as { version: string };

/**
 * A extensão e a aplicação sobem no mesmo número.
 *
 * É como se descobre, olhando a tela, se a pessoa está com a versão que
 * tem o conserto — e um número que atrasa faz o suporte perguntar a
 * coisa errada.
 */
const juntas = manifesto.version === pacote.version;

if (!juntas) falhas += 1;

console.log(
  `${juntas ? "  ok  " : "FALHA "} versão: extensão ${manifesto.version}, aplicação ${pacote.version}`
);

console.log(
  falhas === 0
    ? "\n  Nenhum botão solto, nenhuma rota inventada.\n"
    : `\n  ${falhas} elo(s) rompido(s).\n`
);

process.exit(falhas === 0 ? 0 : 1);
