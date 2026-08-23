/**
 * Prova o leitor de conversa do WhatsApp contra marcações reais.
 *
 *   npm run check:whatsapp
 *
 * Este leitor já quebrou três vezes, sempre do mesmo jeito: o WhatsApp
 * muda a marcação, a extensão anuncia "não achei nenhuma mensagem" numa
 * conversa cheia, e ninguém sabe se o defeito é a leitura ou a conversa.
 * Ele não tinha prova nenhuma — `tsc` não lê DOM alheio.
 *
 * O caso 3 é o que o Isaac reportou em 23/08: dez linhas encontradas,
 * nenhuma mensagem devolvida. A causa não era falta de texto — era o
 * filtro do `data-id` descartando tudo **antes** de alguém olhar o
 * texto. O leitor culpava a página por um descarte que ele mesmo fazia.
 *
 * Roda sem navegador: um DOM mínimo em memória, com só o que o leitor
 * usa (`querySelector`, `querySelectorAll`, `innerText`,
 * `getAttribute`, `classList`).
 */

/* ============================================================
   DOM DE MENTIRA, SÓ COM O QUE O LEITOR USA
============================================================ */

class No {

  constructor({ tag = "div", attrs = {}, classes = [], texto = "", filhos = [] }) {
    this.tag = tag;
    this.attrs = attrs;
    this.classes = classes;
    this.texto = texto;
    this.filhos = filhos;
    for (const f of filhos) f.pai = this;
  }

  get classList() {
    return { contains: (c) => this.classes.includes(c) };
  }

  getAttribute(nome) {
    return this.attrs[nome] ?? null;
  }

  get innerText() {
    if (this.filhos.length === 0) return this.texto;

    return this.filhos
      .map((f) => f.innerText)
      .filter(Boolean)
      .join("\n");
  }

  /** Todos os descendentes, em profundidade. */
  *descendentes() {
    for (const f of this.filhos) {
      yield f;
      yield* f.descendentes();
    }
  }

  /**
   * Casa um seletor simples.
   *
   * Só o que o leitor usa de verdade: tag, `.classe`, `[attr]`,
   * `[attr="valor"]`, combinações de tag+classe, e listas separadas por
   * vírgula. Não é um motor de CSS — é o suficiente para provar o
   * leitor sem carregar um navegador inteiro.
   */
  casa(seletor) {
    return seletor
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .some((s) => this.casaUm(s));
  }

  casaUm(seletor) {

    const attr = seletor.match(
      /^([a-z]*)\[([^\]=]+)(?:="([^"]*)")?\]$/i
    );

    if (attr) {
      const [, tag, nome, valor] = attr;
      if (tag && this.tag !== tag) return false;
      const atual = this.attrs[nome];
      if (atual === undefined) return false;
      return valor === undefined || atual === valor;
    }

    const tagClasse = seletor.match(
      /^([a-z]*)((?:\.[A-Za-z0-9_-]+)*)$/i
    );

    if (tagClasse) {
      const [, tag, classes] = tagClasse;
      if (tag && this.tag !== tag) return false;
      if (seletor.startsWith("#")) return false;
      const pedidas = classes
        .split(".")
        .filter(Boolean);
      return pedidas.every((c) => this.classes.includes(c));
    }

    if (seletor.startsWith("#")) {
      return this.attrs.id === seletor.slice(1);
    }

    return false;
  }

  querySelectorAll(seletor) {
    const saida = [];
    for (const d of this.descendentes()) {
      if (d.casa(seletor)) saida.push(d);
    }
    return saida;
  }

  querySelector(seletor) {
    return this.querySelectorAll(seletor)[0] ?? null;
  }
}

function no(tag, attrs, classes, filhosOuTexto) {
  return new No({
    tag,
    attrs: attrs ?? {},
    classes: classes ?? [],
    texto:
      typeof filhosOuTexto === "string"
        ? filhosOuTexto
        : "",
    filhos: Array.isArray(filhosOuTexto)
      ? filhosOuTexto
      : [],
  });
}

/* ============================================================
   AS QUATRO MARCAÇÕES
============================================================ */

