/**
 * Audita a plataforma inteira: o que a tela cria, cria mesmo?
 *
 *   npm run check:persistencia
 *
 * Existe por causa de um defeito que já aconteceu três vezes neste
 * projeto — Times, Metas e Clientes aplicavam a mudança na tela e não
 * gravavam nada. Sem erro, sem aviso: o cadastro sumia no recarregamento
 * seguinte. `tsc` e `lint` passam limpos, porque **não gravar é
 * sintaticamente perfeito**.
 *
 * O contrato desta base é único e explícito: **todo mutador exposto por
 * um contexto passa por `sincronizar`**, que chama a server action e
 * avisa na tela quando falha. Um mutador que só faz `setState` é, por
 * definição, uma alteração que não sai do navegador.
 *
 * **Só o que o contexto expõe é auditado.** O objeto de `value` é o
 * contrato com as telas; `setState` chamado dentro de um mutador é
 * mecânica interna, e cobrá-lo produziria uma lista de falsos alarmes
 * que ninguém lê — foi o que a primeira versão deste script fez.
 *
 * Contexto cujo objeto de valor não for encontrado é **reportado**, não
 * ignorado: um auditor que passa em silêncio quando não entende o
 * arquivo é pior do que auditor nenhum.
 */
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const RAIZ = resolve(__dirname, "..");

/* ============================================================
   O QUE NÃO PRECISA GRAVAR, E POR QUÊ
============================================================ */

const EXCECOES: {
  contexto: string;
  funcao: string;
  motivo: string;
}[] = [
  {
    contexto: "CaseContext",
    funcao: "setFilters",
    motivo:
      "Filtro é recorte de tela. Gravar faria a lista abrir filtrada para outra pessoa.",
  },
  {
    contexto: "CaseContext",
    funcao: "recarregar",
    motivo: "Relê do servidor; não altera nada.",
  },
  {
    contexto: "NpsContext",
    funcao: "recarregar",
    motivo: "Relê do servidor; não altera nada.",
  },
  {
    contexto: "NpsContext",
    funcao: "aplicarLocal",
    motivo:
      "Reflete na tela o que a gaveta acabou de gravar pela própria action. Gravar de novo aqui seria a segunda escrita da mesma mudança.",
  },
  {
    contexto: "CaseContext",
    funcao: "setCases",
    motivo:
      "É o dispatcher do React, exposto para a importação em lote trocar a lista inteira depois de o servidor já ter gravado. Quem grava é importCasesBulk, pela action.",
  },
  {
    contexto: "SettingsContext",
    funcao: "*",
    motivo:
      "Preferências de exibição da sessão, sem contrapartida no banco.",
  },
  {
    contexto: "GoogleEventsContext",
    funcao: "*",
    motivo:
      "Espelha a agenda do Google; quem grava é o Google, pela API dele.",
  },
  {
    contexto: "ToastContext",
    funcao: "*",
    motivo: "Avisos de tela, que morrem com a aba.",
  },
  {
    contexto: "SessionContext",
    funcao: "*",
    motivo:
      "Só expõe a sessão que o layout resolveu no servidor.",
  },
];

function temExcecao(contexto: string, funcao: string) {
  return EXCECOES.some(
    (e) =>
      e.contexto === contexto &&
      (e.funcao === "*" || e.funcao === funcao)
  );
}

/* ============================================================
   EXTRAÇÃO DO CONTRATO
============================================================ */

/**
 * O objeto que o contexto entrega às telas.
 *
 * Procura o `useMemo` do valor e devolve o literal de objeto que ele
 * retorna. É o recorte exato do que é auditável: tudo que está aqui
 * dentro alguma tela pode chamar.
 */
