/**
 * O aviso do Reclame Aqui vira reclamação certa?
 *
 *   npm run check:email-ra
 *
 * **Por que este script é o centro desta funcionalidade.** A entrada
 * automática cria reclamações sozinha, sem ninguém olhando. Um campo
 * extraído errado não aparece como erro: aparece como um caso no Kanban
 * com o protocolo de outro, recebendo dono e resposta. O custo de
 * descobrir isso depois é alto e a chance de descobrir é baixa.
 *
 * Então cada regra de extração é conferida aqui, contra texto de
 * verdade — e as duas metades importam:
 *
 * 1. **O que deve ser lido, é lido.** As amostras em
 *    `scripts/amostras/aviso-ra-*.txt` são avisos reais, salvos do
 *    e-mail. Para cada uma, o protocolo e o título têm de sair.
 * 2. **O que não deve virar reclamação, não vira.** Remetente de fora
 *    do portal, e-mail de marketing do próprio portal sem protocolo,
 *    aviso de outra coisa — todos têm de devolver `null`.
 *
 * **Sem amostra, este script avisa e não finge que passou.** Um
 * verificador verde por falta de dado é pior que verificador nenhum:
 * ele afirma que está tudo certo sobre algo que nunca foi testado.
 *
 * Para acrescentar uma amostra: abra o e-mail no Gmail, "Mostrar
 * original" ou copie o corpo, e salve em
 * `scripts/amostras/aviso-ra-<algo>.txt` com três linhas de cabeçalho
 * antes do corpo:
 *
 *     De: Reclame Aqui <nao-responda@reclameaqui.com.br>
 *     Assunto: Você recebeu uma nova reclamação
 *     Data: 2026-09-01T10:00:00.000Z
 *     (linha em branco, e o corpo daqui para baixo)
 *
 * Troque nome, e-mail e telefone do consumidor por valores fictícios
 * antes de salvar — a amostra vai para o repositório.
 */
import {
  existsSync,
  readFileSync,
  readdirSync,
} from "node:fs";

import { resolve } from "node:path";

import {
  consultaDeAvisos,
  interpretarAviso,
  remetenteConfiavel,
} from "../lib/services/raEmail.service";

const RAIZ = resolve(__dirname, "..");
const PASTA = resolve(RAIZ, "scripts/amostras");

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

/** Lê o arquivo de amostra no formato de três cabeçalhos. */
function lerAmostra(caminho: string) {

  const bruto = readFileSync(caminho, "utf8").replace(
    /^﻿/,
    ""
  );

  const corte = bruto.indexOf("\n\n");

  const cabecalho =
    corte === -1 ? bruto : bruto.slice(0, corte);

  const corpo =
    corte === -1 ? "" : bruto.slice(corte + 2);

  const pegar = (nome: string) =>
    cabecalho
      .match(new RegExp(`^${nome}:\\s*(.+)$`, "im"))?.[1]
      ?.trim() ?? "";

  return {
    remetente: pegar("De"),
    assunto: pegar("Assunto"),
    recebidoEm:
      pegar("Data") || new Date().toISOString(),
    texto: corpo,
  };
}

console.log(
  "\n  AVISO DO RECLAME AQUI — vira reclamação certa?\n"
);

console.log(
  `  consulta no Gmail: ${consultaDeAvisos()}\n`
);

/* ------------------------------ 1. o remetente ---- */

const REMETENTES: [string, boolean][] = [
  ["Reclame Aqui <nao-responda@reclameaqui.com.br>", true],
  ["avisos@hugme.com.br", true],
  ["Alertas <no-reply@mail.reclameaqui.com.br>", true],
  ["golpista@reclameaqui.com.br.evil.co", false],
  ["Reclame Aqui <contato@empresa-qualquer.com>", false],
  ["reclameaqui@gmail.com", false],
  ["", false],
];

const errosDeRemetente = REMETENTES.filter(
  ([valor, esperado]) =>
    remetenteConfiavel(valor) !== esperado
);