/** Balão clássico: id com telefone, texto em span.selectable-text. */
function baloesClassicos() {
  return no("div", { id: "main" }, [], [
    no("div", { "data-id": "false_555199999999@c.us_A1" }, ["message-in"], [
      no("div", { "data-pre-plain-text": "[09:14, 22/08/2026] Cliente: " }, ["copyable-text"], [
        no("span", {}, ["selectable-text"], "meu pedido não chegou"),
      ]),
    ]),
    no("div", { "data-id": "true_555199999999@c.us_B2" }, ["message-out"], [
      no("div", { "data-pre-plain-text": "[09:15, 22/08/2026] Eu: " }, ["copyable-text"], [
        no("span", {}, ["selectable-text"], "vou verificar agora"),
      ]),
    ]),
    // Divisor de data: tem data-id, não tem @, e não é mensagem.
    no("div", { "data-id": "divisor-22-08" }, [], [
      no("span", {}, [], "HOJE"),
    ]),
  ]);
}

/** O caso que quebrou: dez linhas, nenhum @ no data-id. */
function idSemArroba() {

  const linhas = [];

  for (let i = 0; i < 10; i += 1) {
    linhas.push(
      no("div", { "data-id": `msg-${i}` }, [i % 2 ? "message-out" : "message-in"], [
        no("span", {}, ["selectable-text"], `mensagem número ${i}`),
      ])
    );
  }

  return no("div", { id: "main" }, [], linhas);
}

/** Sem selectable-text: só innerText, com hora e status junto. */
function semSelectableText() {
  return no("div", { id: "main" }, [], [
    no("div", { "data-id": "false_5511@c.us_C3" }, ["message-in"], [
      no("div", {}, [], "o sistema caiu de novo"),
      no("div", {}, [], "09:20"),
    ]),
    no("div", { "data-id": "true_5511@c.us_D4" }, ["message-out"], [
      no("div", {}, [], "já estamos olhando"),
      no("div", {}, [], "09:21"),
      no("div", {}, [], "Entregue"),
    ]),
  ]);
}

/** Sem data-id nenhum: sobra role=row e as classes de direção. */
function semDataId() {
  return no("div", { role: "application" }, [], [
    no("div", { role: "row" }, ["message-in"], [
      no("span", {}, ["selectable-text"], "bom dia, tenho um problema"),
    ]),
    no("div", { role: "row" }, ["message-out"], [
      no("span", {}, ["selectable-text"], "bom dia! pode falar"),
    ]),
  ]);
}

/** Mensagem citada + resposta: dois selectable-text na mesma linha. */
function comCitacao() {
  return no("div", { id: "main" }, [], [
    no("div", { "data-id": "true_5511@c.us_E5" }, ["message-out"], [
      no("span", {}, ["selectable-text"], "meu pedido não chegou"),
      no("span", {}, ["selectable-text"], "já foi resolvido, obrigado"),
    ]),
  ]);
}

/* ============================================================
   O LEITOR, CARREGADO DO ARQUIVO DA EXTENSÃO
============================================================ */

const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");

const fonte = readFileSync(
  resolve(__dirname, "../extensao/conteudo/whatsapp.js"),
  "utf8"
);

let raiz = null;

/**
 * O documento falso.
 *
 * `#main` é tratado à parte porque o seletor de id não passa pelo
 * casamento normal — e é justamente o primeiro que o leitor tenta.
 */
const documento = {
  querySelector(seletor) {

    if (!raiz) return null;

    if (seletor === "#main") {
      return raiz.attrs.id === "main" ? raiz : null;
    }

    return raiz.casa(seletor)
      ? raiz
      : raiz.querySelector(seletor);
  },
  querySelectorAll(seletor) {
    return raiz ? raiz.querySelectorAll(seletor) : [];
  },
  addEventListener() {},
};

let lerMensagens = null;

/**
 * O painel de mentira.
 *
 * O detector chama estes métodos ao carregar; só um interessa aqui, e é
 * por ele que o leitor chega até as conferências.
 */
const CW = {
  painel: {
    montar() {},
    garantir() {},
    permitirAutoAbrir() {},
    definirCaptura() {},
    definirContexto() {},
    definirLeitorDeConversa(fn) {
      lerMensagens = fn;
    },
  },
};

/**
 * O arquivo é executado como o navegador executaria.
 *
 * `setInterval` vira função vazia: o detector roda em laço na página, e
 * aqui ele só precisa registrar o leitor uma vez.
 */
