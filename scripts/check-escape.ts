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
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const RAIZ = resolve(__dirname, "..");

/**
 * Todos os scripts da extensão que montam HTML — e não só dois.
 *
 * A primeira versão olhava `painel.js` e `nucleo.js`. Ficavam de fora o
 * atalho de respostas (`respostas.js`, que monta HTML com título e
 * corpo das macros), os detectores de cada site, o popup e as opções.
 * Arquivo novo que monte HTML entra sozinho: a lista é lida da pasta.
 */
const ARQUIVOS = [
  ...readdirSync(resolve(RAIZ, "extensao/conteudo"))
    .filter((nome) => nome.endsWith(".js"))
    .map((nome) => `extensao/conteudo/${nome}`),
  "extensao/popup/popup.js",
  "extensao/opcoes/opcoes.js",
];

/**
 * Campo que carrega texto de terceiro.
 *
 * **O buraco que isto fecha.** A varredura original olhava só o valor
 * atribuído **diretamente** ao `innerHTML`. Mas o painel monta quase
 * todo o HTML em funções auxiliares — `desenharCaso`, `blocoDossie` —
 * que devolvem texto, junta num array e faz
 * `corpo.innerHTML = partes.join("")`, que não tem `${}` nenhum para
 * conferir. A maior parte do HTML da extensão nunca era olhada.
 *
 * Conferir **toda** interpolação de todo HTML devolveu cem suspeitas,
 * quase todas número e constante interna — o mesmo excesso que fez a
 * primeira versão desta varredura mirar só o sumidouro. A pergunta com
 * sinal alto é mais estreita: um campo com **nome de texto** — título,
 * nome, relato, e-mail — entrou num HTML sem escape? É o erro que se
 * comete de verdade, e no código de 10/09/2026 ela não dá nenhum
 * alarme falso.
 */
