import { createHash } from "node:crypto";

import * as XLSX from "xlsx";

import { segmentOf } from "@/lib/models/nps";

/**
 * Leitura de uma planilha de NPS.
 *
 * O Reclame Aqui já entrava por planilha (`raImport.service.ts`); o NPS
 * só entrava pela API do Wootric. Isso deixava de fora três casos reais:
 * a pesquisa que roda fora do Wootric, o histórico anterior à
 * integração, e a correção em massa — exportar, arrumar numa planilha e
 * devolver.
 *
 * **Aceita dois formatos, e o segundo é o que importa.** O primeiro é o
 * export do próprio Wootric; o segundo é o que **esta aplicação
 * exporta** (`exportNps`), porque é ele que fecha o ciclo de exportar,
 * corrigir e reimportar. Por isso o mapeamento de colunas é por
 * sinônimos, e não por posição: planilha de operação sempre chega com
 * uma coluna a mais no meio.
 */

export interface LinhaDeNps {
  externalId: string;
  score: number;
  comment: string;
  respondedAt: Date;
  customer: string;
  email?: string;
  phone?: string;
  company?: string;
  kind?: string;
  rootCause?: string;
  /** Falso para promotor calado: entra na conta, não abre ciclo. */
  exigeTratativa: boolean;
}

export interface ResultadoDaLeitura {
  itens: LinhaDeNps[];
  /** Linhas descartadas, com o motivo — para a tela poder dizer. */
  ignoradas: { linha: number; motivo: string }[];
  de?: string;
  ate?: string;
}

export class FormatoInvalido extends Error {}

/**
 * Sinônimos aceitos por campo.
 *
 * Em minúsculas e sem acento: a mesma planilha chega com "Nota", "nota"
 * e "NOTA" dependendo de quem a salvou, e o Excel gosta de acrescentar
 * espaço no fim.
 */
const COLUNAS: Record<string, string[]> = {
  score: ["nota", "score", "nps", "nota nps"],
  comment: [
    "comentario",
    "comment",
    "text",
    "feedback",
    "observacao",
  ],
  respondedAt: [
    "respondido em",
    "data",
    "created at",
    "created_at",
    "data da resposta",
    "respondido",
  ],
  customer: [
    "cliente",
    "nome",
    "customer",
    "name",
    "end user",
  ],
  email: ["e-mail", "email", "e mail"],
  phone: ["telefone", "phone", "celular", "whatsapp"],
  company: [
    "estabelecimento",
    "empresa",
    "company",
    "loja",
  ],
  kind: ["tipo", "tipo de tratativa", "kind"],
  rootCause: ["causa raiz", "causa", "root cause"],
  externalId: [
    "id na origem",
    "id",
    "response id",
    "external id",
  ],
};