const executar = new Function(
  "window",
  "document",
  "location",
  "CW",
  "setInterval",
  "console",
  fonte
);

executar(
  // O detector procura o painel em `window.CWReputacao`.
  { CWReputacao: CW },
  documento,
  { href: "https://web.whatsapp.com/" },
  CW,
  () => 0,
  console
);

if (typeof lerMensagens !== "function") {
  console.error(
    "\n  O leitor não se registrou — `definirLeitorDeConversa` não foi chamado.\n"
  );
  process.exit(1);
}

/* ============================================================
   AS CONFERÊNCIAS
============================================================ */

let falhas = 0;

function conferir(campo, obtido, esperado) {

  const ok =
    JSON.stringify(obtido) === JSON.stringify(esperado);

  if (!ok) falhas += 1;

  console.log(
    `${ok ? "  ok  " : "FALHA "} ${campo.padEnd(46)} ${JSON.stringify(obtido)}`
  );

  if (!ok) {
    console.log(
      `${" ".repeat(7)}${"esperado".padEnd(46)} ${JSON.stringify(esperado)}`
    );
  }
}

function ler(arvore) {
  raiz = arvore;
  return lerMensagens();
}

console.log("\n  LEITOR DE CONVERSA DO WHATSAPP\n");

/* ---- 1. balões clássicos ---- */

console.log("  Marcação clássica");

const a = ler(baloesClassicos());

conferir("1. duas mensagens", a.mensagens.length, 2);
conferir("1. texto da primeira", a.mensagens[0]?.texto, "meu pedido não chegou");
conferir("1. de quem é a primeira", a.mensagens[0]?.de, "cliente");
conferir("1. de quem é a segunda", a.mensagens[1]?.de, "nos");
conferir("1. hora do carimbo", a.mensagens[0]?.hora, "09:14");

/** O divisor "HOJE" tem data-id sem @ — não é mensagem. */
conferir(
  "1. divisor de data ficou de fora",
  a.mensagens.some((m) => m.texto === "HOJE"),
  false
);

/* ---- 2. o caso que o Isaac reportou ---- */

console.log("\n  Dez linhas com data-id sem @ (o defeito de 23/08)");

const b = ler(idSemArroba());

conferir("2. leu as dez", b.mensagens.length, 10);
conferir("2. e disse por onde", b.via, 'div[data-id] (sem o filtro de id)');
conferir("2. sem motivo de erro", b.motivo, undefined);
conferir("2. texto da primeira", b.mensagens[0]?.texto, "mensagem número 0");
conferir("2. direção pela classe", b.mensagens[1]?.de, "nos");

/* ---- 3. sem selectable-text ---- */

console.log("\n  Sem selectable-text: hora e status colados no texto");

const c = ler(semSelectableText());

conferir("3. duas mensagens", c.mensagens.length, 2);
conferir(
  "3. a hora não entra no texto",
  c.mensagens[0]?.texto,
  "o sistema caiu de novo"
);
conferir(
  "3. nem o status de entrega",
  c.mensagens[1]?.texto,
  "já estamos olhando"
);

/* ---- 4. sem data-id ---- */

console.log("\n  Sem data-id: sobra role=row");

const d = ler(semDataId());

conferir("4. duas mensagens", d.mensagens.length, 2);
conferir("4. direção pela classe", d.mensagens[0]?.de, "cliente");
conferir("4. e a nossa", d.mensagens[1]?.de, "nos");

/* ---- 5. citação + resposta ---- */

console.log("\n  Mensagem citada junto da resposta");

const e = ler(comCitacao());

conferir("5. uma linha só", e.mensagens.length, 1);
conferir(
  "5. com os dois pedaços",
  e.mensagens[0]?.texto,
  "meu pedido não chegou já foi resolvido, obrigado"
);

/* ---- 6. conversa vazia ---- */

console.log("\n  Conversa sem mensagem");

const f = ler(no("div", { id: "main" }, [], []));

conferir("6. nenhuma mensagem", f.mensagens.length, 0);

conferir(
  "6. e o motivo é honesto",
  typeof f.motivo === "string" && f.motivo.length > 10,
  true
);

console.log(
  falhas === 0
    ? "\n  O leitor devolve a conversa em todas as marcações.\n"
    : `\n  ${falhas} falha(s).\n`
);

process.exit(falhas === 0 ? 0 : 1);
