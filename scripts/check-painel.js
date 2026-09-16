/**
 * Prova que os sete arquivos do painel continuam se encontrando.
 *
 * **O que mudou e por que isto existe.** O painel era um arquivo só, e
 * um nome escrito errado virava erro na hora de carregar. Dividido em
 * sete, um nome errado vira `undefined` num objeto compartilhado — e
 * `undefined` só estoura quando alguém aperta aquele botão, que pode ser
 * semanas depois, na máquina de outra pessoa.
 *
 * Esta conferência lê os arquivos com um parser e responde três coisas:
 *
 * 1. cada arquivo compila;
 * 2. nenhum deles usa um nome solto — tudo que não é do próprio arquivo
 *    é `P.` (o objeto compartilhado), `CW` (o núcleo) ou um nome do
 *    navegador;
 * 3. todo `P.alguma` que alguém **lê** é escrito por algum dos sete.
 *
 * É estática: roda sem servidor e sem navegador, antes de subir. Para
 * ver o painel funcionando de verdade, com dados da base, existe a
 * bancada: `npm run bancada:painel`.
 *
 *   node scripts/check-painel.js
 */

const fs = require("fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..");
const PASTA = path.join(RAIZ, "extensao/conteudo");

const parser = require(path.join(RAIZ, "node_modules/@babel/parser"));
const traverse = require(path.join(RAIZ, "node_modules/@babel/traverse")).default;

/** Nomes que o navegador dá de graça a um script de conteúdo. */
const DO_NAVEGADOR = new Set([
  "window", "document", "location", "navigator", "console", "chrome",
  "setTimeout", "clearTimeout", "setInterval", "clearInterval",
  "requestAnimationFrame", "cancelAnimationFrame", "queueMicrotask",
  "requestIdleCallback", "cancelIdleCallback",
  "fetch", "URL", "URLSearchParams", "Blob", "FileReader", "FormData",
  "Promise", "Object", "Array", "String", "Number", "Boolean", "Math",
  "JSON", "Date", "RegExp", "Map", "Set", "WeakMap", "WeakSet", "Error",
  "TypeError", "Intl", "Infinity", "NaN", "undefined", "globalThis",
  "parseInt", "parseFloat", "isNaN", "isFinite", "encodeURIComponent",
  "decodeURIComponent", "structuredClone", "MutationObserver",
  "ResizeObserver", "IntersectionObserver", "Element", "Node", "Event",
  "CustomEvent", "KeyboardEvent", "MouseEvent", "DOMParser", "Image",
  "getComputedStyle", "matchMedia", "alert", "atob", "btoa", "crypto",
  "performance", "Intl", "AbortController", "TextEncoder", "TextDecoder",
  "FontFace", "CSS", "HTMLElement", "DocumentFragment", "Range",
  "DataTransfer", "ClipboardEvent",
]);

const arquivos = fs
  .readdirSync(PASTA)
  .filter((nome) => /^painel-.*\.js$/.test(nome))
  .sort();

let falhas = 0;

function reportar(ok, texto, detalhe = "") {
  if (!ok) falhas += 1;
  console.log(
    ok ? `  ok    ${texto}` : `  FALHA ${texto}${detalhe ? `\n        ${detalhe}` : ""}`
  );
}

console.log("\n  O PAINEL, EM SETE ARQUIVOS\n");

if (arquivos.length === 0) {
  console.log("  FALHA nenhum painel-*.js em extensao/conteudo\n");
  process.exit(1);
}

/** O que cada arquivo escreve e lê em `P`. */
const escreve = new Map();
const le = new Map();

let linhasTotais = 0;

for (const nome of arquivos) {
  const fonte = fs.readFileSync(path.join(PASTA, nome), "utf8");
  linhasTotais += fonte.split(/\r?\n/).length;

  let ast;
  try {
    ast = parser.parse(fonte, { sourceType: "script" });
  } catch (erro) {
    reportar(false, `${nome} compila`, String(erro.message));
    continue;
  }

  const soltos = new Set();
  const escritos = new Set();
  const lidos = new Set();

  traverse(ast, {
    Program(caminho) {
      /*
        `globals` do Babel é exatamente o que este arquivo usa sem
        declarar. O que sobra depois de tirar os nomes do navegador é
        nome solto — e nome solto, entre sete arquivos, é `undefined`
        esperando alguém clicar.
      */
      for (const nome of Object.keys(caminho.scope.globals)) {
        if (!DO_NAVEGADOR.has(nome)) soltos.add(nome);
      }
    },

    MemberExpression(caminho) {
      const { object, property, computed } = caminho.node;
      if (object.type !== "Identifier" || object.name !== "P") return;
      if (computed || property.type !== "Identifier") return;

      const escrita =
        caminho.parent.type === "AssignmentExpression" && caminho.parent.left === caminho.node;

      if (escrita) escritos.add(property.name);
      else lidos.add(property.name);
    },
  });

  escreve.set(nome, escritos);
  le.set(nome, lidos);

  reportar(
    soltos.size === 0,
    `${nome.padEnd(22)} compila, ${String(escritos.size).padStart(3)} nomes em P, ${String(lidos.size).padStart(3)} lidos`,
    soltos.size ? `nomes soltos: ${[...soltos].join(", ")}` : ""
  );
}

