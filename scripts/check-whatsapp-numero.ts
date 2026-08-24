/**
 * O número do WhatsApp é reconhecido, escreva ele como escrever?
 *
 *   npm run check:whatsapp-numero
 *
 * O Isaac reportou que **alguns contatos não eram reconhecidos, com o
 * número idêntico ao da base**, e suspeitou do hífen. Estava certo.
 *
 * Quando o contato não está na agenda do celular, o cabeçalho do
 * WhatsApp Web é o próprio número, e era ali que a extensão o lia. O
 * teste era `/^[+\d\s()\-]+$/`: o texto tinha de ser composto **só** de
 * `+`, dígito, espaço comum, parêntese e o hífen ASCII.
 *
 * O WhatsApp Web não escreve assim. Ele usa hífen não separável
 * (U+2011), travessão curto (U+2013) ou hífen tipográfico (U+2010), e
 * envolve o `+55` em marcas de direção invisíveis (U+200E, U+202A…
 * U+202C) — um `+` seguido de dígitos precisa de dica de direção para
 * renderizar igual em qualquer idioma. Nada disso passava.
 *
 * Medido antes do conserto: **seis de onze formatos reais recusados**,
 * todos números válidos.
 *
 * O sintoma ficou pior depois que o casamento por nome saiu (ele
 * devolvia 53 reclamações para um contato chamado "Santos"): antes a
 * recusa aqui virava um palpite ruim, agora vira "nada encontrado".
 *
 * Este script lê a regra **do próprio arquivo da extensão**, e não uma
 * cópia. Uma cópia passaria a valer sozinha no dia em que alguém
 * mexesse no original — e o teste continuaria verde sobre código que
 * não roda em lugar nenhum.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const RAIZ = resolve(__dirname, "..");

const fonte = readFileSync(
  resolve(RAIZ, "extensao/conteudo/nucleo.js"),
  "utf8"
);

import { runInNewContext } from "node:vm";

let falhas = 0;

function ok(titulo: string, detalhe = "") {
  console.log(
    `  ok     ${titulo}${detalhe ? "  ·  " + detalhe : ""}`
  );
}

function falhar(titulo: string, detalhe: string) {
  falhas += 1;
  console.log(`FALHA    ${titulo}\n         ${detalhe}`);
}

/**
 * A função **de verdade**, executada — não uma cópia.
 *
 * `nucleo.js` é um script de conteúdo: ele não exporta nada, só pendura
 * um objeto em `window`. Então é avaliado aqui num contexto de mentira
 * com `window` e `chrome` fingidos, e o que se testa é o código que a
 * extensão carrega no navegador.
 *
 * Reescrever a regra aqui seria mais fácil e valeria menos: a cópia
 * continuaria passando no dia em que alguém mudasse o original, e o
 * teste ficaria verde sobre código que não roda em lugar nenhum.
 */
function carregarNucleo() {

  const janela: Record<string, unknown> = {};

  const contexto = {
    window: janela,
    chrome: { runtime: { getURL: () => "" } },
    document: { fonts: { add() {} } },
    FontFace: class {},
    setTimeout,
    clearTimeout,
  };

  runInNewContext(fonte, contexto);

  const CW = janela.CWReputacao as
    | {
        telefoneDoTexto?: (v: string) => string;
      }
    | undefined;

  if (typeof CW?.telefoneDoTexto !== "function") {
    throw new Error(
      "nucleo.js não expôs CW.telefoneDoTexto. Se a função foi " +
        "renomeada, este script precisa acompanhar — senão ele passa " +
        "a testar uma regra que não existe mais."
    );
  }

  return CW.telefoneDoTexto;
}

const telefoneDoTexto = carregarNucleo();

console.log(
  "\n  NÚMERO DO WHATSAPP — reconhece em qualquer tipografia?\n"
);

console.log(
  "  executando CW.telefoneDoTexto de extensao/conteudo/nucleo.js\n"
);

