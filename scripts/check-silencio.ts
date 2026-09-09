/**
 * Alguma falha some sem a tela dizer nada?
 *
 *   npm run check:silencio
 *
 * **A falha que se repetiu quatro vezes em duas semanas.** "Os dados
 * não carregam" chegou quatro vezes, sempre com a mesma cara — zero em
 * todos os contadores, quadro em branco, nenhuma palavra — e cada vez
 * por uma causa diferente: código velho no ar, `vercel.json` inválido,
 * rota não publicada, e por fim uma leitura que não voltou.
 *
 * O que fazia as quatro parecerem uma só é que **a aplicação não sabia
 * dizer a diferença entre "não há nada" e "não consegui ler"**. O
 * caminho de leitura tinha oito saídas mudas, todas devolvendo vazio. E
 * o contexto até guardava o motivo numa variável — `syncError` —, mas
 * nenhum componente a lia. O erro era registrado e não tinha para onde
 * ir.
 *
 * Esta conferência procura as duas formas do mesmo defeito:
 *
 *  1. **Erro que ninguém lê.** Um estado de erro é gravado e o valor
 *     nunca aparece em lugar nenhum da interface.
 *  2. **Falha que vira vazio.** Uma leitura devolve lista vazia num
 *     caminho de recusa, sem dizer o motivo junto.
 *
 * As duas são invisíveis para o `tsc` e para o lint: não gravar um erro
 * na tela é sintaticamente perfeito.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const RAIZ = resolve(__dirname, "..");

let falhas = 0;

function ok(titulo: string, detalhe = "") {
  console.log(
    `  ok     ${titulo}${detalhe ? `\n         ${detalhe}` : ""}`
  );
}

function falhar(titulo: string, detalhe: string) {
  falhas += 1;
  console.log(`FALHA    ${titulo}\n         ${detalhe}`);
}

function arquivos(dir: string, ext = /\.tsx?$/): string[] {
  const saida: string[] = [];

  for (const nome of readdirSync(dir)) {
    if (nome === "node_modules" || nome === ".next") continue;

    const caminho = join(dir, nome);

    if (statSync(caminho).isDirectory()) {
      saida.push(...arquivos(caminho, ext));
      continue;
    }

    if (ext.test(nome)) saida.push(caminho);
  }

  return saida;
}

/* ============================================================
   1. ERRO GRAVADO QUE NINGUÉM LÊ
============================================================ */

/**
 * Um estado cujo nome diz que ele guarda uma falha.
 *
 * `setSyncError`, `setErro`, `setFalha`, `setMensagemDeErro`. O nome é
 * o sinal, e é um sinal bom: ninguém chama de "erro" um estado que não
 * guarda erro.
 */
const PARECE_ERRO =
  /const \[(\w*(?:[eE]rro|[eE]rror|[fF]alha)\w*), set\w+\] = useState/g;