/*
  Só campo de objeto (`x.titulo`), e não variável solta (`titulo`).

  Medido em 10/09/2026: incluir variável solta deu 26 alarmes, todos
  falsos — o objeto `cliente` casava em `cliente.total`, e os nomes de
  segmento e de rótulo dos formulários são literais. O preço conhecido
  é que `const titulo = caso.titulo` seguido de `${titulo}` passa sem
  ser visto: texto de terceiro em variável solta precisa passar por
  `CW.escapar` na hora de copiar, e isso fica por conta de quem revisa.
*/
const CAMPO_DE_TEXTO =
  /\.(titulo|nome|texto|relato|cliente|email|telefone|descricao|mensagem|resposta|erro|aviso|categoria|subcategoria|etiqueta|responsavel|estabelecimento|cidade|comentario|motivo|dica|url|rotulo)\b(?!\s*\()/i;

/** Todo literal de template, respeitando comentário, string e `${}` aninhado. */
function templates(fonte: string) {
  const saida: { texto: string; linha: number }[] = [];

  let i = 0;

  while (i < fonte.length) {
    const c = fonte[i];

    if (c === "/" && fonte[i + 1] === "/") {
      i = fonte.indexOf("\n", i);
      if (i < 0) break;
      continue;
    }

    if (c === "/" && fonte[i + 1] === "*") {
      i = fonte.indexOf("*/", i + 2) + 2;
      continue;
    }

    if (c === '"' || c === "'") {
      i += 1;
      while (i < fonte.length && fonte[i] !== c) {
        if (fonte[i] === "\\") i += 1;
        i += 1;
      }
      i += 1;
      continue;
    }

    /*
      Expressão regular literal, que pode ter aspas dentro.

      Sem isto, o `.replace(/"/g, "&quot;")` da função de escape do
      popup abria uma "string" na aspa da expressão, e o leitor se
      perdia pelo resto do arquivo — contava zero HTML num arquivo com
      sete injeções. A barra é expressão quando vem depois de um
      operador ou de abertura; depois de um valor, é divisão.
    */
    if (c === "/") {
      let k = i - 1;
      while (k >= 0 && /\s/.test(fonte[k])) k -= 1;

      if (k < 0 || /[(,=:[!&|?{};+\-*%<>~^]/.test(fonte[k])) {
        i += 1;
        let classe = false;
        while (i < fonte.length) {
          if (fonte[i] === "\\") {
            i += 2;
            continue;
          }
          if (fonte[i] === "[") classe = true;
          else if (fonte[i] === "]") classe = false;
          else if (fonte[i] === "/" && !classe) break;
          else if (fonte[i] === "\n") break;
          i += 1;
        }
        i += 1;
        continue;
      }
    }

    if (c === "`") {
      const inicio = i;
      let nivel = 0;
      i += 1;

      while (i < fonte.length) {
        if (fonte[i] === "\\") {
          i += 2;
          continue;
        }
        if (nivel === 0 && fonte[i] === "`") break;
        if (fonte[i] === "$" && fonte[i + 1] === "{") {
          nivel += 1;
          i += 2;
          continue;
        }
        if (nivel > 0 && fonte[i] === "{") nivel += 1;
        if (nivel > 0 && fonte[i] === "}") nivel -= 1;
        i += 1;
      }

      saida.push({
        texto: fonte.slice(inicio + 1, i),
        linha: fonte.slice(0, inicio).split("\n").length,
      });

      i += 1;
      continue;
    }

    i += 1;
  }

  return saida;
}

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
  /* O popup tem a sua própria, com o mesmo nome e fora do `CW`. */
  /^escapar\(/,
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

/**
 * A interpolação é segura?
 *
 * **HTML aninhado é examinado por dentro, e antes de tudo.** O padrão
 * `lista.map((x) => `<li>${...}</li>`).join("")` é o jeito comum de
 * montar lista, e a regra de forma `/CW\.escapar\(/` casava com a
 * expressão **inteira** assim que um único campo lá dentro estivesse
 * escapado — um `.map` com o título escapado e o nome cru passava. Aqui
 * cada interpolação do HTML de dentro responde por si, e o que sobra do
 * lado de fora não pode carregar campo de texto.
 */
function segura(
  expr: string,
  chamaSegura: RegExp | null,
  /**
   * Dentro de HTML aninhado, só campo de texto precisa de escape.
   *
   * Exigir forma segura de toda interpolação interna — `${item.tom}`,
   * `${i + 1}` — traria de volta as cem suspeitas que esta varredura
   * existe para não ter.
   */
  soTexto = false
): boolean {

  if (soTexto && !CAMPO_DE_TEXTO.test(expr)) return true;

  if (expr.includes("`")) {

    const internos = templates(expr);

    let fora = expr;
    for (const t of internos) fora = fora.replace(t.texto, "");

    /*
      O que sobra do lado de fora e **vai para a tela**.

      Campo usado só como teste não aparece: em
      `caso.responsavel ? ` · ${CW.escapar(caso.responsavel)}` : ""` o
      campo cru decide, e o que sai está escapado. Por isso a condição
      de um ternário e o lado esquerdo de um `&&` saem da conta — mas só
      quando são feitos de nome e ponto, para `x.titulo + (a ? … : …)`
      não perder o `x.titulo`, que é saída.
    */
    const saidas = fora
      .replace(/(?:CW\.)?escapar\((?:[^()]|\([^()]*\))*\)/g, "")
      .replace(/\?\./g, ".")
      .replace(/\?\?/g, " OU ")
      .replace(/^\s*!?[\w.[\]\s]*\?/, "")
      .replace(/!?[\w.[\]]+\s*&&/g, "");

    if (CAMPO_DE_TEXTO.test(saidas)) return false;

    return internos.every((t) =>
      interpolacoes(t.texto).every((dentro) =>
        segura(dentro, chamaSegura, true)
      )
    );
  }

  return (
    SEGURAS.some((re) => re.test(expr)) ||
    Boolean(chamaSegura?.test(expr)) ||
    declarada(expr) ||
    LITERAL_CONDICIONAL.test(expr)
  );
}

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

      if (segura(expr, chamaSegura)) continue;

      suspeitas += 1;
      falhas += 1;

      console.log(
        `FALHA  ${relativo}:${linha}\n         ${expr.replace(/\s+/g, " ").slice(0, 76)}`
      );
    }
  }

  /*
    Segunda passada: todo HTML montado no arquivo, onde quer que ele
    vá parar — não só o que é atribuído ali mesmo ao innerHTML.
  */
  let htmlMontado = 0;

  for (const t of templates(fonte)) {

    if (!/<[a-z][\w-]*[\s>/]/i.test(t.texto)) continue;

    htmlMontado += 1;

    for (const expr of interpolacoes(t.texto)) {

      if (!CAMPO_DE_TEXTO.test(expr)) continue;

      if (segura(expr, chamaSegura)) continue;

      suspeitas += 1;
      falhas += 1;

      console.log(
        `FALHA  ${relativo}:${t.linha}\n         texto de terceiro sem escape: ${expr.replace(/\s+/g, " ").slice(0, 60)}`
      );
    }
  }

  console.log(
    `  ${suspeitas === 0 ? "ok  " : "    "} ${relativo.padEnd(34)} ${sumidouros.length} injeção(ões), ${htmlMontado} HTML montado(s)${suspeitas === 0 ? ", tudo tratado" : ""}`
  );
}

console.log(
  falhas === 0
    ? "\n  Nada do consumidor chega ao HTML sem passar por CW.escapar.\n"
    : `\n  ${falhas} interpolação(ões) para revisar.\n`
);

process.exit(falhas === 0 ? 0 : 1);
