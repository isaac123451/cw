import { ancoraDe } from "@/lib/models/playbook";

/**
 * O markdown dos documentos, em blocos.
 *
 * Só o que os documentos do time usam — título, parágrafo, lista,
 * citação (os modelos de mensagem), tabela e negrito — e mais itálico,
 * código e link, que qualquer edição feita aqui pode trazer. Nada vira
 * HTML cru: a tela desenha cada bloco com elementos do React, então um
 * `<script>` digitado no documento aparece como texto.
 *
 * As âncoras dos títulos saem na mesma ordem e com a mesma regra de
 * `secoesDoDocumento`, para o "por quê?" das telas e o índice da página
 * apontarem para o mesmo lugar.
 */

export type Bloco =
  | { tipo: "titulo"; nivel: 2 | 3 | 4; texto: string; ancora?: string }
  | { tipo: "paragrafo"; linhas: string[] }
  | { tipo: "lista"; ordenada: boolean; inicio: number; itens: string[] }
  | { tipo: "citacao"; linhas: string[] }
  | { tipo: "tabela"; cabecalho: string[]; linhas: string[][] }
  | { tipo: "separador" };

const TITULO = /^(#{1,4})\s+(.+?)\s*#*\s*$/;
const ITEM = /^\s*[-*+]\s+(.*)$/;
const NUMERADO = /^\s*(\d+)[.)]\s+(.*)$/;
const CITACAO = /^\s*>\s?(.*)$/;
const LINHA_DE_TABELA = /^\s*\|.*\|\s*$/;
const DIVISAO_DE_TABELA = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/;
const SEPARADOR = /^\s*(-{3,}|\*{3,}|_{3,})\s*$/;

function celulas(linha: string) {
  return linha
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split(/(?<!\\)\|/)
    .map((c) => c.trim().replace(/\\\|/g, "|"));
}

export function blocosDoMarkdown(conteudo: string): Bloco[] {
  const linhas = conteudo.replace(/\r/g, "").split("\n");
  const blocos: Bloco[] = [];
  const usadas = new Map<string, number>();

  let i = 0;
  while (i < linhas.length) {
    const linha = linhas[i];

    if (!linha.trim()) {
      i += 1;
      continue;
    }

    const titulo = linha.match(TITULO);
    if (titulo) {
      const hashes = titulo[1].length;
      const texto = titulo[2];
      /* Só ## e ### têm endereço — são as seções de `secoesDoDocumento`. */
      let ancora: string | undefined;
      if (hashes === 2 || hashes === 3) {
        const base = ancoraDe(texto) || "secao";
        const vezes = usadas.get(base) ?? 0;
        usadas.set(base, vezes + 1);
        ancora = vezes ? `${base}-${vezes + 1}` : base;
      }
      blocos.push({ tipo: "titulo", nivel: hashes <= 2 ? 2 : hashes === 3 ? 3 : 4, texto, ancora });
      i += 1;
      continue;
    }

    if (SEPARADOR.test(linha)) {
      blocos.push({ tipo: "separador" });
      i += 1;
      continue;
    }

    if (LINHA_DE_TABELA.test(linha) && i + 1 < linhas.length && DIVISAO_DE_TABELA.test(linhas[i + 1])) {
      const cabecalho = celulas(linha);
      const corpo: string[][] = [];
      i += 2;
      while (i < linhas.length && LINHA_DE_TABELA.test(linhas[i])) {
        const c = celulas(linhas[i]);
        /* A linha curta ganha células vazias; a comprida perde o excesso. */
        corpo.push(cabecalho.map((_, k) => c[k] ?? ""));
        i += 1;
      }
      blocos.push({ tipo: "tabela", cabecalho, linhas: corpo });
      continue;
    }

    if (CITACAO.test(linha)) {
      const citadas: string[] = [];
      while (i < linhas.length && CITACAO.test(linhas[i])) {
        citadas.push(linhas[i].match(CITACAO)![1]);
        i += 1;
      }
      blocos.push({ tipo: "citacao", linhas: citadas });
      continue;
    }

    if (ITEM.test(linha) || NUMERADO.test(linha)) {
      const ordenada = !ITEM.test(linha);
      const padrao = ordenada ? NUMERADO : ITEM;
      const inicio = ordenada ? Number(linha.match(NUMERADO)![1]) : 1;
      const itens: string[] = [];
      while (i < linhas.length && linhas[i].trim()) {
        const m = linhas[i].match(padrao);
        if (m) itens.push(ordenada ? m[2] : m[1]);
        else if (TITULO.test(linhas[i]) || CITACAO.test(linhas[i]) || LINHA_DE_TABELA.test(linhas[i]) || (ordenada ? ITEM : NUMERADO).test(linhas[i])) break;
        /* Linha que continua o item de cima (o PDF quebrava assim). */
        else itens[itens.length - 1] += ` ${linhas[i].trim()}`;
        i += 1;
      }
      blocos.push({ tipo: "lista", ordenada, inicio, itens });
      continue;
    }

    const paragrafo: string[] = [];
    while (
      i < linhas.length &&
      linhas[i].trim() &&
      !TITULO.test(linhas[i]) &&
      !CITACAO.test(linhas[i]) &&
      !ITEM.test(linhas[i]) &&
      !NUMERADO.test(linhas[i]) &&
      !SEPARADOR.test(linhas[i]) &&
      !(LINHA_DE_TABELA.test(linhas[i]) && DIVISAO_DE_TABELA.test(linhas[i + 1] ?? ""))
    ) {
      paragrafo.push(linhas[i].trim());
      i += 1;
    }
    blocos.push({ tipo: "paragrafo", linhas: paragrafo });
  }

  return blocos;
}

