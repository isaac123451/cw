/**
 * Prova o leitor de planilha do NPS.
 *
 *   npm run check:nps-planilha
 *
 * Importador de planilha erra de um jeito específico e caro: ele não
 * quebra, ele **perde linha em silêncio**. Uma coluna com outro nome, uma
 * data em formato diferente, uma célula de texto no meio da coluna de
 * nota — e o arquivo de 800 respostas entra com 780 sem ninguém notar
 * qual ficou de fora.
 *
 * Aqui as planilhas são montadas em memória, nos formatos que chegam de
 * verdade: o que **esta aplicação exporta** (que é o que fecha o ciclo de
 * exportar, corrigir e devolver) e o do Wootric. Não toca no banco.
 */
import * as XLSX from "xlsx";

import {
  FormatoInvalido,
  parseNpsPlanilha,
} from "../lib/services/npsImport.service";

let falhas = 0;

function conferir(
  campo: string,
  obtido: unknown,
  esperado: unknown
) {

  const ok =
    JSON.stringify(obtido) === JSON.stringify(esperado);

  if (!ok) falhas += 1;

  console.log(
    `${ok ? "  ok  " : "FALHA "} ${campo.padEnd(48)} ${JSON.stringify(obtido)}`
  );

  if (!ok) {
    console.log(
      `${" ".repeat(7)}${"esperado".padEnd(48)} ${JSON.stringify(esperado)}`
    );
  }
}

/** Monta um .xlsx em memória a partir de uma grade de células. */
function planilha(grade: unknown[][]) {

  const folha = XLSX.utils.aoa_to_sheet(grade);
  const livro = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(livro, folha, "NPS");

  return XLSX.write(livro, {
    type: "buffer",
    bookType: "xlsx",
  }) as Buffer;
}

console.log("\nLeitor de planilha do NPS\n");

/* ============================================================
   1. O FORMATO QUE ESTA APLICAÇÃO EXPORTA
============================================================ */

const doExport = planilha([
  [
    "Nota",
    "Segmento",
    "Cliente",
    "E-mail",
    "Telefone",
    "Estabelecimento",
    "Comentário",
    "Respondido em",
    "Tipo",
    "Causa raiz",
  ],
  [
    3,
    "Detrator",
    "Marina Ferreira",
    "marina@exemplo.com",
    "51 90000-0000",
    "Loja Centro",
    "O bot responde errado.",
    "20/08/2026 11:21",
    "Reclamação",
    "Bug",
  ],
  [
    10,
    "Promotor",
    "João Silva",
    "joao@exemplo.com",
    "",
    "",
    "",
    "19/08/2026 09:00",
    "",
    "",
  ],
  [
    9,
    "Promotor",
    "Ana Souza",
    "ana@exemplo.com",
    "",
    "",
    "Atendimento excelente!",
    "18/08/2026 15:30",
    "Elogio",
    "",
  ],
]);

const exportado = parseNpsPlanilha(doExport);

conferir(
  "lê as três linhas do export",
  exportado.itens.length,
  3
);

conferir(
  "nota, cliente e comentário",
  [
    exportado.itens[0].score,
    exportado.itens[0].customer,
    exportado.itens[0].comment,
  ],
  [3, "Marina Ferreira", "O bot responde errado."]
);

conferir(
  "data brasileira vira ISO",
  exportado.itens[0].respondedAt
    .toISOString()
    .slice(0, 10),
  "2026-08-20"
);

conferir(
  "tipo e causa raiz vêm junto",
  [
    exportado.itens[0].kind,
    exportado.itens[0].rootCause,
  ],
  ["Reclamação", "Bug"]
);

/**
 * Promotor calado não abre ciclo.
 *
 * Mesma regra da importação do Wootric: são centenas de nota 10 sem uma
 * palavra escrita, e abrir tratativa para cada uma enterraria os
 * detratores no meio da fila. Aqui ela precisa valer também, senão a
 * mesma base entra de dois jeitos diferentes conforme o caminho.
 */
conferir(
  "promotor sem comentário não abre ciclo",
  exportado.itens[1].exigeTratativa,
  false
);

conferir(
  "promotor COM comentário abre",
  exportado.itens[2].exigeTratativa,
  true
);

conferir(
  "detrator abre",
  exportado.itens[0].exigeTratativa,
  true
);

conferir("nenhuma linha ignorada", exportado.ignoradas, []);

conferir(
  "janela lida do arquivo",
  [exportado.de, exportado.ate],
  ["2026-08-18", "2026-08-20"]
);

/* ============================================================
   2. REIMPORTAR NÃO DUPLICA
============================================================ */