function erroSemLeitor() {
  console.log(
    "\n  ERRO GRAVADO — alguém mostra na tela?\n"
  );

  const contextos = arquivos(
    resolve(RAIZ, "lib/context"),
    /\.tsx$/
  );

  /* Onde a interface é montada. */
  const interfaces = [
    ...arquivos(resolve(RAIZ, "components"), /\.tsx$/),
    ...arquivos(resolve(RAIZ, "app"), /\.tsx$/),
    ...contextos,
  ].map((caminho) => ({
    caminho,
    fonte: readFileSync(caminho, "utf8"),
  }));

  const orfaos: string[] = [];
  let conferidos = 0;

  for (const caminho of contextos) {
    const fonte = readFileSync(caminho, "utf8");

    for (const achado of fonte.matchAll(PARECE_ERRO)) {
      const nome = achado[1];

      conferidos += 1;

      /**
       * "Aparecer na interface" é aparecer dentro de JSX.
       *
       * Estar no objeto do contexto não conta — `syncError` estava
       * lá, exposto e tipado, e mesmo assim nenhuma tela o desenhava.
       * Ser exportado não é ser mostrado.
       */
      /*
        Um nível de apelido conta.

        O estado pode não ir cru para o JSX: `falhaDeLeitura` passa por
        `const aviso = ...`, que é quem decide se a faixa aparece.
        Exigir o nome original dentro da marcação reprovaria justamente
        a versão correta — e empurraria de volta para a errada.
      */
      const apelidos = [
        nome,
        ...[
          ...fonte.matchAll(
            new RegExp(
              `const (\\w+)\\s*=[^;]*\\b${nome}\\b[^;]*;`,
              "g"
            )
          ),
        ].map((m) => m[1]),
      ];

      const mostrado = interfaces.some(({ fonte: outro }) =>
        apelidos.some((alvo) =>
          new RegExp(
            `\\{[^}]*\\b${alvo}\\b[^}]*\\}\\s*(?:&&|\\?|<|\\})|<[A-Z]\\w*[^>]*\\b\\w+=\\{${alvo}\\}`
          ).test(outro)
        )
      );

      if (!mostrado) {
        orfaos.push(
          `${relative(RAIZ, caminho)} grava "${nome}" e nenhuma tela o mostra`
        );
      }
    }
  }

  if (orfaos.length === 0) {
    ok(
      "todo estado de erro chega à tela",
      `${conferidos} conferido(s)`
    );
  } else {
    falhar(
      "todo estado de erro chega à tela",
      [
        ...orfaos,
        "",
        "         Erro que ninguém lê é pior que erro nenhum: a tela fica",
        "         vazia com ar de normalidade, e quem olha tira conclusão",
        "         de números que não existem.",
      ].join("\n         ")
    );
  }
}

/* ============================================================
   2. FALHA QUE VIRA VAZIO
============================================================ */

/**
 * As leituras que alimentam tela.
 *
 * Lista curta e escrita à mão de propósito: são os caminhos por onde a
 * operação inteira entra na aplicação. Uma leitura nova que alimente
 * tela entra aqui — e a conferência abaixo passa a cobri-la.
 */
const LEITURAS: {
  arquivo: string;
  funcao: string;
  /** O que ela precisa dizer quando não consegue ler. */
  marca: string;
}[] = [
  {
    arquivo: "lib/actions/cases.ts",
    funcao: "listCases",
    marca: "falhou(",
  },
  {
    arquivo: "lib/actions/workspace.ts",
    funcao: "loadWorkspace",
    marca: "indisponivel",
  },
];

/** O corpo de uma função exportada, do cabeçalho até a chave que fecha. */
function corpoDe(fonte: string, funcao: string) {
  const inicio = fonte.indexOf(
    `export async function ${funcao}`
  );

  if (inicio < 0) return "";

  let nivel = 0;
  let comecou = false;

  for (let i = inicio; i < fonte.length; i += 1) {
    if (fonte[i] === "{") {
      nivel += 1;
      comecou = true;
    }

    if (fonte[i] === "}") {
      nivel -= 1;
      if (comecou && nivel === 0) {
        return fonte.slice(inicio, i + 1);
      }
    }
  }

  return fonte.slice(inicio);
}