if (errosDeRemetente.length === 0) {
  ok(
    "o remetente é conferido pelo domínio, não pelo nome",
    'inclusive "reclameaqui.com.br.evil.co", que contém o domínio bom e não é ele'
  );
} else {
  falhar(
    "o remetente é conferido pelo domínio, não pelo nome",
    `errou em: ${errosDeRemetente
      .map(([v]) => `"${v}"`)
      .join(", ")}`
  );
}

/* ------------------------------ 2. o que não pode virar caso ---- */

const RECUSAS: [string, Record<string, string>][] = [
  [
    "e-mail de terceiro dizendo ter reclamação",
    {
      remetente: "atacante@exemplo.com",
      assunto: "Nova reclamação — protocolo RA-123456",
      texto: "Protocolo: RA-123456\nAssunto: qualquer coisa",
    },
  ],
  [
    "aviso do portal sem protocolo nenhum",
    {
      remetente: "news@reclameaqui.com.br",
      assunto: "Novidades do mês para a sua empresa",
      texto:
        "Confira as novidades da plataforma e o novo painel.",
    },
  ],
  [
    "corpo vazio, remetente certo",
    {
      remetente: "nao-responda@reclameaqui.com.br",
      assunto: "",
      texto: "",
    },
  ],
];

for (const [nome, bruto] of RECUSAS) {

  const r = interpretarAviso({
    remetente: bruto.remetente,
    assunto: bruto.assunto,
    texto: bruto.texto,
    recebidoEm: new Date().toISOString(),
  });

  if (r === null) {
    ok(`recusa: ${nome}`, "devolveu null, nenhum caso criado");
  } else {
    falhar(
      `recusa: ${nome}`,
      `criaria a reclamação ${r.protocolo} — "${r.titulo}"`
    );
  }
}

/* ------------------------------ 3. as amostras reais ---- */

console.log("");

const amostras = existsSync(PASTA)
  ? readdirSync(PASTA).filter(
      (n) => /^aviso-ra-.*\.txt$/.test(n)
    )
  : [];

if (amostras.length === 0) {

  /*
    Sem amostra não há o que conferir, e dizer "ok" seria mentira.

    As regras acima provam as recusas — que são metade do trabalho e a
    metade que protege. A outra metade, extrair certo de um aviso de
    verdade, depende de um aviso de verdade.
  */
  falhas += 1;

  console.log(
    [
      "FALHA    nenhuma amostra de aviso real para conferir",
      "",
      "         As recusas acima passam, mas elas provam só o que o",
      "         módulo **não** faz. Nada aqui provou que ele lê o",
      "         protocolo certo de um aviso de verdade — e é isso que",
      "         vai criar reclamações sozinho.",
      "",
      "         Salve um aviso em scripts/amostras/aviso-ra-<algo>.txt",
      "         no formato descrito no cabeçalho deste arquivo, com os",
      "         dados do consumidor trocados por fictícios.",
      "",
    ].join("\n")
  );

} else {

  for (const nome of amostras) {

    const mensagem = lerAmostra(resolve(PASTA, nome));

    const r = interpretarAviso(mensagem);

    if (!r) {
      falhar(
        nome,
        "não reconheci: sem protocolo ou sem título. Os padrões de raEmail.service.ts precisam da forma que aparece nesta amostra."
      );
      continue;
    }

    const faltando = [
      !r.consumidor && "consumidor",
      !r.cidade && "cidade",
      !r.relato && "relato",
      !r.url && "link",
    ].filter(Boolean);

    ok(
      nome,
      [
        `protocolo ${r.protocolo}`,
        `"${r.titulo.slice(0, 60)}"`,
        faltando.length
          ? `sem: ${faltando.join(", ")} (a extensão completa ao abrir)`
          : "todos os campos extraídos",
      ].join(" · ")
    );
  }
}

console.log(
  falhas === 0
    ? "\n  O aviso vira reclamação certa, e o que não é aviso não vira nada.\n"
    : `\n  ${falhas} ponto(s) a corrigir antes de deixar isto criar reclamação sozinho.\n`
);

process.exitCode = falhas === 0 ? 0 : 1;