const denovo = parseNpsPlanilha(doExport);

/**
 * A chave é a mesma nas duas leituras.
 *
 * É o que sustenta a promessa de reimportar sem duplicar: sem chave
 * estável, corrigir uma célula e mandar de novo criaria uma segunda
 * resposta do mesmo cliente no mesmo instante, e o NPS do mês contaria
 * a pessoa duas vezes.
 */
conferir(
  "a chave de deduplicação é estável",
  denovo.itens.map((i) => i.externalId),
  exportado.itens.map((i) => i.externalId)
);

conferir(
  "e as três chaves são diferentes entre si",
  new Set(exportado.itens.map((i) => i.externalId)).size,
  3
);

/* ============================================================
   3. O FORMATO DO WOOTRIC, COM OUTROS NOMES DE COLUNA
============================================================ */

const doWootric = planilha([
  ["Relatório de NPS — exportado do Wootric"],
  [],
  ["score", "text", "created_at", "name", "email"],
  [
    7,
    "Poderia ser mais rápido",
    "2026-08-15T10:00:00Z",
    "Carla Dias",
    "carla@exemplo.com",
  ],
  [
    2,
    "Péssimo suporte",
    "2026-08-16T08:00:00Z",
    "Rui Alves",
    "rui@exemplo.com",
  ],
]);

const wootric = parseNpsPlanilha(doWootric);

/**
 * O cabeçalho não está na primeira linha.
 *
 * Planilha de operação quase sempre tem título e uma linha em branco
 * antes — procurar a linha da coluna de nota é o que faz o leitor
 * funcionar sem pedir para ninguém limpar o arquivo.
 */
conferir(
  "acha o cabeçalho fora da primeira linha",
  wootric.itens.length,
  2
);

conferir(
  "reconhece os nomes em inglês",
  [
    wootric.itens[0].score,
    wootric.itens[0].customer,
    wootric.itens[0].email,
  ],
  [7, "Carla Dias", "carla@exemplo.com"]
);

conferir(
  "data ISO também é lida",
  wootric.itens[0].respondedAt
    .toISOString()
    .slice(0, 10),
  "2026-08-15"
);

/* ============================================================
   4. LINHA RUIM NÃO DERRUBA O ARQUIVO
============================================================ */

const comSujeira = planilha([
  ["Nota", "Cliente", "Respondido em"],
  [5, "Boa Linha", "10/08/2026"],
  ["n/a", "Nota Inválida", "10/08/2026"],
  [8, "", "10/08/2026"],
  [9, "Sem Data", ""],
  [11, "Nota Fora da Escala", "10/08/2026"],
  [],
  [5, "Boa Linha", "10/08/2026"],
]);

const sujo = parseNpsPlanilha(comSujeira);

/**
 * Uma célula errada não pode custar as outras 800.
 *
 * Recusar o arquivo inteiro devolve o problema para quem não sabe qual
 * linha corrigir. O relatório diz o número e o motivo de cada descarte —
 * é essa metade que transforma "gravei 780 de 800" em algo acionável.
 */
conferir(
  "grava só a linha boa",
  sujo.itens.map((i) => i.customer),
  ["Boa Linha"]
);

conferir(
  "e conta os descartes",
  sujo.ignoradas.length,
  5
);

conferir(
  "com o motivo de cada um",
  sujo.ignoradas.map((i) => i.motivo),
  [
    "nota inválida (n/a)",
    "sem cliente",
    "sem data de resposta",
    "nota inválida (11)",
    "repetida na própria planilha",
  ]
);

conferir(
  "linha em branco não vira descarte",
  sujo.ignoradas.some((i) =>
    i.motivo.includes("vazia")
  ),
  false
);

/* ============================================================
   5. ARQUIVO QUE NÃO É PLANILHA DE NPS
============================================================ */

const semNota = planilha([
  ["Coluna A", "Coluna B"],
  ["algo", "outra coisa"],
]);

let recusou = "";

try {
  parseNpsPlanilha(semNota);
} catch (erro) {
  recusou =
    erro instanceof FormatoInvalido ? "formato" : "outro";
}

/**
 * A recusa precisa dizer o que falta.
 *
 * "Não foi possível ler a planilha" manda a pessoa adivinhar. O leitor
 * sabe exatamente qual coluna procurou e não achou.
 */
conferir(
  "planilha sem coluna de nota é recusada com motivo",
  recusou,
  "formato"
);

console.log(
  falhas === 0
    ? "\nO leitor de planilha lê o que promete, e diz o que deixou de fora.\n"
    : `\n${falhas} conferência(s) fora do esperado.\n`
);

process.exit(falhas === 0 ? 0 : 1);
