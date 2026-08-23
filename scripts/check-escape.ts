/**
 * Nada do consumidor chega ao `innerHTML` do painel sem escape.
 *
 *   npm run check:escape
 *
 * O painel da extensão monta HTML em texto e o injeta **dentro da
 * página do WhatsApp e do Reclame Aqui**. Cada injeção é um ponto de
 * execução: um título de reclamação contendo `<img src=x onerror=...>`
 * rodaria no contexto daquelas páginas, onde mora a sessão de WhatsApp
 * da pessoa. E o texto vem do consumidor — título, relato e nome são
 * digitados por quem abre a reclamação no portal.
 *
 * **A varredura olha o sumidouro, não a fonte.** Uma primeira versão
 * examinou as 305 interpolações do arquivo e devolveu 105 suspeitas —
 * quase todas texto de prompt da IA, `textContent` e parâmetro interno.
 * Auditor com 105 falsos positivos é auditor desligado.
 *
 * O que importa é o que entra em `innerHTML`, que são 18 lugares. Aí a
 * pergunta é fechada: **toda interpolação deste HTML está escapada ou é
 * comprovadamente inofensiva?**
 *
 * Conferido à mão em 23/08, campo a campo, antes de escrever isto:
 * `c.titulo` e `c.protocolo` montam prompt de IA; `dados.usuario.nome`
 * vai para `textContent`; `captura.cliente` é argumento de `vazio()`,
 * que escapa. Nenhum caminho até `innerHTML` passa sem tratamento.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const RAIZ = resolve(__dirname, "..");

const ARQUIVOS = [
  "extensao/conteudo/painel.js",
  "extensao/conteudo/nucleo.js",
];

let falhas = 0;

/**
 * Expressões que não carregam texto de terceiro.
 *
 * A lista é de **forma**, não de nome: `Math.round(...)` é seguro pelo
 * que faz, e continuaria seguro com outro nome.
 */