/* ---------- todo P.x lido é escrito por alguém ---------- */

const todosEscritos = new Set();
for (const conjunto of escreve.values()) for (const nome of conjunto) todosEscritos.add(nome);

/* `pronto` é a marca de "painel de pé" que o último arquivo põe. */
todosEscritos.add("pronto");

const orfaos = [];
for (const [arquivo, lidos] of le) {
  for (const nome of lidos) {
    if (!todosEscritos.has(nome)) orfaos.push(`${arquivo}: P.${nome}`);
  }
}

console.log("");

reportar(
  orfaos.length === 0,
  `${todosEscritos.size} nomes compartilhados, todos com dono`,
  orfaos.join("; ")
);

/* ---------- o manifesto carrega os sete, na ordem ---------- */

const manifesto = JSON.parse(fs.readFileSync(path.join(RAIZ, "extensao/manifest.json"), "utf8"));

const naoCarregados = arquivos.filter(
  (nome) =>
    !manifesto.content_scripts.some((c) => c.js.includes(`conteudo/${nome}`))
);

reportar(
  naoCarregados.length === 0,
  "o manifesto carrega todos os arquivos do painel",
  naoCarregados.join(", ")
);

/*
  A base tem de vir antes: é ela que cria `P`. Sem esta ordem, os outros
  seis saem na primeira linha e o painel não aparece — sem erro nenhum no
  console, que é o pior jeito de descobrir.
*/
const ordemErrada = manifesto.content_scripts
  .filter((c) => c.js.some((j) => j.startsWith("conteudo/painel-")))
  .filter((c) => {
    const doPainel = c.js.filter((j) => j.startsWith("conteudo/painel-"));
    return doPainel[0] !== "conteudo/painel-base.js";
  });

reportar(ordemErrada.length === 0, "painel-base.js vem antes dos outros em todo lugar");

/* O atalho de teclado, declarado e atendido dos dois lados. */
const worker = fs.readFileSync(path.join(RAIZ, "extensao/fundo/service-worker.js"), "utf8");
const base = fs.readFileSync(path.join(PASTA, "painel-base.js"), "utf8");

reportar(
  Boolean(manifesto.commands?.["alternar-painel"]),
  `atalho declarado no manifesto (${manifesto.commands?.["alternar-painel"]?.suggested_key?.default ?? "—"})`
);

reportar(
  /chrome\.commands\.onCommand/.test(worker) && /alternar-painel/.test(worker),
  "o service worker escuta o atalho"
);

reportar(
  /alternarPainel/.test(base) && /onMessage/.test(base),
  "o painel atende a mensagem do atalho"
);

/* ---------- o mesmo defeito, no resto da extensão ---------- */

/*
  O `recarregar()` que não existia estava no painel, mas nada impede que
  o mesmo escorregão apareça no popup, nas opções ou num detector. A
  varredura é a mesma e custa quase nada — então ela cobre a extensão
  inteira, e não só os sete arquivos que a motivaram.
*/
console.log("\n  O resto da extensão\n");

const PASTAS = ["conteudo", "popup", "opcoes", "fundo", "comum"];

for (const pasta of PASTAS) {
  const caminho = path.join(RAIZ, "extensao", pasta);
  if (!fs.existsSync(caminho)) continue;

  for (const nome of fs.readdirSync(caminho).filter((n) => n.endsWith(".js")).sort()) {
    if (/^painel-/.test(nome)) continue;

    const fonte = fs.readFileSync(path.join(caminho, nome), "utf8");

    let ast;
    try {
      ast = parser.parse(fonte, { sourceType: "unambiguous" });
    } catch (erro) {
      reportar(false, `${pasta}/${nome} compila`, String(erro.message));
      continue;
    }

    const soltos = new Set();

    traverse(ast, {
      Program(caminhoDoNo) {
        for (const solto of Object.keys(caminhoDoNo.scope.globals)) {
          if (!DO_NAVEGADOR.has(solto)) soltos.add(solto);
        }
      },
    });

    if (soltos.size > 0) {
      reportar(false, `${pasta}/${nome}`, `nomes soltos: ${[...soltos].join(", ")}`);
    }
  }
}

if (falhas === 0) console.log("  ok    nenhum nome solto em nenhum arquivo");

console.log(
  falhas === 0
    ? `\n  ${arquivos.length} arquivos do painel, ${linhasTotais} linhas, e todos se encontram.\n`
    : `\n  ${falhas} problema(s).\n`
);

process.exit(falhas === 0 ? 0 : 1);