function falhaQueViraVazio() {
  console.log(
    "\n  LEITURA — falha e vazio são distinguíveis?\n"
  );

  for (const { arquivo, funcao, marca } of LEITURAS) {
    const fonte = readFileSync(
      resolve(RAIZ, arquivo),
      "utf8"
    );

    const corpo = corpoDe(fonte, funcao);

    if (!corpo) {
      falhar(
        `${funcao} existe em ${arquivo}`,
        "não achei a função — a lista desta conferência está desatualizada"
      );
      continue;
    }

    /**
     * Saída muda: devolve vazio sem dizer por quê.
     *
     * `return []`, `?? []` e `return VAZIO` sozinhos. O que os salva é
     * a marca do motivo aparecer na mesma função.
     */
    const saidasMudas = [
      /return \[\];/g,
      /\?\?\s*\[\]/g,
      /return VAZIO;/g,
    ].reduce(
      (soma, padrao) =>
        soma + (corpo.match(padrao)?.length ?? 0),
      0
    );

    const diz = corpo.includes(marca);

    if (saidasMudas === 0 && diz) {
      ok(
        `${funcao} diz por que não trouxe nada`,
        `nenhuma saída muda; usa "${marca}"`
      );
    } else if (!diz) {
      falhar(
        `${funcao} diz por que não trouxe nada`,
        `não achei "${marca}" na função — falha e cadastro vazio voltam iguais para a tela`
      );
    } else {
      falhar(
        `${funcao} diz por que não trouxe nada`,
        `${saidasMudas} saída(s) devolvem vazio sem motivo junto`
      );
    }
  }
}

/* ============================================================
   3. O AVISO EXISTE MESMO
============================================================ */

function oAvisoExiste() {
  console.log(
    "\n  AVISO — a faixa que conta o que houve\n"
  );

  const contexto = readFileSync(
    resolve(RAIZ, "lib/context/CaseContext.tsx"),
    "utf8"
  );

  const pontos: [string, boolean, string][] = [
    [
      "o provider desenha o aviso",
      /\{aviso && <AvisoDeLeitura/.test(contexto),
      "sem isto, cada tela teria de lembrar de mostrar — e a que esquecer volta a mentir",
    ],
    [
      "o aviso tem papel de alerta",
      /role="alert"/.test(contexto),
      "leitor de tela precisa anunciar; a faixa não é decoração",
    ],
    [
      "e oferece recarregar",
      /Recarregar/.test(contexto),
      "dizer que falhou sem dar o que fazer é metade do trabalho",
    ],
    [
      "a hora da carga chega à tela",
      /carregadoEm/.test(contexto),
      'sem ela ninguém responde "isto que estou vendo é de agora?"',
    ],

    /*
      As três regras que impedem o aviso de virar ruído.

      A primeira versão da faixa apareceu na tela de **login**, por cima
      do formulário de entrar, anunciando "sua sessão expirou" — ali não
      existe sessão por definição, e nada tinha falhado.

      Isso não é um detalhe estético: aviso que aparece quando não devia
      ensina quem trabalha a ignorá-lo, e aí ele deixa de servir
      justamente na vez em que importa. Um alarme que toca sozinho é
      pior do que alarme nenhum, porque dá a impressão de que existe
      vigilância.
    */
    [
      "o aviso não aparece onde não há sessão por definição",
      /naAutenticacao/.test(contexto) &&
        /login\|cadastro/.test(contexto),
      "sem esta porta, a faixa volta a acusar expiração em /login e /cadastro",
    ],
    [
      "falha de leitura só avisa se a tela ficou sem dados",
      /cases\.length === 0/.test(contexto),
      "recarga falhada com os dados anteriores ainda na tela não muda o que se está olhando — alarmar ali é ruído",
    ],
    [
      "falha de gravação avisa sempre",
      /syncError \?\?/.test(contexto),
      "é sobre algo que a pessoa acabou de fazer: o que ela escreveu não foi salvo, e a tela cheia não muda isso",
    ],
  ];

  for (const [titulo, passou, detalhe] of pontos) {
    if (passou) ok(titulo);
    else falhar(titulo, detalhe);
  }
}

/* ============================================================
   PRINCIPAL
============================================================ */

console.log(
  "\n  SILÊNCIO — nenhuma falha passa sem ser dita\n"
);

erroSemLeitor();
falhaQueViraVazio();
oAvisoExiste();

console.log(
  falhas === 0
    ? "\n  Nenhuma falha vira tela vazia em silêncio.\n"
    : `\n  ${falhas} ponto(s) onde uma falha ainda passaria calada.\n`
);

process.exitCode = falhas === 0 ? 0 : 1;