/* ============================================================
   DENTRO DA LINHA
============================================================ */

export type Trecho =
  | { tipo: "texto"; texto: string }
  | { tipo: "negrito"; filhos: Trecho[] }
  | { tipo: "italico"; filhos: Trecho[] }
  | { tipo: "codigo"; texto: string }
  | { tipo: "link"; href: string; filhos: Trecho[] };

/** Só http(s) e mailto viram link; o resto fica texto — nada de `javascript:`. */
function hrefSeguro(href: string) {
  const h = href.trim();
  return /^(https?:\/\/|mailto:)/i.test(h) ? h : null;
}

export function trechosDaLinha(linha: string): Trecho[] {
  const saida: Trecho[] = [];
  let texto = "";
  const soltar = () => {
    if (texto) saida.push({ tipo: "texto", texto });
    texto = "";
  };

  let i = 0;
  while (i < linha.length) {
    const ch = linha[i];

    /* `\*` é um asterisco de verdade. */
    if (ch === "\\" && i + 1 < linha.length && /[\\`*_{}[\]()#+\-.!|>]/.test(linha[i + 1])) {
      texto += linha[i + 1];
      i += 2;
      continue;
    }

    if (ch === "`") {
      const fim = linha.indexOf("`", i + 1);
      if (fim > i + 1) {
        soltar();
        saida.push({ tipo: "codigo", texto: linha.slice(i + 1, fim) });
        i = fim + 1;
        continue;
      }
    }

    if (linha.startsWith("**", i)) {
      const fim = fechamento(linha, "**", i + 2);
      if (fim > i + 2) {
        soltar();
        saida.push({ tipo: "negrito", filhos: trechosDaLinha(linha.slice(i + 2, fim)) });
        i = fim + 2;
        continue;
      }
    }

    if (ch === "*" && linha[i + 1] !== " " && linha[i + 1] !== "*") {
      const fim = fechamento(linha, "*", i + 1);
      if (fim > i + 1 && linha[fim - 1] !== " ") {
        soltar();
        saida.push({ tipo: "italico", filhos: trechosDaLinha(linha.slice(i + 1, fim)) });
        i = fim + 1;
        continue;
      }
    }

    if (ch === "[") {
      const m = linha.slice(i).match(/^\[([^\]]+)\]\(([^)\s]+)\)/);
      const href = m && hrefSeguro(m[2]);
      if (m && href) {
        soltar();
        saida.push({ tipo: "link", href, filhos: trechosDaLinha(m[1]) });
        i += m[0].length;
        continue;
      }
    }

    texto += ch;
    i += 1;
  }

  soltar();
  return saida;
}

/** Onde fecha o marcador, pulando os escapados. -1 se não fecha. */
function fechamento(linha: string, marca: string, desde: number) {
  for (let k = desde; k <= linha.length - marca.length; k++) {
    if (linha[k] === "\\") {
      k += 1;
      continue;
    }
    if (linha.startsWith(marca, k)) {
      /* Em `***` o negrito fecha nos dois últimos: o primeiro fecha um itálico de dentro. */
      if (marca === "**" && linha[k + 2] === "*") return k + 1;
      /* `**` não fecha um itálico: é o começo de um negrito. */
      if (marca === "*" && linha[k + 1] === "*") {
        const fimDoNegrito = fechamento(linha, "**", k + 2);
        if (fimDoNegrito > 0) {
          k = fimDoNegrito + 1;
          continue;
        }
      }
      return k;
    }
  }
  return -1;
}

/** O texto sem as marcas — o que vai para a área de transferência. */
export function textoPuro(linha: string): string {
  return trechosDaLinha(linha)
    .map(function puro(t: Trecho): string {
      if (t.tipo === "texto" || t.tipo === "codigo") return t.texto;
      return t.filhos.map(puro).join("");
    })
    .join("");
}

/* ============================================================
   BUSCA
============================================================ */

/** Sem acento e minúsculo, um caractere por caractere — os índices batem com o original. */
export function dobrar(texto: string) {
  return Array.from(texto, (ch) => ch.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().charAt(0) || ch).join("");
}

/**
 * Os pedaços de um texto, marcando onde o termo aparece.
 *
 * "Falta de retorno" acha "falta de RETORNO" e "Fálta" — a busca não
 * pode depender de quem digitou lembrar do acento.
 */
export function marcarTermo(texto: string, termo: string): { texto: string; achou: boolean }[] {
  const t = dobrar(termo.trim());
  if (!t) return [{ texto, achou: false }];
  const pontos = Array.from(texto);
  const dobrado = dobrar(texto);
  const dobradoPontos = Array.from(dobrado);
  const alvo = Array.from(t);

  const pedacos: { texto: string; achou: boolean }[] = [];
  let atual = "";
  let k = 0;
  while (k < pontos.length) {
    let bate = k + alvo.length <= dobradoPontos.length;
    for (let j = 0; bate && j < alvo.length; j++) if (dobradoPontos[k + j] !== alvo[j]) bate = false;
    if (bate) {
      if (atual) pedacos.push({ texto: atual, achou: false });
      atual = "";
      pedacos.push({ texto: pontos.slice(k, k + alvo.length).join(""), achou: true });
      k += alvo.length;
    } else {
      atual += pontos[k];
      k += 1;
    }
  }
  if (atual) pedacos.push({ texto: atual, achou: false });
  return pedacos;
}