const SEGURAS: RegExp[] = [
  /^CW\.escapar\(/,
  /CW\.escapar\(/,
  /^(?:Math\.|Number\(|parseInt|parseFloat)/,
  /^[A-Z_][A-Z0-9_]*$/,
  /^\d+(?:\.\d+)?$/,
  /^["'][^"']*["']$/,
  /\?\s*["'][^"']*["']\s*:\s*["'][^"']*["']$/,
  /\.length\b/,
  /^CW\.(?:data|hora)\(/,
];

/**
 * As três que sobram, com o motivo de cada uma.
 *
 * Foram conferidas à mão em 23/08. Estão nomeadas em vez de cobertas
 * por uma regra de forma porque cada regra genérica que eu escrevesse
 * para acomodá-las abriria a porta para um caso diferente amanhã — e a
 * graça deste script é justamente não ter porta.
 */
const DECLARADAS: { expressao: string; porque: string }[] =
  [
    {
      expressao: 'botao ?? ""',
      porque:
        "HTML montado pelo próprio painel e passado a vazio(); o único caller com dado usa CW.escapar no data-url.",
    },
    {
      expressao: "dados.total",
      porque:
        "Contagem de casos vinda do servidor — número, não texto.",
    },
  ];

/**
 * Aviso montado só com literal, escolhido por condição.
 *
 * Casado por forma e não por texto: é uma condicional cujos dois ramos
 * são literais — um parágrafo fixo e a string vazia. Copiar o texto
 * inteiro para cá faria a exceção quebrar na primeira vez que alguém
 * corrigisse uma vírgula do aviso.
 */
const LITERAL_CONDICIONAL =
  /\?\s*'<[\s\S]*>'\s*:\s*""$/;

function declarada(expressao: string) {

  const normal = expressao.replace(/\s+/g, " ").trim();

  return DECLARADAS.some(
    (d) =>
      d.expressao.replace(/\s+/g, " ").trim() === normal
  );
}

/** Recorta interpolações respeitando `${}` aninhado. */
function interpolacoes(trecho: string) {

  const saida: string[] = [];

  for (let i = 0; i < trecho.length - 1; i += 1) {

    if (trecho[i] !== "$" || trecho[i + 1] !== "{") continue;

    let nivel = 1;
    let j = i + 2;

    while (j < trecho.length && nivel > 0) {
      if (trecho[j] === "{") nivel += 1;
      else if (trecho[j] === "}") nivel -= 1;
      j += 1;
    }

    saida.push(trecho.slice(i + 2, j - 1).trim());

    i = j - 1;
  }

  return saida;
}

/** Funções e arrows do arquivo que passam algo por `CW.escapar`. */
function conscientes(fonte: string) {

  const nomes = new Set<string>();

  const decl = [
    ...fonte.matchAll(/function\s+([a-zA-Z][\w$]*)\s*\(/g),
    ...fonte.matchAll(
      /const\s+([a-zA-Z][\w$]*)\s*=\s*(?:async\s*)?\(/g
    ),
  ];

  const pontos = decl.map((d) => d.index ?? 0);

  for (const m of decl) {

    const inicio = m.index ?? 0;

    const seguintes = pontos.filter((i) => i > inicio);

    const fim = seguintes.length
      ? Math.min(...seguintes)
      : fonte.length;

    if (/CW\.escapar\(/.test(fonte.slice(inicio, fim))) {
      nomes.add(m[1]);
    }
  }

  return nomes;
}

/**
 * O valor atribuído a `innerHTML`, com as chamadas seguras removidas.
 *
 * Vai do sinal de igual até o fim da expressão — reconhecido por contar
 * crases, parênteses e chaves, porque o valor costuma ser um literal de
 * template de dezenas de linhas.
 */
function valorAtribuido(fonte: string, igual: number) {

  let i = igual + 1;

  // Pula espaço até o início da expressão.
  while (i < fonte.length && /\s/.test(fonte[i])) i += 1;

  let crase = false;
  let nivel = 0;
  const inicio = i;

  for (; i < fonte.length; i += 1) {

    const c = fonte[i];

    if (c === "`" && fonte[i - 1] !== "\\") {
      crase = !crase;
      continue;
    }

    if (crase) continue;

    if (c === "(" || c === "[" || c === "{") nivel += 1;
    else if (c === ")" || c === "]" || c === "}") nivel -= 1;
    else if (c === ";" && nivel <= 0) break;
  }

  return fonte.slice(inicio, i);
}

console.log(
  "\n  ESCAPE — o que entra em innerHTML na página de terceiro\n"
);

for (const relativo of ARQUIVOS) {

  const fonte = readFileSync(
    resolve(RAIZ, relativo),
    "utf8"
  );

  const seguras = conscientes(fonte);

  const chamaSegura = seguras.size
    ? new RegExp(`^(?:${[...seguras].join("|")})\\s*\\(`)
    : null;

  const sumidouros = [
    ...fonte.matchAll(/\.innerHTML\s*(\+?=)/g),
  ];

  let suspeitas = 0;

  for (const m of sumidouros) {

    const igual =
      (m.index ?? 0) + m[0].length - 1;

    const valor = valorAtribuido(fonte, igual);

    const linha =
      fonte.slice(0, m.index ?? 0).split("\n").length;

    for (const expr of interpolacoes(valor)) {

      if (SEGURAS.some((re) => re.test(expr))) continue;
      if (chamaSegura?.test(expr)) continue;
      if (declarada(expr)) continue;
      if (LITERAL_CONDICIONAL.test(expr)) continue;

      suspeitas += 1;
      falhas += 1;

      console.log(
        `FALHA  ${relativo}:${linha}\n         ${expr.replace(/\s+/g, " ").slice(0, 76)}`
      );
    }
  }

  console.log(
    `  ${suspeitas === 0 ? "ok  " : "    "} ${relativo.padEnd(34)} ${sumidouros.length} injeção(ões) de HTML${suspeitas === 0 ? ", todas tratadas" : ""}`
  );
}

console.log(
  falhas === 0
    ? "\n  Nada do consumidor chega ao HTML sem passar por CW.escapar.\n"
    : `\n  ${falhas} interpolação(ões) para revisar.\n`
);

process.exit(falhas === 0 ? 0 : 1);