function normalizar(valor: unknown) {
  return String(valor ?? "")
    .normalize("NFD")
    // Os acentos separados pelo NFD, por código: colados no arquivo
    // eles somem em qualquer editor que normalize o texto de volta.
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function texto(valor: unknown, teto = 4000) {
  const limpo = String(valor ?? "").trim();
  return limpo === "" ? undefined : limpo.slice(0, teto);
}

/**
 * A data, aceitando os três formatos que aparecem de verdade.
 *
 * O `xlsx` devolve número de série quando a célula é data do Excel,
 * texto quando é texto, e o texto vem em dd/mm/aaaa aqui e em aaaa-mm-dd
 * no export do Wootric. Ler os três é mais barato do que exigir um.
 */
function paraData(valor: unknown): Date | null {

  if (valor === null || valor === undefined || valor === "") {
    return null;
  }

  if (valor instanceof Date) {
    return Number.isNaN(valor.getTime()) ? null : valor;
  }

  if (typeof valor === "number") {

    /**
     * Número de série do Excel: dias desde 30/12/1899.
     *
     * A base é 30 e não 31 por causa do bug de 1900 que o Excel
     * mantém de propósito — 1900 não foi bissexto, e ele finge que
     * foi.
     */
    const ms = Math.round(valor * 86400000);

    return new Date(
      Date.UTC(1899, 11, 30) + ms
    );
  }

  const bruto = String(valor).trim();

  const brasileira = bruto.match(
    /^(\d{2})\/(\d{2})\/(\d{2,4})/
  );

  if (brasileira) {

    const [, dia, mes, ano] = brasileira;

    const anoCheio =
      ano.length === 2 ? `20${ano}` : ano;

    return new Date(
      `${anoCheio}-${mes}-${dia}T12:00:00Z`
    );
  }

  const data = new Date(bruto);

  return Number.isNaN(data.getTime()) ? null : data;
}

/**
 * A chave de deduplicação de uma linha sem id próprio.
 *
 * Reimportar a mesma planilha não pode duplicar — é a mesma promessa da
 * importação do Wootric, que se apoia no `externalId`. Sem id na
 * planilha, a identidade é o que de fato identifica uma resposta:
 * **quem**, **quando** e **quanto**. Duas respostas da mesma pessoa, no
 * mesmo instante, com a mesma nota, são a mesma resposta.
 *
 * O prefixo separa esta chave das do Wootric, que são numéricas — sem
 * ele, uma linha de planilha poderia sobrescrever uma resposta da
 * integração por coincidência de número.
 */
function chaveDaLinha(item: {
  customer: string;
  respondedAt: Date;
  score: number;
  email?: string;
}) {

  const semente = [
    normalizar(item.email ?? item.customer),
    item.respondedAt.toISOString().slice(0, 16),
    item.score,
  ].join("|");

  return `planilha:${createHash("sha1")
    .update(semente)
    .digest("hex")
    .slice(0, 24)}`;
}

export function parseNpsPlanilha(
  data: ArrayBuffer | Buffer | Uint8Array
): ResultadoDaLeitura {

  const wb = XLSX.read(data, { type: "buffer" });

  const grade = XLSX.utils.sheet_to_json<unknown[]>(
    wb.Sheets[wb.SheetNames[0]],
    { header: 1, defval: null, raw: false }
  );

  /**
   * O cabeçalho não é necessariamente a primeira linha.
   *
   * Planilha de operação costuma ter título, filtro e uma linha em
   * branco antes — procurar a linha que tem a coluna de nota é o que
   * faz o leitor funcionar sem pedir para ninguém limpar o arquivo.
   */
  const linhaDoCabecalho = grade.findIndex(
    (linha) =>
      Array.isArray(linha) &&
      linha.some((celula) =>
        COLUNAS.score.includes(normalizar(celula))
      )
  );

  if (linhaDoCabecalho === -1) {
    throw new FormatoInvalido(
      'Não achei a coluna da nota. A planilha precisa de uma coluna "Nota" (ou "Score"), com valores de 0 a 10.'
    );
  }

  const cabecalho = (
    grade[linhaDoCabecalho] as unknown[]
  ).map(normalizar);

  const indiceDe = (campo: string) => {

    for (const sinonimo of COLUNAS[campo]) {

      const i = cabecalho.indexOf(sinonimo);

      if (i >= 0) return i;
    }

    return -1;
  };

  const col = {
    score: indiceDe("score"),
    comment: indiceDe("comment"),
    respondedAt: indiceDe("respondedAt"),
    customer: indiceDe("customer"),
    email: indiceDe("email"),
    phone: indiceDe("phone"),
    company: indiceDe("company"),
    kind: indiceDe("kind"),
    rootCause: indiceDe("rootCause"),
    externalId: indiceDe("externalId"),
  };

  if (col.customer === -1) {
    throw new FormatoInvalido(
      'Não achei a coluna do cliente. A planilha precisa de uma coluna "Cliente" (ou "Nome").'
    );
  }

  const itens: LinhaDeNps[] = [];
  const ignoradas: { linha: number; motivo: string }[] =
    [];

  /** Chaves já vistas nesta planilha — duplicata interna também conta. */
  const vistas = new Set<string>();

  const linhas = grade.slice(linhaDoCabecalho + 1);

  linhas.forEach((linha, i) => {

    // +2: uma pelo cabeçalho, outra porque planilha conta do 1.
    const numero = linhaDoCabecalho + i + 2;

    if (
      !Array.isArray(linha) ||
      linha.every(
        (celula) =>
          celula === null || String(celula).trim() === ""
      )
    ) {
      return;
    }

    const cliente = texto(linha[col.customer], 220);

    if (!cliente) {
      ignoradas.push({
        linha: numero,
        motivo: "sem cliente",
      });
      return;
    }

    const bruta = linha[col.score];

    const nota = Number(
      String(bruta ?? "").replace(",", ".")
    );

    /**
     * Nota fora de 0–10 derruba a linha, não a planilha inteira.
     *
     * É o erro mais comum de arquivo montado à mão — uma célula de
     * texto no meio da coluna —, e recusar as 800 linhas por causa de
     * uma seria devolver a planilha inteira para quem não sabe qual
     * corrigir. O relatório diz quais ficaram de fora e por quê.
     */
    if (
      !Number.isFinite(nota) ||
      nota < 0 ||
      nota > 10
    ) {
      ignoradas.push({
        linha: numero,
        motivo: `nota inválida (${String(bruta ?? "vazia")})`,
      });
      return;
    }

    const quando =
      col.respondedAt >= 0
        ? paraData(linha[col.respondedAt])
        : null;

    if (!quando) {
      ignoradas.push({
        linha: numero,
        motivo: "sem data de resposta",
      });
      return;
    }

    const comentario = texto(
      col.comment >= 0 ? linha[col.comment] : null
    );

    const email = texto(
      col.email >= 0 ? linha[col.email] : null,
      200
    );

    const idDaPlanilha = texto(
      col.externalId >= 0 ? linha[col.externalId] : null,
      80
    );

    const item: LinhaDeNps = {
      externalId:
        idDaPlanilha ??
        chaveDaLinha({
          customer: cliente,
          respondedAt: quando,
          score: Math.round(nota),
          email,
        }),
      score: Math.round(nota),
      comment: comentario ?? "",
      respondedAt: quando,
      customer: cliente,
      email,
      phone: texto(
        col.phone >= 0 ? linha[col.phone] : null,
        60
      ),
      company: texto(
        col.company >= 0 ? linha[col.company] : null,
        220
      ),
      kind: texto(
        col.kind >= 0 ? linha[col.kind] : null,
        60
      ),
      rootCause: texto(
        col.rootCause >= 0 ? linha[col.rootCause] : null,
        120
      ),

      /**
       * Promotor calado não abre ciclo.
       *
       * A mesma regra da importação do Wootric, e pelo mesmo motivo:
       * abrir tratativa para cada nota 10 sem comentário enterraria os
       * detratores no meio da fila. Aqui ela precisa ser repetida
       * porque a planilha não passa pelo `traduzir` do Wootric.
       */
      exigeTratativa:
        segmentOf(Math.round(nota)).label !== "Promotor" ||
        (comentario ?? "").trim() !== "",
    };

    if (vistas.has(item.externalId)) {
      ignoradas.push({
        linha: numero,
        motivo: "repetida na própria planilha",
      });
      return;
    }

    vistas.add(item.externalId);

    itens.push(item);
  });

  const datas = itens
    .map((i) => i.respondedAt.getTime())
    .sort((a, b) => a - b);

  return {
    itens,
    ignoradas,
    de: datas.length
      ? new Date(datas[0]).toISOString().slice(0, 10)
      : undefined,
    ate: datas.length
      ? new Date(datas[datas.length - 1])
          .toISOString()
          .slice(0, 10)
      : undefined,
  };
}