function objetoDeValor(fonte: string): string | null {

  /**
   * Duas formas de entregar o contrato, e as duas existem aqui.
   *
   * A comum é `const value = useMemo(() => ({ ... }))` — com ou sem
   * anotação de tipo, que aparece como `useMemo<MacrosContextType>`.
   * Uma versão anterior desta expressão exigia dois sinais de igual: não
   * casava com nenhum arquivo, e o script passava dizendo que estava
   * tudo bem.
   *
   * A outra é o objeto literal direto no `Provider value={{ ... }}`,
   * que o `WorkflowContext` usa. Sem ela, o contexto que governa as
   * etapas do quadro ficava fora da auditoria.
   */
  const porMemo = fonte.search(
    /const\s+value(?:\s*:[^=]+)?\s*=\s*useMemo/
  );

  const abre =
    porMemo !== -1
      ? fonte.indexOf("({", porMemo)
      : fonte.search(/Provider\s+value=\{\{/) !== -1
        ? /*
            Sem `+ 1`, e isso importa: o laço abaixo começa em
            `abre + 1` e conta a chave que `abre` aponta como abertura.
            Apontar para a segunda chave de `{{` fazia o laço começar
            já dentro do objeto, achar o primeiro `}` com nível zero e
            devolver nulo — o `WorkflowContext` ficava fora da
            auditoria dizendo "não reconheci o arquivo".
          */
          fonte.indexOf(
            "{{",
            fonte.search(/Provider\s+value=\{\{/)
          )
        : -1;

  if (abre === -1) return null;

  let nivel = 0;

  for (let i = abre + 1; i < fonte.length; i += 1) {
    if (fonte[i] === "{") nivel += 1;
    else if (fonte[i] === "}") {
      nivel -= 1;
      if (nivel === 0) {
        return fonte.slice(abre + 1, i + 1);
      }
    }
  }

  return null;
}

/**
 * O corpo de uma função declarada no arquivo, pelo nome.
 *
 * Existe porque metade dos contextos entrega o contrato por **referência
 * curta** — `{ createCase, updateCase, deleteCase }` — em vez de definir
 * a função ali dentro. Sem resolver a definição, a auditoria dizia
 * "nenhum mutador exposto" justamente para o `CaseContext`, que é o
 * contexto mais importante da aplicação.
 *
 * Cobre as três formas usadas aqui: `const x = useCallback`,
 * `const x = (` e `function x(`.
 */
function definicao(
  fonte: string,
  nome: string
): string | null {

  /** Nome de identificador é seguro, mas escapar custa uma linha. */
  const escapado = nome.replace(
    /[^A-Za-z0-9_]/g,
    ""
  );

  if (!escapado) return null;

  const padrao = new RegExp(
    `(?:const\\s+${escapado}\\s*=|(?:async\\s+)?function\\s+${escapado}\\s*\\()`
  );

  const i = fonte.search(padrao);

  if (i === -1) return null;

  /**
   * Do ponto da definição até o fim do arquivo.
   *
   * Delimitar o corpo exigiria contar chaves com todas as formas de
   * corpo conciso; aqui o que importa é **se aquele nome grava**, e um
   * recorte generoso responde isso sem errar para menos. O risco de
   * errar para mais é baixo: o nome só aparece uma vez.
   */
  const ate = fonte.indexOf(
    "\n  const ",
    fonte.indexOf("\n", i + 1)
  );

  return fonte.slice(i, ate === -1 ? fonte.length : ate);
}

/** Chaves de primeiro nível do literal, com o valor de cada uma. */
function entradas(objeto: string) {

  const saida: { chave: string; valor: string }[] = [];

  let nivel = 0;
  let inicio = 1;

  const fecha: Record<string, string> = {
    "{": "}",
    "[": "]",
    "(": ")",
  };

  const pilha: string[] = [];

  let emTexto: string | null = null;

  for (let i = 1; i < objeto.length; i += 1) {

    const c = objeto[i];
    const anterior = objeto[i - 1];

    if (emTexto) {
      if (c === emTexto && anterior !== "\\") emTexto = null;
      continue;
    }

    if (c === '"' || c === "'" || c === "`") {
      emTexto = c;
      continue;
    }

    if (fecha[c]) {
      pilha.push(fecha[c]);
      nivel += 1;
      continue;
    }

    if (c === pilha[pilha.length - 1]) {
      pilha.pop();
      nivel -= 1;
      continue;
    }

    if (c === "," && nivel === 0) {
      saida.push(fatiar(objeto.slice(inicio, i)));
      inicio = i + 1;
    }
  }

  saida.push(fatiar(objeto.slice(inicio)));

  return saida.filter((e) => e.chave !== "");
}

function fatiar(trecho: string) {

  const limpo = trecho
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .trim();

  /**
   * Três formas de chave: `nome:`, `nome(` e a referência curta
   * `nome` sozinha. A terceira é a que faltava.
   */
  const comValor = limpo.match(
    /^(?:async\s+)?([a-zA-Z][a-zA-Z0-9_]*)\s*(?::|\()/
  );

  if (comValor) {
    return { chave: comValor[1], valor: limpo };
  }

  const curta = limpo.match(
    /^([a-zA-Z][a-zA-Z0-9_]*)\s*$/
  );

  // Valor vazio: quem chamar resolve a definição no arquivo.
  return curta
    ? { chave: curta[1], valor: "" }
    : { chave: "", valor: limpo };
}

/**
 * Nomes que denunciam alteração.
 *
 * Prefixo e não lista fechada: um cadastro novo entra com `saveX` ou
 * `removeX` e passa a ser auditado sem ninguém lembrar de vir aqui.
 */
const PREFIXOS = [
  "create", "update", "save", "remove", "delete", "add",
  "set", "toggle", "move", "enrich", "assign", "unassign",
  "reset", "apply", "register", "link", "unlink",
  "criar", "salvar", "remover", "alterar", "adicionar",
  "mover", "excluir", "atualizar", "vincular", "definir",
  "aplicar",
];

function pareceMutador(nome: string) {
  return PREFIXOS.some(
    (p) =>
      nome.startsWith(p) &&
      nome.length > p.length &&
      nome[p.length] === nome[p.length].toUpperCase()
  );
}

/* ============================================================
   PROGRAMA
============================================================ */

console.log(
  "\n  PERSISTÊNCIA — o que a tela altera chega ao banco?\n"
);

const arquivos = readdirSync(
  resolve(RAIZ, "lib/context")
).filter((f) => /Context\.tsx$/.test(f));

let total = 0;
let falhas = 0;

const semContrato: string[] = [];

for (const arquivo of arquivos) {

  const nome = arquivo.replace(/\.tsx?$/, "");

  const fonte = readFileSync(
    resolve(RAIZ, "lib/context", arquivo),
    "utf8"
  );

  const objeto = objetoDeValor(fonte);

  if (!objeto) {

    /**
     * Contexto inteiro excetuado é resultado, não dúvida.
     *
     * O resto vira "conferir à mão": pode ser só leitura, mas pode ser
     * um padrão novo que este script não conhece — e um auditor que
     * passa calado quando não entende o arquivo é pior do que auditor
     * nenhum.
     */
    if (temExcecao(nome, "*")) {
      console.log(
        `  --   ${nome.padEnd(24)} fora da auditoria por decisão declarada`
      );
      continue;
    }

    semContrato.push(nome);
    continue;
  }

  const mutadores = entradas(objeto).filter(
    (e) =>
      pareceMutador(e.chave) &&
      !temExcecao(nome, e.chave)
  );

  /**
   * Referência curta manda olhar a definição no arquivo.
   *
   * `persist(` entra ao lado de `sincronizar(` porque o
   * `SavedFiltersContext` centraliza a gravação nele — é o mesmo
   * contrato, com outro nome.
   */
  const grava = (e: { chave: string; valor: string }) => {

    const corpo =
      e.valor || definicao(fonte, e.chave) || "";

    return /sincronizar\s*\(|persist\s*\(/.test(corpo);
  };

  const orfaos = mutadores.filter((e) => !grava(e));

  total += mutadores.length;

  if (mutadores.length === 0) {
    console.log(
      `  --   ${nome.padEnd(24)} nenhum mutador exposto`
    );
    continue;
  }

  if (orfaos.length === 0) {
    console.log(
      `  ok   ${nome.padEnd(24)} ${mutadores.length} mutador(es), todos gravam`
    );
    continue;
  }

  falhas += orfaos.length;

  console.log(
    `FALHA  ${nome.padEnd(24)} ${orfaos.length} de ${mutadores.length} não gravam`
  );

  for (const o of orfaos) {
    console.log(
      `       ${o.chave} — só mexe na tela, some no recarregamento`
    );
  }
}

if (semContrato.length > 0) {
  console.log(
    `\n  sem objeto de valor reconhecível (conferir à mão): ${semContrato.join(", ")}`
  );
}

console.log(
  `\n  ${arquivos.length} contextos · ${total} mutadores expostos · ${EXCECOES.length} exceções declaradas`
);

console.log(
  falhas === 0
    ? "\n  Nenhum cadastro altera só a tela.\n"
    : `\n  ${falhas} mutador(es) não gravam.\n`
);

process.exit(falhas === 0 ? 0 : 1);