/** Vazio vira null, para o teste ler melhor. */
function aceita(cabecalho: string): string | null {
  return telefoneDoTexto(cabecalho) || null;
}

/* ----------------------------------------------------------
   1. Os formatos que o WhatsApp Web produz — todos válidos.
---------------------------------------------------------- */

const ESPERADO = "5511988887777";

const validos: [string, string][] = [
  ["+55 11 98888-7777", "hífen ASCII"],
  [
    "+55 11 98888‑7777",
    "hífen não separável U+2011",
  ],
  ["+55 11 98888–7777", "travessão curto U+2013"],
  [
    "+55 11 98888‐7777",
    "hífen tipográfico U+2010",
  ],
  ["+55 11 98888—7777", "travessão longo U+2014"],
  ["+55 11 98888−7777", "menos matemático U+2212"],
  [
    "+55 11 98888-7777",
    "espaço não separável U+00A0",
  ],
  [
    "‎+55 11 98888-7777",
    "marca de direção antes",
  ],
  [
    "+55 11 98888-7777‎",
    "marca de direção depois",
  ],
  [
    "‪+55 11 98888-7777‬",
    "embutido de direção",
  ],
  [
    "⁦+55 11 98888-7777⁩",
    "isolado de direção U+2066",
  ],
  ["+55 (11) 98888-7777", "com parênteses"],
  ["+55 11 9 8888-7777", "nono dígito separado"],
  ["+5511988887777", "sem separador"],
  ["+55.11.98888.7777", "separado por ponto"],
];

for (const [texto, descricao] of validos) {

  const lido = aceita(texto);

  if (lido === ESPERADO) {
    ok(descricao, lido);
  } else {
    falhar(
      descricao,
      `${JSON.stringify(texto)} → ${lido ?? "RECUSADO"}, esperava ${ESPERADO}`
    );
  }
}

/* ----------------------------------------------------------
   2. O que NÃO é número tem de continuar sendo recusado.

   Sem isto o conserto trocaria um problema por outro: um nome
   aceito como telefone abriria o painel do cliente errado.
---------------------------------------------------------- */

const recusar: [string, string][] = [
  ["Pizzaria do João", "nome de contato"],
  ["~ Maria", "push name"],
  ["Alquimia dos Doces by Jessy", "nome de empresa"],
  ["Grupo Suporte CW", "nome de grupo"],
  ["11 9888", "dígitos de menos"],
  ["", "vazio"],
  ["Loja 24 horas", "nome com número dentro"],
  [
    "1234567890123456789",
    "dígitos demais para telefone",
  ],
  ["Contato 11 98888-7777", "nome seguido de número"],
];

for (const [texto, descricao] of recusar) {

  const lido = aceita(texto);

  if (lido === null) {
    ok(`recusa: ${descricao}`, JSON.stringify(texto));
  } else {
    falhar(
      `recusa: ${descricao}`,
      `${JSON.stringify(texto)} foi aceito como "${lido}" — isso abre o painel do cliente errado`
    );
  }
}

/* ----------------------------------------------------------
   3. A regra antiga falharia — é o que prova que havia defeito.
---------------------------------------------------------- */

const REGRA_ANTIGA = /^[+\d\s()\-]+$/;

const recusadosAntes = validos.filter(
  ([texto]) => !REGRA_ANTIGA.test(texto)
);

if (recusadosAntes.length > 0) {
  ok(
    `a regra antiga recusava ${recusadosAntes.length} de ${validos.length} formatos válidos`,
    recusadosAntes
      .map(([, d]) => d)
      .slice(0, 4)
      .join(" · ")
  );
} else {
  falhar(
    "a regra antiga recusava formatos válidos",
    "nenhum dos casos de teste exercita o defeito — o script não está provando nada"
  );
}

console.log(
  falhas === 0
    ? "\n  Reconhece o número em qualquer tipografia, e continua recusando nome.\n"
    : `\n  ${falhas} problema(s).\n`
);

process.exit(falhas === 0 ? 0 : 1);
