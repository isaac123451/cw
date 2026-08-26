/**
 * O dossiê é uma pasta organizada, e aparece onde precisa aparecer.
 *
 *   npm run check:dossie
 *
 * Duas coisas que quebraram de verdade e não davam erro nenhum.
 *
 * **1. O bloco sumia da tela mais usada.** `blocoDossie` era montado em
 * três lugares — contato sem caso, aba de Redes Sociais e caso aberto —
 * e não na tela que abre sozinha quando a extensão reconhece o contato
 * no WhatsApp. Ou seja: faltava exatamente na hora mais comum de
 * precisar dele, com o cliente na linha e a reclamação já identificada.
 * Nada quebrava; o campo simplesmente não estava lá.
 *
 * **2. A pasta precisa ter capa.** O Isaac mandou a definição de
 * dicionário: dossiê é "conjunto organizado de documentos ou
 * informações sobre um assunto específico". A versão anterior listava
 * as peças em ordem de data, sem dizer quantas eram, de quando até
 * quando, nem de onde vinham — um monte de papel, não uma pasta.
 *
 * A verificação **executa a função real** recortada do `painel.js`, e
 * não uma cópia: uma cópia divergiria na primeira correção e passaria a
 * dar verde sobre código que não existe mais.
 */

import fs from "node:fs";

const FONTE = "extensao/conteudo/painel.js";

let falhas = 0;

function conferir(titulo: string, passou: boolean, detalhe = "") {
  if (!passou) falhas++;
  console.log(
    `  ${passou ? "ok   " : "FALHA"} ${titulo.padEnd(52)} ${detalhe}`
  );
}

interface Peca {
  tipo: string;
  origem: string;
  quando?: string;
  autor?: string;
  trecho: string;
}

function main() {

  console.log(
    "\n  DOSSIÊ — a pasta tem capa, e aparece onde precisa\n"
  );

  const fonte = fs.readFileSync(FONTE, "utf8");

  /* ---------------------------------------- 1. onde aparece ---- */

  /*
    Conta as chamadas, e não a existência da função.

    A função sempre existiu; o defeito era uma tela não chamá-la. Um
    teste que só perguntasse "blocoDossie existe?" teria passado o
    tempo todo em que o campo estava faltando.
  */
  const chamadas = (
    fonte.match(/blocoDossie\s*\(/g) ?? []
  ).length;

  conferir(
    "blocoDossie é montado em pelo menos 4 telas",
    chamadas >= 5, // 4 chamadas + a declaração
    `${chamadas - 1} chamada(s)`
  );

  /*
    A tela do contato identificado, especificamente.

    É a que faltava. O marcador é a linha que a acrescenta logo depois
    da lista de reclamações.
  */
  conferir(
    "a tela de contato identificado monta o dossiê",
    /blocoDossie\(\s*\n?\s*dados\.casos\?\.\[0\]\?\.protocolo/.test(
      fonte
    ),
    "depois da lista de reclamações"
  );

  /* ---------------------------------------- 2. a capa ---- */

  const inicio = fonte.indexOf(
    "function capaEPecas(pecas) {"
  );

  const fim = fonte.indexOf(
    "function blocoResumoDoCaso(r) {"
  );

  if (inicio < 0 || fim < 0 || fim < inicio) {
    conferir("a função da capa existe no painel", false);
    encerrar();
    return;
  }

  const corpo = fonte.slice(inicio, fim);

  /** O mínimo do `CW` que a função usa. */
  const CW = {
    escapar: (valor: unknown) => String(valor ?? ""),
    data: (iso: unknown) =>
      String(iso ?? "")
        .slice(0, 10)
        .split("-")
        .reverse()
        .join("/"),
  };

  const capaEPecas = eval(`(${corpo})`) as (
    pecas: Peca[]
  ) => string;

  void CW;

  const pecas: Peca[] = [
    {
      tipo: "Reclamação",
      origem: "Reclame Aqui",
      quando: "2026-08-06T10:00:00.000Z",
      autor: "Mayara candido do Nascimento",
      trecho: "Suporte lento, prejuízo nas vendas.",
    },
    {
      tipo: "Anotação interna",
      origem: "CW Reputação",
      quando: "2026-08-25T14:00:00.000Z",
      autor: "Carlos Isaac",
      trecho: "Cliente cobrou retorno.",
    },
    {
      tipo: "Anotação interna",
      origem: "CW Reputação",
      quando: "2026-08-25T16:30:00.000Z",
      autor: "Carlos Isaac",
      trecho: "Encaminhado ao suporte.",
    },
    {
      tipo: "Resposta de NPS",
      origem: "Pesquisa",
      quando: "2026-07-14T09:00:00.000Z",
      trecho: 'Nota 4 (Reclamação): "atendimento demorado"',
    },
  ];

  const texto = capaEPecas(pecas)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  console.log(`\n  a capa: ${texto.slice(0, 120)}…\n`);

  conferir(
    "diz quantos documentos a pasta tem",
    texto.includes("4 documento(s)")
  );

  conferir(
    "o período vai da peça mais antiga à mais recente",
    texto.includes("de 14/07/2026 a 25/08/2026"),
    "e não da primeira à última da lista"
  );

  conferir(
    "nomeia as origens, sem repetir",
    texto.includes(
      "Reclame Aqui, CW Reputação, Pesquisa"
    )
  );

  conferir(
    "agrupa as duas anotações num separador só",
    texto.includes("2 anotação interna") &&
      texto.includes("Anotação interna (2)")
  );

  /*
    Siglas não viram minúsculas.

    `toLowerCase()` inteiro dava "1 resposta de nps", que parece erro
    de digitação num documento que existe para ser levado a sério.
  */
  conferir(
    "sigla continua em maiúscula no separador",
    texto.includes("resposta de NPS") &&
      !texto.includes("resposta de nps")
  );

  conferir(
    "numera as peças, para poderem ser citadas",
    ["Peça 1", "Peça 2", "Peça 3", "Peça 4"].every(
      (p) => texto.includes(p)
    )
  );

  conferir(
    "não repete número entre grupos",
    (texto.match(/Peça 1\b/g) ?? []).length === 1,
    "a numeração é contínua, não reinicia por separador"
  );

  /* ---- pasta vazia não inventa período ---- */

  const semData = capaEPecas([
    {
      tipo: "Transcrição do Crisp",
      origem: "Crisp",
      trecho: "12.000 caracteres de atendimento.",
    },
  ])
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");

  conferir(
    "peça sem data não vira período inventado",
    !semData.includes("de undefined") &&
      !/de\s+a\s/.test(semData),
    semData.includes("1 documento(s)")
      ? "e ainda assim conta o documento"
      : ""
  );

  encerrar();
}

function encerrar() {
  console.log(
    falhas === 0
      ? "\n  O dossiê é uma pasta organizada, e está onde precisa estar.\n"
      : `\n  ${falhas} ponto(s) a corrigir.\n`
  );

  process.exit(falhas === 0 ? 0 : 1);
}

main();
